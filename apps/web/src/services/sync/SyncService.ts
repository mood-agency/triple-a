import type { MergeableStore } from 'tinybase';
import { supabase } from '@/lib/supabase';
import { now } from '@/store/schema';
import { SyncBatcher } from './SyncBatcher';
import { SyncConflictResolver } from './SyncConflictResolver';
import { SyncDeletionHandler } from './SyncDeletionHandler';
import { SyncFKMapper } from './SyncFKMapper';
import { SyncQueue } from './SyncQueue';
import { SyncRealtimeHandler } from './SyncRealtimeHandler';
import type {
  ConflictCallback,
  ConflictResolution,
  ErrorCallback,
  PreparedRow,
  ProgressCallback,
  RemoteIdCache,
  SyncConflict,
  SyncProgress,
  SyncServiceConfig,
  SyncStatus,
  SyncTable,
} from './types';
import { DEFAULT_SYNC_CONFIG, TABLE_PUSH_ORDER } from './types';

/**
 * SyncService is the main orchestrator for bidirectional sync between
 * TinyBase (local) and Supabase (remote).
 *
 * Features:
 * - Batched operations for efficiency
 * - Retry queue with exponential backoff
 * - Proper FK ordering (parents before children)
 * - Conflict detection and resolution
 * - Remote deletion sync
 * - Realtime subscriptions for push notifications
 */
export class SyncService {
  private static instance: SyncService | null = null;

  private store: MergeableStore;
  private userId: string;
  private config: SyncServiceConfig;

  private queue: SyncQueue;
  private batcher: SyncBatcher;
  private fkMapper: SyncFKMapper;
  private conflictResolver: SyncConflictResolver;
  private deletionHandler: SyncDeletionHandler;
  private realtimeHandler: SyncRealtimeHandler;

  private isSyncing = false;
  private remoteIdCache: RemoteIdCache = new Map();

  // Callbacks
  private progressCallbacks = new Set<ProgressCallback>();
  private conflictCallbacks = new Set<ConflictCallback>();
  private errorCallbacks = new Set<ErrorCallback>();

  private constructor(
    store: MergeableStore,
    userId: string,
    config: SyncServiceConfig
  ) {
    this.store = store;
    this.userId = userId;
    this.config = config;

    // Initialize modules
    this.queue = new SyncQueue(config);
    this.batcher = new SyncBatcher(userId, config);
    this.fkMapper = new SyncFKMapper(store);
    this.conflictResolver = new SyncConflictResolver(store);
    this.deletionHandler = new SyncDeletionHandler(store, userId, config);
    this.realtimeHandler = new SyncRealtimeHandler(userId);

    // Wire up conflict notifications
    this.conflictResolver.setConflictCallback((conflict) => {
      this.notifyConflict(conflict);
    });
  }

  /**
   * Get the singleton instance (null if not initialized).
   */
  static getInstance(): SyncService | null {
    return SyncService.instance;
  }

  /**
   * Initialize the SyncService singleton.
   */
  static initialize(
    store: MergeableStore,
    userId: string,
    config: Partial<SyncServiceConfig> = {}
  ): SyncService {
    if (SyncService.instance) {
      // Already initialized, check if same user
      if (SyncService.instance.userId !== userId) {
        // Different user, destroy and recreate
        SyncService.destroy();
      } else {
        return SyncService.instance;
      }
    }

    const fullConfig = { ...DEFAULT_SYNC_CONFIG, ...config };
    SyncService.instance = new SyncService(store, userId, fullConfig);
    return SyncService.instance;
  }

  /**
   * Destroy the singleton instance.
   */
  static destroy(): void {
    if (SyncService.instance) {
      SyncService.instance.cleanup();
      SyncService.instance = null;
    }
  }

  /**
   * Check if sync is available.
   */
  isAvailable(): boolean {
    return Boolean(supabase) && Boolean(this.userId);
  }

