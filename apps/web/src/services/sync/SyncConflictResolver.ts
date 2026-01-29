import type { MergeableStore } from 'tinybase';
import { generateId, now } from '@/store/schema';
import type {
  ConflictCallback,
  ConflictResolution,
  RemoteIdCache,
  SyncConflict,
  SyncStatus,
  SyncTable,
} from './types';
import { SyncFKMapper } from './SyncFKMapper';

/**
 * SyncConflictResolver detects and resolves sync conflicts.
 */
export class SyncConflictResolver {
  private store: MergeableStore;
  private fkMapper: SyncFKMapper;
  private conflictCallback: ConflictCallback | null = null;

  constructor(store: MergeableStore) {
    this.store = store;
    this.fkMapper = new SyncFKMapper(store);
  }

  /**
   * Set the callback for conflict notifications.
   */
  setConflictCallback(callback: ConflictCallback): void {
    this.conflictCallback = callback;
  }

  /**
   * Merge a remote row into the local store.
   * Returns a SyncConflict if one is detected, null otherwise.
   */
  mergeRemoteRow(
    table: SyncTable,
    remoteRow: Record<string, unknown>,
    cache: RemoteIdCache
  ): SyncConflict | null {
    const remoteId = remoteRow.id as string;

    // Handle junction tables (no id field)
    if (!remoteId && (table === 'note_labels' || table === 'note_assignees')) {
      this.mergeJunctionRow(table, remoteRow, cache);
      return null;
    }

    // Find existing local row
    const existingLocalId = this.fkMapper.findLocalIdByRemoteId(
      table,
      remoteId,
      cache
    );

    // Map remote row to local format
    const localData = this.fkMapper.mapFromRemote(table, remoteRow, cache);

    if (existingLocalId) {
      // Check for conflicts
      const localRow = this.store.getRow(table, existingLocalId);
      const localSyncStatus = localRow?.sync_status as SyncStatus;
      const localUpdatedAt = new Date(
        (localRow?.updated_at as string) || 0
      ).getTime();
      const remoteUpdatedAt = new Date(
        (remoteRow.updated_at as string) || 0
      ).getTime();

      if (localSyncStatus === 'pending') {
        // Conflict: local has uncommitted changes
        const conflict: SyncConflict = {
          id: generateId(),
          table,
          localId: existingLocalId,
          remoteId,
          localData: { ...localRow } as Record<string, unknown>,
          remoteData: remoteRow,
          localUpdatedAt: (localRow?.updated_at as string) || '',
          remoteUpdatedAt: (remoteRow.updated_at as string) || '',
          detectedAt: now(),
        };

        // Notify via callback
        this.conflictCallback?.(conflict);

        // Default: keep local pending, don't overwrite
        return conflict;
      }

      // No conflict - update if remote is newer
      if (remoteUpdatedAt > localUpdatedAt) {
        this.store.setRow(table, existingLocalId, {
          ...localData,
          remote_id: remoteId,
          sync_status: 'synced',
          last_synced_at: now(),
        });

        // Update cache
        cache.get(table)?.set(remoteId, existingLocalId);
      }
    } else {
      // New record from remote
      const localId = generateId();
      this.store.setRow(table, localId, {
        ...localData,
        remote_id: remoteId,
        sync_status: 'synced',
        last_synced_at: now(),
      });

      // Update cache
      cache.get(table)?.set(remoteId, localId);
    }

    return null;
  }

  /**
   * Merge a junction table row (note_labels, note_assignees).
   */
  private mergeJunctionRow(
    table: 'note_labels' | 'note_assignees',
    remoteRow: Record<string, unknown>,
    cache: RemoteIdCache
  ): void {
    const mapped = this.fkMapper.mapJunctionFromRemote(table, remoteRow, cache);

    if (!mapped) {
      // Can't map FKs, skip
      console.warn(
        `[SyncConflictResolver] Junction row skipped - FKs not found:`,
        remoteRow
      );
      return;
    }

    const { noteId, secondId, data } = mapped;
    const secondKey = table === 'note_labels' ? 'label_id' : 'contact_id';

    // Check if already exists locally
    const localTable = this.store.getTable(table) || {};
    const exists = Object.values(localTable).some(
      (row) =>
        (row as Record<string, unknown>).note_id === noteId &&
        (row as Record<string, unknown>)[secondKey] === secondId
    );

    if (!exists) {
      // Create local record
      const localId = `${noteId}-${secondId}`;
      this.store.setRow(table, localId, {
        ...data,
        sync_status: 'synced',
        last_synced_at: now(),
      });
    }
  }

  /**
   * Resolve a conflict with the specified resolution.
   */
  resolveConflict(
    conflict: SyncConflict,
    resolution: ConflictResolution,
    cache: RemoteIdCache
  ): void {
    const { table, localId, remoteId, remoteData } = conflict;

    switch (resolution) {
      case 'keep_local': {
        // Mark local as pending to push to remote
        this.store.setCell(table, localId, 'sync_status', 'pending');
        break;
      }

      case 'keep_remote': {
        // Overwrite local with remote data
        const localData = this.fkMapper.mapFromRemote(table, remoteData, cache);
        this.store.setRow(table, localId, {
          ...localData,
          remote_id: remoteId,
          sync_status: 'synced',
          last_synced_at: now(),
        });
        break;
      }
    }
  }
}
