import { supabase } from '@/lib/supabase';
import { now } from '@/store/schema';
import type {
  BatchResult,
  PreparedRow,
  SyncServiceConfig,
  SyncTable,
} from './types';
import { JUNCTION_TABLES } from './types';

/**
 * SyncBatcher handles batched Supabase operations for efficient sync.
 */
export class SyncBatcher {
  private config: SyncServiceConfig;
  private userId: string;

  constructor(userId: string, config: SyncServiceConfig) {
    this.userId = userId;
    this.config = config;
  }

  /**
   * Execute a batch of upsert/delete operations.
   */
  async executeBatch(
    table: SyncTable,
    rows: PreparedRow[]
  ): Promise<BatchResult[]> {
    if (!supabase) {
      return rows.map((r) => ({
        localId: r.localId,
        success: false,
        error: 'Supabase not configured',
        isDelete: r.isDelete,
        data: r.data,
      }));
    }

    const results: BatchResult[] = [];

    // Process in batches
    for (let i = 0; i < rows.length; i += this.config.batchSize) {
      const batch = rows.slice(i, i + this.config.batchSize);

      // Separate upserts from deletes
      const upserts = batch.filter((r) => !r.isDelete);
      const deletes = batch.filter((r) => r.isDelete);

      // Process upserts
      if (upserts.length > 0) {
        const upsertResults = await this.processUpserts(table, upserts);
        results.push(...upsertResults);
      }

      // Process deletes
      if (deletes.length > 0) {
        const deleteResults = await this.processDeletes(table, deletes);
        results.push(...deleteResults);
      }
    }

    return results;
  }

  /**
   * Process batch upserts.
   */
  private async processUpserts(
    table: SyncTable,
    rows: PreparedRow[]
  ): Promise<BatchResult[]> {
    if (!supabase) return [];

    // Junction tables need special handling (composite keys, no id field)
    if (JUNCTION_TABLES.includes(table)) {
      return this.processJunctionUpserts(table, rows);
    }

    const results: BatchResult[] = [];

    // Separate new records (no remoteId) from updates (have remoteId)
    const inserts = rows.filter((r) => !r.remoteId);
    const updates = rows.filter((r) => r.remoteId);

    // Batch insert new records
    if (inserts.length > 0) {
      try {
        const insertData = inserts.map((r) => ({
          ...r.data,
          user_id: this.userId,
        }));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from(table) as any)
          .insert(insertData)
          .select('id');

        if (error) {
          inserts.forEach((r) =>
            results.push({
              localId: r.localId,
              success: false,
              error: error.message,
              isDelete: false,
              data: r.data,
            })
          );
        } else {
          inserts.forEach((r, idx) =>
            results.push({
              localId: r.localId,
              success: true,
              remoteId: data?.[idx]?.id,
              isDelete: false,
              data: r.data,
            })
          );
        }
      } catch (e) {
        const errorMsg = e instanceof Error ? e.message : String(e);
        inserts.forEach((r) =>
          results.push({
            localId: r.localId,
            success: false,
            error: errorMsg,
            isDelete: false,
            data: r.data,
          })
        );
      }
    }