  /**
   * Full bidirectional sync.
   */
  async sync(): Promise<void> {
    if (!this.isAvailable()) {
      console.log('[SyncService] sync() skipped - not available');
      return;
    }

    if (this.isSyncing) {
      console.log('[SyncService] sync() skipped - already syncing');
      return;
    }

    console.log('[SyncService] sync() starting...');
    this.isSyncing = true;

    try {
      // 1. Build remote_id cache
      this.remoteIdCache = this.fkMapper.buildRemoteIdCache();

      // 2. Process retry queue
      await this.processRetryQueue();

      // 3. Push local changes
      await this.pushChanges();

      // 4. Rebuild cache (new remote_ids from push)
      this.remoteIdCache = this.fkMapper.buildRemoteIdCache();

      // 5. Pull remote changes
      await this.pullChanges();

      // 6. Sync remote deletions
      await this.deletionHandler.syncDeletions();

      // 7. Update timestamp
      this.store.setValue('last_synced_at', now());

      // 8. Broadcast to other tabs
      this.realtimeHandler.broadcastSyncNeeded();

      this.notifyProgress({ phase: 'idle', current: 0, total: 0 });
      console.log('[SyncService] sync() completed successfully');
    } catch (error) {
      console.error('[SyncService] sync() error:', error);
      this.notifyError(
        error instanceof Error ? error : new Error(String(error)),
        'notes'
      );
    } finally {
      this.remoteIdCache.clear();
      this.isSyncing = false;
    }
  }

  /**
   * Push all pending local changes to Supabase.
   */
  private async pushChanges(): Promise<void> {
    for (const table of TABLE_PUSH_ORDER) {
      try {
        await this.pushTable(table);
      } catch (error) {
        console.error(`[SyncService] Error pushing ${table}:`, error);
        this.notifyError(
          error instanceof Error ? error : new Error(String(error)),
          table
        );
      }
    }
  }

  /**
   * Push a single table's pending changes.
   */
  private async pushTable(table: SyncTable): Promise<void> {
    const tableData = this.store.getTable(table) || {};
    const pendingRows = Object.entries(tableData).filter(([, row]) => {
      const syncStatus = (row as Record<string, unknown>)
        .sync_status as SyncStatus;
      return syncStatus === 'local' || syncStatus === 'pending';
    });

    if (pendingRows.length === 0) return;

    console.log(`[SyncService] pushTable(${table}): ${pendingRows.length} rows`);
    this.notifyProgress({
      phase: 'push',
      table,
      current: 0,
      total: pendingRows.length,
    });

    // Prepare rows for push
    const prepared: PreparedRow[] = [];

    for (const [localId, row] of pendingRows) {
      const rowData = row as Record<string, unknown>;

      // Repair notes with missing date
      if (table === 'notes' && !rowData.date) {
        const repairDate =
          (rowData.created_at as string)?.slice(0, 10) ||
          new Date().toISOString().slice(0, 10);
        console.warn(
          `[SyncService] Repairing note ${localId}: setting date to ${repairDate}`
        );
        this.store.setCell('notes', localId, 'date', repairDate);
        rowData.date = repairDate;
      }

      const preparedRow = this.fkMapper.prepareForPush(
        table,
        localId,
        rowData,
        this.remoteIdCache
      );

      if (preparedRow) {
        prepared.push(preparedRow);
      } else {
        // FK not ready, queue for retry
        this.queue.enqueue({
          table,
          operation: rowData.deleted_at ? 'delete' : 'upsert',
          localId,
          data: rowData,
          lastError: 'Foreign key not ready',
        });
      }
    }

    if (prepared.length === 0) return;

    // Execute batch
    const results = await this.batcher.executeBatch(table, prepared);

    // Process results
    let processed = 0;
    for (const result of results) {
      if (result.success) {
        // Update local row with remote_id and synced status
        const existingRemoteId = this.store.getCell(table, result.localId, 'remote_id') as string | undefined;
        this.store.setPartialRow(table, result.localId, {
          remote_id: result.remoteId || existingRemoteId || null,
          sync_status: 'synced',
          last_synced_at: now(),
        });

        // Remove from retry queue if present
        this.queue.removeByLocalId(table, result.localId);
      } else {
        // Queue for retry
        this.queue.enqueue({
          table,
          operation: result.isDelete ? 'delete' : 'upsert',
          localId: result.localId,
          data: result.data,
          lastError: result.error,
        });
      }

      processed++;
      this.notifyProgress({
        phase: 'push',
        table,
        current: processed,
        total: pendingRows.length,
      });
    }
  }

