import type { MergeableStore } from 'tinybase';
import { supabase } from '@/lib/supabase';
import type { SyncStatus } from '@/store/schema';
import { generateId, now } from '@/store/schema';

export type SyncTable = 'notes' | 'labels' | 'contacts' | 'note_versions' | 'note_actions' | 'note_labels' | 'note_assignees' | 'projects' | 'user_preferences';

interface SyncProgress {
  table: string;
  current: number;
  total: number;
}

export interface SupabaseSyncOptions {
  userId: string;
  onProgress?: (progress: SyncProgress) => void;
  onError?: (error: Error, table: string) => void;
}

/**
 * SupabaseDataSync handles bidirectional sync between TinyBase store and Supabase
 * - Push: Local changes → Supabase
 * - Pull: Supabase changes → Local
 * - Maintains local_id ↔ remote_id mapping
 * - User isolation via user_id filtering
 */
export class SupabaseDataSync {
  private store: MergeableStore;
  private userId: string;
  private onProgress?: (progress: SyncProgress) => void;
  private onError?: (error: Error, table: string) => void;
  private isSyncing = false;
  // Cache: tableName -> Map<remoteId, localId> — rebuilt per sync cycle
  private remoteIdCache: Map<string, Map<string, string>> = new Map();

  constructor(store: MergeableStore, options: SupabaseSyncOptions) {
    this.store = store;
    this.userId = options.userId;
    this.onProgress = options.onProgress;
    this.onError = options.onError;
  }

  /**
   * Check if sync is available
   */
  isAvailable(): boolean {
    return Boolean(supabase) && Boolean(this.userId);
  }

  /**
   * Full bidirectional sync
   */
  async sync(): Promise<void> {
    if (!this.isAvailable()) {
      console.log('[SupabaseSync] sync() skipped - not available');
      return;
    }
    if (this.isSyncing) {
      console.log('[SupabaseSync] sync() skipped - already syncing');
      return;
    }

    console.log('[SupabaseSync] sync() starting...');
    this.isSyncing = true;
    try {
      // Build remote_id lookup cache for O(1) lookups during sync
      this.buildRemoteIdCache();
      // Push local pending changes first
      await this.pushChanges();
      // Rebuild cache after push so pull sees newly assigned remote_ids
      this.buildRemoteIdCache();
      // Then pull remote changes
      await this.pullChanges();
      // Update last synced timestamp
      this.store.setValue('last_synced_at', now());
      console.log('[SupabaseSync] sync() completed successfully');
    } finally {
      this.remoteIdCache.clear();
      this.isSyncing = false;
    }
  }

  /**
   * Build a cache of remote_id -> local_id for all tables, enabling O(1) lookups
   */
  private buildRemoteIdCache(): void {
    this.remoteIdCache.clear();
    const tableNames: SyncTable[] = ['notes', 'labels', 'contacts', 'note_versions', 'note_actions', 'note_labels', 'note_assignees', 'projects'];
    for (const tableName of tableNames) {
      const table = this.store.getTable(tableName) || {};
      const cache = new Map<string, string>();
      for (const [localId, row] of Object.entries(table)) {
        const remoteId = (row as Record<string, unknown>).remote_id as string | undefined;
        if (remoteId) {
          cache.set(remoteId, localId);
        }
      }
      this.remoteIdCache.set(tableName, cache);
    }
  }

  /**
   * Push all local pending changes to Supabase
   */
  async pushChanges(): Promise<void> {
    if (!supabase) return;

    const tables: SyncTable[] = ['contacts', 'labels', 'projects', 'notes', 'note_labels', 'note_assignees', 'note_versions', 'note_actions'];

    for (const tableName of tables) {
      try {
        await this.pushTable(tableName);
      } catch (error) {
        console.error(`[SupabaseSync] Error pushing ${tableName}:`, error);
        this.onError?.(error instanceof Error ? error : new Error(JSON.stringify(error)), tableName);
      }
    }
  }

