import type { Database } from 'sql.js';
import type { MergeableStore } from 'tinybase';

export interface MigrationProgress {
  table: string;
  current: number;
  total: number;
  phase: 'backup' | 'migrate' | 'verify';
}

export interface MigrationResult {
  success: boolean;
  tablesProcessed: number;
  rowsMigrated: number;
  errors: string[];
  duration: number;
}

export interface VerificationResult {
  success: boolean;
  errors: string[];
  details: {
    table: string;
    sqlCount: number;
    tinybaseCount: number;
    match: boolean;
  }[];
}

const TABLES_TO_MIGRATE = [
  'contacts',  // First: no dependencies
  'labels',    // Second: no dependencies
  'notes',     // Third: depends on contacts (assignee_id)
  'note_labels', // Fourth: depends on notes and labels
  'note_history', // Fifth: depends on notes
] as const;

type MigratableTable = (typeof TABLES_TO_MIGRATE)[number];

/**
 * Service for migrating data from sql.js to TinyBase
 */
export class DataMigrationService {
  private sqlDb: Database;
  private tinybaseStore: MergeableStore;
  private onProgress?: (progress: MigrationProgress) => void;

  constructor(
    sqlDb: Database,
    tinybaseStore: MergeableStore,
    onProgress?: (progress: MigrationProgress) => void
  ) {
    this.sqlDb = sqlDb;
    this.tinybaseStore = tinybaseStore;
    this.onProgress = onProgress;
  }

  /**
   * Migrate all data from sql.js to TinyBase
   */
  async migrateAll(): Promise<MigrationResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let rowsMigrated = 0;
    let tablesProcessed = 0;

    try {
      for (const tableName of TABLES_TO_MIGRATE) {
        try {
          const count = await this.migrateTable(tableName);
          rowsMigrated += count;
          tablesProcessed++;
        } catch (error) {
          const errorMsg = `Failed to migrate ${tableName}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(`[Migration] ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      return {
        success: errors.length === 0,
        tablesProcessed,
        rowsMigrated,
        errors,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
      console.error(`[Migration] ${errorMsg}`);
      return {
        success: false,
        tablesProcessed,
        rowsMigrated,
        errors: [...errors, errorMsg],
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Migrate a single table
   */
  private async migrateTable(tableName: MigratableTable): Promise<number> {
    const columns = this.getTableColumns(tableName);
    const result = this.sqlDb.exec(`SELECT ${columns.join(', ')} FROM ${tableName}`);

    if (result.length === 0) {
      this.onProgress?.({ table: tableName, current: 0, total: 0, phase: 'migrate' });
      return 0;
    }

    const rows = result[0].values;
    const total = rows.length;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowData: Record<string, string | number | boolean | null> = {};

      columns.forEach((col, idx) => {
        let value = row[idx];
        // Convert SQLite integers to booleans for boolean fields
        if (col === 'completed' || col === 'pinned') {
          value = Boolean(value);
        }
        rowData[col] = value as string | number | boolean | null;
      });

      // For note_labels, use composite key
      let rowId: string;
      if (tableName === 'note_labels') {
        rowId = `${rowData.note_id}-${rowData.label_id}`;
      } else {
        rowId = rowData.id as string;
        delete rowData.id; // TinyBase uses row ID separately
      }

      this.tinybaseStore.setRow(tableName, rowId, rowData as Record<string, string | number | boolean>);
      this.onProgress?.({ table: tableName, current: i + 1, total, phase: 'migrate' });
    }

    return total;
  }

  /**
   * Get column names for a table
   */
  private getTableColumns(tableName: MigratableTable): string[] {
    const columnMap: Record<MigratableTable, string[]> = {
      notes: [
        'id', 'date', 'content', 'description', 'category', 'completed',
        'completed_at', 'deadline', 'pinned', 'sort_order', 'created_at',
        'updated_at', 'deleted_at', 'assignee_id', 'remote_id', 'sync_status',
        'last_synced_at',
      ],
      labels: [
        'id', 'name', 'color', 'created_at', 'updated_at', 'deleted_at',
        'remote_id', 'sync_status', 'last_synced_at',
      ],
      note_labels: ['note_id', 'label_id', 'created_at'],
      note_history: [
        'id', 'note_id', 'content', 'description', 'category', 'completed',
        'changed_at', 'action_type', 'reason', 'previous_date',
      ],
      contacts: [
        'id', 'name', 'lastname', 'phone', 'email', 'created_at',
        'updated_at', 'deleted_at', 'user_id', 'remote_id', 'sync_status',
        'last_synced_at',
      ],
    };
    return columnMap[tableName];
  }

  /**
   * Verify migration integrity
   */
  async verify(): Promise<VerificationResult> {
    const errors: string[] = [];
    const details: VerificationResult['details'] = [];

    for (const tableName of TABLES_TO_MIGRATE) {
      this.onProgress?.({ table: tableName, current: 0, total: 1, phase: 'verify' });

      try {
        // Count rows in sql.js
        const sqlResult = this.sqlDb.exec(`SELECT COUNT(*) FROM ${tableName}`);
        const sqlCount = sqlResult[0]?.values[0]?.[0] as number || 0;

        // Count rows in TinyBase
        const tinybaseTable = this.tinybaseStore.getTable(tableName) || {};
        const tinybaseCount = Object.keys(tinybaseTable).length;

        const match = sqlCount === tinybaseCount;
        if (!match) {
          errors.push(`${tableName}: SQL has ${sqlCount} rows, TinyBase has ${tinybaseCount}`);
        }

        details.push({ table: tableName, sqlCount, tinybaseCount, match });
      } catch (error) {
        const errorMsg = `Failed to verify ${tableName}: ${error instanceof Error ? error.message : String(error)}`;
        errors.push(errorMsg);
        details.push({ table: tableName, sqlCount: -1, tinybaseCount: -1, match: false });
      }

      this.onProgress?.({ table: tableName, current: 1, total: 1, phase: 'verify' });
    }

    return {
      success: errors.length === 0,
      errors,
      details,
    };
  }

  /**
   * Export sql.js database as backup
   */
  exportBackup(): Uint8Array {
    return this.sqlDb.export();
  }
}

/**
 * Create a backup of the sql.js database to a downloadable file
 */
export function downloadBackup(data: Uint8Array, filename?: string): void {
  // Create a copy to avoid SharedArrayBuffer type issues
  const buffer = new Uint8Array(data).buffer;
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const name = filename || `triple-a-backup-${timestamp}.db`;

  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper function to perform full migration with backup
 */
export async function performMigrationWithBackup(
  sqlDb: Database,
  tinybaseStore: MergeableStore,
  onProgress?: (progress: MigrationProgress) => void
): Promise<{
  migrationResult: MigrationResult;
  verificationResult: VerificationResult;
  backupData: Uint8Array;
}> {
  const service = new DataMigrationService(sqlDb, tinybaseStore, onProgress);

  // Create backup first
  onProgress?.({ table: 'backup', current: 0, total: 1, phase: 'backup' });
  const backupData = service.exportBackup();
  onProgress?.({ table: 'backup', current: 1, total: 1, phase: 'backup' });

  // Perform migration
  const migrationResult = await service.migrateAll();

  // Verify migration
  const verificationResult = await service.verify();

  return { migrationResult, verificationResult, backupData };
}