  /**
   * Pull changes from Supabase.
   */
  private async pullChanges(): Promise<void> {
    const lastSyncedAt = this.store.getValue('last_synced_at') as
      | string
      | undefined;

    for (const table of TABLE_PUSH_ORDER) {
      try {
        await this.pullTable(table, lastSyncedAt);
      } catch (error) {
        console.error(`[SyncService] Error pulling ${table}:`, error);
        this.notifyError(
          error instanceof Error ? error : new Error(String(error)),
          table
        );
      }
    }
  }

  /**
   * Pull a single table from Supabase.
   */
  private async pullTable(table: SyncTable, since?: string): Promise<void> {
    const remoteRows = await this.batcher.fetchChanges(table, since);

    if (remoteRows.length === 0) return;

    console.log(`[SyncService] pullTable(${table}): ${remoteRows.length} rows`);
    this.notifyProgress({
      phase: 'pull',
      table,
      current: 0,
      total: remoteRows.length,
    });

    // Batch all updates in a transaction
    this.store.startTransaction();
    try {
      let processed = 0;
      for (const remoteRow of remoteRows) {
        this.conflictResolver.mergeRemoteRow(
          table,
          remoteRow,
          this.remoteIdCache
        );
        processed++;
        this.notifyProgress({
          phase: 'pull',
          table,
          current: processed,
          total: remoteRows.length,
        });
      }
    } finally {
      this.store.finishTransaction();
    }
  }

  /**
   * Process items in the retry queue.
   */
  private async processRetryQueue(): Promise<void> {
    const readyItems = this.queue.getReadyItems();

    if (readyItems.length === 0) return;

    console.log(`[SyncService] Processing ${readyItems.length} retry items`);

    // Group by table for batch processing
    const byTable = new Map<SyncTable, typeof readyItems>();
    for (const item of readyItems) {
      if (!byTable.has(item.table)) {
        byTable.set(item.table, []);
      }
      byTable.get(item.table)!.push(item);
    }

    // Process each table
    for (const table of TABLE_PUSH_ORDER) {
      const items = byTable.get(table);
      if (!items || items.length === 0) continue;

      // Check if max retries exceeded
      const failedItems = items.filter(
        (i) => i.retryCount >= this.config.maxRetries
      );
      for (const failed of failedItems) {
        console.error(
          `[SyncService] Max retries exceeded for ${failed.table}:${failed.localId}`,
          failed.lastError
        );
        this.queue.remove(failed.id);
        this.notifyError(
          new Error(`Max retries exceeded: ${failed.lastError}`),
          failed.table
        );
      }

      // Prepare remaining items for push
      const toRetry = items.filter(
        (i) => i.retryCount < this.config.maxRetries
      );
      const prepared: PreparedRow[] = [];

      for (const item of toRetry) {
        const preparedRow = this.fkMapper.prepareForPush(
          item.table,
          item.localId,
          item.data,
          this.remoteIdCache
        );

        if (preparedRow) {
          prepared.push(preparedRow);
          this.queue.remove(item.id); // Will re-add if fails
        }
        // If still can't prepare, leave in queue for next cycle
      }

      if (prepared.length === 0) continue;

      // Execute batch
      const results = await this.batcher.executeBatch(table, prepared);

      for (const result of results) {
        if (result.success) {
          const existingRemoteId = this.store.getCell(table, result.localId, 'remote_id') as string | undefined;
          this.store.setPartialRow(table, result.localId, {
            remote_id: result.remoteId || existingRemoteId || null,
            sync_status: 'synced',
            last_synced_at: now(),
          });
        } else {
          // Re-queue with incremented retry count
          this.queue.enqueue({
            table,
            operation: result.isDelete ? 'delete' : 'upsert',
            localId: result.localId,
            data: result.data,
            lastError: result.error,
          });
        }
      }
    }
  }