  /**
   * Push a single table's pending changes
   */
  private async pushTable(tableName: SyncTable): Promise<void> {
    if (!supabase) return;

    const table = this.store.getTable(tableName);
    const rows = Object.entries(table || {});
    const pendingRows = rows.filter(([, row]) => {
      const syncStatus = (row as Record<string, unknown>).sync_status as SyncStatus | undefined;
      return syncStatus === 'local' || syncStatus === 'pending';
    });

    if (pendingRows.length > 0) {
      console.log(`[SupabaseSync] pushTable(${tableName}): ${pendingRows.length} pending rows`);
    }

    let processed = 0;
    for (const [localId, row] of pendingRows) {
      try {
        console.log(`[SupabaseSync] pushRow(${tableName}, ${localId})`);
        await this.pushRow(tableName, localId, row as Record<string, unknown>);
      } catch (error) {
        console.error(`[SupabaseSync] Error pushing row ${localId} in ${tableName}:`, error);
        this.onError?.(error instanceof Error ? error : new Error(JSON.stringify(error)), tableName);
      }
      processed++;
      this.onProgress?.({ table: tableName, current: processed, total: pendingRows.length });
    }
  }

  /**
   * Push a single row to Supabase
   */
  private async pushRow(
    tableName: SyncTable,
    localId: string,
    row: Record<string, unknown>
  ): Promise<void> {
    if (!supabase) return;
    const client = supabase;

    const remoteId = row.remote_id as string | null;
    const deletedAt = row.deleted_at as string | null;

    // Prepare data for Supabase (remove local-only fields, map FKs)
    const supabaseData = await this.prepareForSupabase(tableName, localId, row);

    // Skip if required foreign keys couldn't be mapped (e.g., referenced note not synced yet)
    if (!supabaseData) {
      console.warn(`[SupabaseSync] pushRow(${tableName}, ${localId}) skipped - prepareForSupabase returned null`);
      return;
    }

    // Repair notes with missing required 'date' field (corrupt data)
    if (tableName === 'notes' && !supabaseData.date) {
      const repairDate = (row.created_at as string)?.slice(0, 10) || new Date().toISOString().slice(0, 10);
      console.warn(`[SupabaseSync] Repairing note ${localId}: setting date to ${repairDate}`);
      this.store.setPartialRow('notes', localId, { date: repairDate });
      supabaseData.date = repairDate;
    }

    // Special handling for note_labels and note_assignees (junction tables with composite primary key)
    if (tableName === 'note_labels' || tableName === 'note_assignees') {
      // note_labels uses composite key (note_id, label_id), no separate id field
      // note_assignees uses composite key (note_id, contact_id), no separate id field
      const secondKey = tableName === 'note_labels' ? 'label_id' : 'contact_id';
      
      // Check if exists by matching both keys
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (client as any)
        .from(tableName)
        .select('*')
        .eq('note_id', supabaseData.note_id as string)
        .eq(secondKey, supabaseData[secondKey] as string)
        .eq('user_id', this.userId)
        .maybeSingle();

      if (existing.data) {
        // Already exists, just mark as synced
        console.log(`[SupabaseSync] ${tableName} ${localId} already exists in Supabase, marking synced`);
        this.markSynced(tableName, localId);
      } else {
        // Insert new record
        console.log(`[SupabaseSync] ${tableName} ${localId} inserting to Supabase...`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (client as any)
          .from(tableName)
          .insert({ ...supabaseData, user_id: this.userId });

        if (error) {
          console.error(`[SupabaseSync] ${tableName} ${localId} insert error:`, error);
          throw error;
        }
        console.log(`[SupabaseSync] ${tableName} ${localId} inserted successfully`);
        this.markSynced(tableName, localId);
      }
      return; // Exit early for junction tables
    }

    if (deletedAt) {
      // Soft delete - update with deleted_at timestamp
      if (remoteId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (client.from(tableName as any) as any)
          .update({ deleted_at: deletedAt, updated_at: now() })
          .eq('id', remoteId);

        if (error) throw error;
        this.markSynced(tableName, localId);
      } else {
        // Deleted locally before ever being pushed — nothing to delete remotely
        this.markSynced(tableName, localId);
      }
    } else if (remoteId) {
      // Update existing record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error} = await (client.from(tableName as any) as any).update(supabaseData).eq('id', remoteId);

      if (error) throw error;
      this.markSynced(tableName, localId);
    } else {
      // Insert new record
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (client.from(tableName) as any)
        .insert({ ...supabaseData, user_id: this.userId })
        .select('id')
        .single();

      if (error) throw error;

      // Store the remote_id
      if (data?.id) {
        this.store.setPartialRow(tableName, localId, {
          remote_id: data.id,
          sync_status: 'synced',
          last_synced_at: now(),
        });
      }
    }
  }

  /**
   * Prepare row data for Supabase (map foreign keys, remove local fields)
   */
  private async prepareForSupabase(
    tableName: SyncTable,
    _localId: string,
    row: Record<string, unknown>
  ): Promise<Record<string, unknown> | null> {
    const data = { ...row };

    // Remove local-only fields
    delete data.remote_id;
    delete data.sync_status;
    delete data.last_synced_at;

    // Map foreign keys
    if (tableName === 'notes') {
      if (data.assignee_id) {
        const contact = this.store.getRow('contacts', data.assignee_id as string);
        if (contact?.remote_id) {
          data.assignee_id = contact.remote_id;
        } else {
          data.assignee_id = null; // Can't map, clear it
        }
      }
      if (data.project_id) {
        const project = this.store.getRow('projects', data.project_id as string);
        if (project?.remote_id) {
          data.project_id = project.remote_id;
        } else {
          data.project_id = null; // Can't map, clear it
        }
      }
    }

    if (tableName === 'note_labels') {
      const noteLocalId = data.note_id as string;
      const labelLocalId = data.label_id as string;
      const note = this.store.getRow('notes', noteLocalId);
      const label = this.store.getRow('labels', labelLocalId);

      if (!note) {
        console.warn(`[SupabaseSync] note_labels: note not found for local_id=${noteLocalId}`);
        return null;
      }
      if (!label) {
        console.warn(`[SupabaseSync] note_labels: label not found for local_id=${labelLocalId}`);
        return null;
      }
      if (!note.remote_id) {
        console.warn(`[SupabaseSync] note_labels: note ${noteLocalId} has no remote_id (sync_status=${note.sync_status})`);
        return null;
      }
      if (!label.remote_id) {
        console.warn(`[SupabaseSync] note_labels: label ${labelLocalId} has no remote_id (sync_status=${label.sync_status})`);
        return null;
      }

      data.note_id = note.remote_id;
      data.label_id = label.remote_id;
    }

    if (tableName === 'note_assignees') {
      const noteLocalId = data.note_id as string;
      const contactLocalId = data.contact_id as string;
      const note = this.store.getRow('notes', noteLocalId);
      const contact = this.store.getRow('contacts', contactLocalId);

      if (!note) {
        console.warn(`[SupabaseSync] note_assignees: note not found for local_id=${noteLocalId}`);
        return null;
      }
      if (!contact) {
        console.warn(`[SupabaseSync] note_assignees: contact not found for local_id=${contactLocalId}`);
        return null;
      }
      if (!note.remote_id) {
        console.warn(`[SupabaseSync] note_assignees: note ${noteLocalId} has no remote_id (sync_status=${note.sync_status})`);
        return null;
      }
      if (!contact.remote_id) {
        console.warn(`[SupabaseSync] note_assignees: contact ${contactLocalId} has no remote_id (sync_status=${contact.sync_status})`);
        return null;
      }

      data.note_id = note.remote_id;
      data.contact_id = contact.remote_id;
    }

    // Map foreign keys for history tables
    if (tableName === 'note_versions' || tableName === 'note_actions') {
      const note = this.store.getRow('notes', data.note_id as string);
      if (!note?.remote_id) return null; // Can't push without mapped note FK
      data.note_id = note.remote_id;
    }

    return data;
  }

  /**
   * Mark a row as synced
   */
  private markSynced(tableName: string, localId: string): void {
    this.store.setPartialRow(tableName, localId, {
      sync_status: 'synced',
      last_synced_at: now(),
    });
  }

  /**
   * Pull changes from Supabase
   */
  async pullChanges(): Promise<void> {
    if (!supabase) return;

    const lastSyncedAt = this.store.getValue('last_synced_at') as string | undefined;

    // Pull in order to satisfy foreign key dependencies
    await this.pullTable('contacts', lastSyncedAt);
    await this.pullTable('labels', lastSyncedAt);
    await this.pullTable('projects', lastSyncedAt);
    await this.pullTable('notes', lastSyncedAt);
    await this.pullTable('note_labels', lastSyncedAt);
    await this.pullTable('note_assignees', lastSyncedAt);
    await this.pullTable('note_versions', lastSyncedAt);
    await this.pullTable('note_actions', lastSyncedAt);
  }

  /**
   * Pull a single table from Supabase
   */
  private async pullTable(tableName: SyncTable, lastSyncedAt?: string): Promise<void> {
    if (!supabase) return;

    try {
      let query = (supabase.from(tableName as any) as any).select('*').eq('user_id', this.userId);

      // Incremental sync if we have a last sync timestamp
      // Use gte (greater than or equal) to include changes at the exact same timestamp
      if (lastSyncedAt) {
        // Check if table uses created_at instead of updated_at (junction tables usually)
        const useCreatedAt = ['note_versions', 'note_actions', 'note_labels', 'note_assignees'].includes(tableName);
        
        query = query.gte(useCreatedAt ? 'created_at' : 'updated_at', lastSyncedAt);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Batch all store updates in a transaction so listeners fire once, not per-row
      this.store.startTransaction();
      try {
        for (const remoteRow of data || []) {
          await this.mergeRemoteRow(tableName, remoteRow);
        }
      } finally {
        this.store.finishTransaction();
      }
    } catch (error) {
      console.error(`[SupabaseSync] Error pulling ${tableName}:`, error);
      this.onError?.(error instanceof Error ? error : new Error(JSON.stringify(error)), tableName);
    }
  }

  /**
   * Merge a remote row into the local store
   */
  private async mergeRemoteRow(
    tableName: SyncTable,
    remoteRow: Record<string, unknown>
  ): Promise<void> {
    const remoteId = remoteRow.id as string;

    // Handle junction tables which might not have an 'id' or we need to look up by composite key
    if (!remoteId && (tableName === 'note_labels' || tableName === 'note_assignees')) {
        return this.mergeJoinTableRow(tableName, remoteRow);
    }

    // Find existing local row by remote_id (O(1) via cache)
    const existingLocalId = this.findLocalIdByRemoteId(tableName, remoteId);

    // Map foreign keys from remote to local IDs
    const localData = await this.mapFromSupabase(tableName, remoteRow);

    if (existingLocalId) {
      // Check for conflicts - compare timestamps
      const localRow = this.store.getRow(tableName, existingLocalId);
      const localUpdatedAt = new Date((localRow?.updated_at as string) || 0);
      const remoteUpdatedAt = new Date((remoteRow.updated_at as string) || 0);
      const localSyncStatus = localRow?.sync_status as SyncStatus;

      // Only update if remote is newer AND local doesn't have pending changes
      if (remoteUpdatedAt > localUpdatedAt && localSyncStatus !== 'pending') {
        this.store.setRow(tableName, existingLocalId, {
          ...localData,
          remote_id: remoteId,
          sync_status: 'synced',
          last_synced_at: now(),
        });
      }
    } else {
      // Insert new row from remote
      const localId = generateId();
      this.store.setRow(tableName, localId, {
        ...localData,
        remote_id: remoteId,
        sync_status: 'synced',
        last_synced_at: now(),
      });
      // Update cache with new mapping
      this.remoteIdCache.get(tableName)?.set(remoteId, localId);
    }
  }

  private async mergeJoinTableRow(tableName: SyncTable, remoteRow: Record<string, unknown>): Promise<void> {
      // Specialized merge for tables without ID (note_labels, note_assignees)
      const remoteNoteId = remoteRow.note_id as string;
      const secondKey = tableName === 'note_labels' ? 'label_id' : 'contact_id';
      const secondTable = tableName === 'note_labels' ? 'labels' : 'contacts';
      const remoteSecondId = remoteRow[secondKey] as string;

      // Map remote IDs to local IDs
      const localNoteId = this.findLocalIdByRemoteId('notes', remoteNoteId);
      const localSecondId = this.findLocalIdByRemoteId(secondTable, remoteSecondId);

      // Skip if we can't map both FKs - the referenced note/contact hasn't been synced yet
      if (!localNoteId) {
        console.warn(`[SupabaseSync] mergeJoinTableRow(${tableName}): note not found for remote_id=${remoteNoteId}`);
        return;
      }
      if (!localSecondId) {
        console.warn(`[SupabaseSync] mergeJoinTableRow(${tableName}): ${secondTable} not found for remote_id=${remoteSecondId}`);
        return;
      }

      // Check if exists locally
      const table = this.store.getTable(tableName) || {};
      const exists = Object.values(table).some((row) =>
          (row as Record<string, unknown>).note_id === localNoteId && (row as Record<string, unknown>)[secondKey] === localSecondId
      );

      if (!exists) {
           const localId = `${localNoteId}-${localSecondId}`; // Consistent ID generation for join tables
           console.log(`[SupabaseSync] mergeJoinTableRow(${tableName}): creating local record ${localId}`);
           this.store.setRow(tableName, localId, {
               note_id: localNoteId,
               [secondKey]: localSecondId,
               created_at: remoteRow.created_at || now(),
               sync_status: 'synced',
               last_synced_at: now()
           });
      }
  }

  /**
   * Map remote row data to local format (reverse foreign key mapping)
   */
  private async mapFromSupabase(
    tableName: SyncTable,
    remoteRow: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const data = { ...remoteRow };

    // Remove Supabase-specific fields
    delete data.id;
    delete data.user_id;

    // Map foreign keys from remote to local IDs
    if (tableName === 'notes') {
      if (data.assignee_id) {
        const localContactId = this.findLocalIdByRemoteId('contacts', data.assignee_id as string);
        data.assignee_id = localContactId || null;
      }
      if (data.project_id) {
        const localProjectId = this.findLocalIdByRemoteId('projects', data.project_id as string);
        data.project_id = localProjectId || null;
      }
    }

    // Note: note_labels and note_assignees are handled directly in mergeJoinTableRow
    // which does proper FK validation before creating local records

    // Reverse map foreign keys for new history tables
    if (tableName === 'note_versions' || tableName === 'note_actions') {
      const localNoteId = this.findLocalIdByRemoteId('notes', data.note_id as string);
      if (localNoteId) {
        data.note_id = localNoteId;
      }
    }

    return data;
  }

  /**
   * Find local ID by remote ID
   */
  private findLocalIdByRemoteId(tableName: string, remoteId: string): string | null {
    const cache = this.remoteIdCache.get(tableName);
    if (cache) {
      return cache.get(remoteId) ?? null;
    }
    // Fallback: linear scan if cache not built
    const table = this.store.getTable(tableName) || {};
    for (const [localId, row] of Object.entries(table)) {
      if ((row as Record<string, unknown>).remote_id === remoteId) {
        return localId;
      }
    }
    return null;
  }

  /**
   * Pull all data from Supabase (full sync, ignoring timestamps)
   */
  async pullAll(onProgress?: (progress: SyncProgress) => void): Promise<void> {
    if (!supabase) return;

    this.isSyncing = true;
    try {
      // Build cache for remote_id → local_id mapping used during merge
      this.buildRemoteIdCache();

      const tables: SyncTable[] = ['contacts', 'labels', 'projects', 'notes', 'note_labels', 'note_assignees', 'note_versions', 'note_actions'];

      // Tables that don't have a deleted_at column (junction/history tables)
      const tablesWithoutDeletedAt = ['note_labels', 'note_assignees', 'note_versions', 'note_actions'];

      for (const tableName of tables) {
        let query = (supabase.from(tableName as any) as any)
          .select('*')
          .eq('user_id', this.userId);

        // Only filter by deleted_at for tables that have this column
        if (!tablesWithoutDeletedAt.includes(tableName)) {
          query = query.is('deleted_at', null);
        }

        const { data, error } = await query;

        if (error) {
          console.error(`[SupabaseSync] Error pulling all ${tableName}:`, error);
          continue;
        }

        const total = data?.length || 0;
        let current = 0;

        for (const remoteRow of data || []) {
          await this.mergeRemoteRow(tableName, remoteRow);
          current++;
          onProgress?.({ table: tableName, current, total });
        }
      }

      this.store.setValue('last_synced_at', now());
    } finally {
      this.remoteIdCache.clear();
      this.isSyncing = false;
    }
  }

  /**
   * Push all data to Supabase (full sync)
   */
  async pushAll(onProgress?: (progress: SyncProgress) => void): Promise<void> {
    if (!supabase) return;

    this.isSyncing = true;
    try {
      const tables: SyncTable[] = ['contacts', 'labels', 'projects', 'notes', 'note_labels', 'note_assignees', 'note_versions', 'note_actions'];

      for (const tableName of tables) {
        const table = this.store.getTable(tableName) || {};
        const rows = Object.entries(table);
        const total = rows.length;
        let current = 0;

        for (const [localId, row] of rows) {
          // Mark as pending first
          this.store.setCell(tableName, localId, 'sync_status', 'pending');
          await this.pushRow(tableName, localId, row as Record<string, unknown>);
          current++;
          onProgress?.({ table: tableName, current, total });
        }
      }

      this.store.setValue('last_synced_at', now());
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get sync status
   */
  getSyncStatus(): { isSyncing: boolean; lastSyncedAt: string | null } {
    return {
      isSyncing: this.isSyncing,
      lastSyncedAt: (this.store.getValue('last_synced_at') as string) || null,
    };
  }
}

/**
 * Create a SupabaseDataSync instance
 */
export function createSupabaseSync(
  store: MergeableStore,
  options: SupabaseSyncOptions
): SupabaseDataSync {
  return new SupabaseDataSync(store, options);
}
