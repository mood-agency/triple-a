import type { Database } from 'sql.js';
import { supabase } from '@/lib/supabase';
import type { PendingSyncOperation, SyncTable, SyncOperation } from '@/types/sync';
import { SyncOperationHandler } from './sync/SyncOperationHandler';
import { SyncMergeService } from './sync/SyncMergeService';
import { SyncBulkService } from './sync/SyncBulkService';

// Get supabase client - returns null if not configured
function getSupabaseClient() {
  return supabase;
}

// Type helpers for bypassing strict type inference issues with Supabase generics
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

/**
 * Main synchronization service orchestrator
 * Coordinates specialized sync services for operations, merging, and bulk operations
 */
export class SyncService {
  private db: Database;
  private isSyncing = false;

  // Specialized services
  private operationHandler: SyncOperationHandler;
  private mergeService: SyncMergeService;
  private bulkService: SyncBulkService;

  constructor(db: Database, userId: string) {
    this.db = db;

    const client = getSupabaseClient() as AnySupabaseClient;

    // Initialize specialized services
    this.operationHandler = new SyncOperationHandler(db, userId, client);
    this.mergeService = new SyncMergeService(db, userId, client);
    this.bulkService = new SyncBulkService(db, userId, client);
  }

  /**
   * Queue a sync operation to be processed later
   */
  async queueOperation(
    tableName: SyncTable,
    operation: SyncOperation,
    recordId: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO pending_sync (id, table_name, operation, record_id, data, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, tableName, operation, recordId, data ? JSON.stringify(data) : null, now]
    );
  }

  /**
   * Get all pending sync operations
   */
  getPendingOperations(): PendingSyncOperation[] {
    const result = this.db.exec(
      'SELECT id, table_name, operation, record_id, data, created_at, retry_count FROM pending_sync ORDER BY created_at ASC'
    );

    if (result.length === 0) return [];

    return result[0].values.map((row) => ({
      id: row[0] as string,
      table_name: row[1] as SyncTable,
      operation: row[2] as SyncOperation,
      record_id: row[3] as string,
      data: row[4] as string | null,
      created_at: row[5] as string,
      retry_count: row[6] as number,
    }));
  }

  /**
   * Get count of pending sync operations
   */
  getPendingCount(): number {
    const result = this.db.exec('SELECT COUNT(*) FROM pending_sync');
    if (result.length === 0) return 0;
    return result[0].values[0][0] as number;
  }

  /**
   * Remove a sync operation from the queue
   */
  private removeOperation(id: string): void {
    this.db.run('DELETE FROM pending_sync WHERE id = ?', [id]);
  }

  /**
   * Increment retry count for a failed operation
   */
  private incrementRetry(id: string): void {
    this.db.run('UPDATE pending_sync SET retry_count = retry_count + 1 WHERE id = ?', [id]);
  }

  /**
   * Main sync method: Push local changes, then pull remote changes
   */
  async sync(): Promise<{ success: boolean; error?: string }> {
    console.log('[SyncService] sync() called');
    if (!getSupabaseClient()) {
      console.log('[SyncService] No Supabase client');
      return { success: false, error: 'Supabase not configured' };
    }

    if (this.isSyncing) {
      console.log('[SyncService] Already syncing');
      return { success: false, error: 'Sync already in progress' };
    }

    this.isSyncing = true;

    try {
      // 1. Push local changes to remote
      console.log('[SyncService] Pushing changes...');
      await this.pushChanges();

      // 2. Pull remote changes
      console.log('[SyncService] Pulling changes...');
      await this.mergeService.pullChanges();

      // Update last sync time
      const now = new Date().toISOString();
      this.db.run(
        `INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_synced_at', ?)`,
        [now]
      );

      console.log('[SyncService] Sync completed successfully');
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error';
      console.error('[SyncService] Sync error:', error);
      return { success: false, error: message };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Push pending operations to Supabase
   */
  private async pushChanges(): Promise<void> {
    if (!getSupabaseClient()) return;

    const operations = this.getPendingOperations();
    console.log('[SyncService] Pending operations:', operations.length, operations);

    for (const op of operations) {
      try {
        console.log('[SyncService] Processing operation:', op);
        await this.operationHandler.processSyncOperation(op);
        this.removeOperation(op.id);
        console.log('[SyncService] Operation completed successfully');
      } catch (error) {
        console.error(`[SyncService] Sync operation failed:`, op, error);
        this.incrementRetry(op.id);

        if (op.retry_count >= 3) {
          this.removeOperation(op.id);
        }
      }
    }
  }

  /**
   * Get last synced timestamp
   */
  getLastSyncedAt(): string | null {
    const result = this.db.exec(`SELECT value FROM sync_state WHERE key = 'last_synced_at'`);
    return result[0]?.values[0]?.[0] as string | null;
  }

  /**
   * One-way sync: Pull all data from Supabase (ignores lastSyncedAt)
   */
  async pullAllFromSupabase(
    onProgress?: (current: number, total: number, item: string) => void
  ): Promise<{ success: boolean; error?: string; pulled: { notes: number; labels: number; noteLabels: number } }> {
    return this.bulkService.pullAllFromSupabase(onProgress);
  }

  /**
   * One-way sync: Push all local data to Supabase
   */
  async pushAllToSupabase(
    onProgress?: (current: number, total: number, item: string) => void
  ): Promise<{ success: boolean; error?: string; pushed: { notes: number; labels: number; noteLabels: number; noteHistory: number } }> {
    return this.bulkService.pushAllToSupabase(onProgress);
  }
}