  /**
   * Pull all data from Supabase (full sync, ignoring timestamps).
   */
  async pullAll(): Promise<void> {
    if (!this.isAvailable()) return;

    this.isSyncing = true;
    try {
      this.remoteIdCache = this.fkMapper.buildRemoteIdCache();

      for (const table of TABLE_PUSH_ORDER) {
        const remoteRows = await this.batcher.fetchChanges(table);

        this.store.startTransaction();
        try {
          for (const remoteRow of remoteRows) {
            this.conflictResolver.mergeRemoteRow(
              table,
              remoteRow,
              this.remoteIdCache
            );
          }
        } finally {
          this.store.finishTransaction();
        }
      }

      await this.deletionHandler.syncDeletions();
      this.store.setValue('last_synced_at', now());
    } finally {
      this.remoteIdCache.clear();
      this.isSyncing = false;
    }
  }

  /**
   * Push all local data to Supabase.
   */
  async pushAll(): Promise<void> {
    if (!this.isAvailable()) return;

    this.isSyncing = true;
    try {
      this.remoteIdCache = this.fkMapper.buildRemoteIdCache();

      for (const table of TABLE_PUSH_ORDER) {
        const tableData = this.store.getTable(table) || {};

        // Mark all as pending
        for (const localId of Object.keys(tableData)) {
          this.store.setCell(table, localId, 'sync_status', 'pending');
        }

        await this.pushTable(table);
      }

      this.store.setValue('last_synced_at', now());
    } finally {
      this.remoteIdCache.clear();
      this.isSyncing = false;
    }
  }

  /**
   * Subscribe to realtime changes.
   */
  subscribeToRealtime(): void {
    this.realtimeHandler.subscribe(() => {
      // Debounce sync trigger
      setTimeout(() => this.sync(), 1000);
    });
  }

  /**
   * Unsubscribe from realtime changes.
   */
  unsubscribeFromRealtime(): void {
    this.realtimeHandler.unsubscribe();
  }

  /**
   * Resolve a conflict.
   */
  resolveConflict(conflict: SyncConflict, resolution: ConflictResolution): void {
    this.remoteIdCache = this.fkMapper.buildRemoteIdCache();
    this.conflictResolver.resolveConflict(
      conflict,
      resolution,
      this.remoteIdCache
    );
    this.remoteIdCache.clear();
  }

  /**
   * Get sync status.
   */
  getStatus(): {
    isSyncing: boolean;
    lastSyncedAt: string | null;
    pendingQueueLength: number;
  } {
    return {
      isSyncing: this.isSyncing,
      lastSyncedAt: (this.store.getValue('last_synced_at') as string) || null,
      pendingQueueLength: this.queue.length,
    };
  }

  /**
   * Get the retry queue for diagnostics.
   */
  getRetryQueue(): ReturnType<SyncQueue['getAll']> {
    return this.queue.getAll();
  }

  // Callback management

  onProgress(callback: ProgressCallback): () => void {
    this.progressCallbacks.add(callback);
    return () => this.progressCallbacks.delete(callback);
  }

  onConflict(callback: ConflictCallback): () => void {
    this.conflictCallbacks.add(callback);
    return () => this.conflictCallbacks.delete(callback);
  }

  onError(callback: ErrorCallback): () => void {
    this.errorCallbacks.add(callback);
    return () => this.errorCallbacks.delete(callback);
  }

  private notifyProgress(progress: SyncProgress): void {
    this.progressCallbacks.forEach((cb) => cb(progress));
  }

  private notifyConflict(conflict: SyncConflict): void {
    this.conflictCallbacks.forEach((cb) => cb(conflict));
  }

  private notifyError(error: Error, table: SyncTable): void {
    this.errorCallbacks.forEach((cb) => cb(error, table));
  }

  /**
   * Cleanup resources.
   */
  private cleanup(): void {
    this.unsubscribeFromRealtime();
    this.progressCallbacks.clear();
    this.conflictCallbacks.clear();
    this.errorCallbacks.clear();
    this.remoteIdCache.clear();
  }
}