    // Batch update existing records
    // Supabase doesn't support batch updates with different values,
    // so we need to update one by one
    for (const row of updates) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from(table) as any)
          .update({ ...row.data, updated_at: now() })
          .eq('id', row.remoteId);

        results.push({
          localId: row.localId,
          success: !error,
          remoteId: row.remoteId,
          error: error?.message,
          isDelete: false,
          data: row.data,
        });
      } catch (e) {
        results.push({
          localId: row.localId,
          success: false,
          remoteId: row.remoteId,
          error: e instanceof Error ? e.message : String(e),
          isDelete: false,
          data: row.data,
        });
      }
    }

    return results;
  }

  /**
   * Process junction table upserts (composite key, no id field).
   */
  private async processJunctionUpserts(
    table: SyncTable,
    rows: PreparedRow[]
  ): Promise<BatchResult[]> {
    if (!supabase) return [];

    const results: BatchResult[] = [];
    const secondKey = table === 'note_labels' ? 'label_id' : 'contact_id';

    for (const row of rows) {
      try {
        // Check if exists
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: existing } = await (supabase.from(table) as any)
          .select('*')
          .eq('note_id', row.data.note_id)
          .eq(secondKey, row.data[secondKey])
          .eq('user_id', this.userId)
          .maybeSingle();

        if (existing) {
          // Already exists, mark as success
          results.push({
            localId: row.localId,
            success: true,
            isDelete: false,
            data: row.data,
          });
        } else {
          // Insert new
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabase.from(table) as any).insert({
            ...row.data,
            user_id: this.userId,
          });

          results.push({
            localId: row.localId,
            success: !error,
            error: error?.message,
            isDelete: false,
            data: row.data,
          });
        }
      } catch (e) {
        results.push({
          localId: row.localId,
          success: false,
          error: e instanceof Error ? e.message : String(e),
          isDelete: false,
          data: row.data,
        });
      }
    }

    return results;
  }

  /**
   * Process batch soft deletes.
   */
  private async processDeletes(
    table: SyncTable,
    rows: PreparedRow[]
  ): Promise<BatchResult[]> {
    if (!supabase) return [];

    const results: BatchResult[] = [];
    const remoteIds = rows.filter((r) => r.remoteId).map((r) => r.remoteId!);

    if (remoteIds.length === 0) {
      // No remote IDs, mark all as success (nothing to delete remotely)
      rows.forEach((r) =>
        results.push({
          localId: r.localId,
          success: true,
          isDelete: true,
          data: r.data,
        })
      );
      return results;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(table) as any)
        .update({ deleted_at: now() })
        .in('id', remoteIds);

      rows.forEach((r) =>
        results.push({
          localId: r.localId,
          success: !error,
          remoteId: r.remoteId,
          error: error?.message,
          isDelete: true,
          data: r.data,
        })
      );
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      rows.forEach((r) =>
        results.push({
          localId: r.localId,
          success: false,
          remoteId: r.remoteId,
          error: errorMsg,
          isDelete: true,
          data: r.data,
        })
      );
    }

    return results;
  }

  /**
   * Fetch changes from Supabase since a given timestamp.
   */
  async fetchChanges(
    table: SyncTable,
    since?: string
  ): Promise<Record<string, unknown>[]> {
    if (!supabase) return [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from(table) as any)
        .select('*')
        .eq('user_id', this.userId);

      if (since) {
        const timestampField = this.getTimestampField(table);
        query = query.gte(timestampField, since);
      }

      const { data, error } = await query;

      if (error) {
        console.error(`[SyncBatcher] Failed to fetch ${table}:`, error);
        return [];
      }

      return data || [];
    } catch (e) {
      console.error(`[SyncBatcher] Error fetching ${table}:`, e);
      return [];
    }
  }

  /**
   * Fetch deleted records from Supabase.
   */
  async fetchDeleted(table: SyncTable): Promise<Record<string, unknown>[]> {
    if (!supabase) return [];

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from(table) as any)
        .select('id, deleted_at')
        .eq('user_id', this.userId)
        .not('deleted_at', 'is', null);

      if (error) {
        console.error(`[SyncBatcher] Failed to fetch deleted ${table}:`, error);
        return [];
      }

      return data || [];
    } catch (e) {
      console.error(`[SyncBatcher] Error fetching deleted ${table}:`, e);
      return [];
    }
  }

  /**
   * Get the timestamp field to use for incremental sync.
   */
  private getTimestampField(table: SyncTable): string {
    const createdAtTables: SyncTable[] = [
      'note_versions',
      'note_actions',
      'note_labels',
      'note_assignees',
    ];
    return createdAtTables.includes(table) ? 'created_at' : 'updated_at';
  }
}
