import type { MergeableStore } from 'tinybase';

export type SyncTable =
  | 'contacts'
  | 'labels'
  | 'projects'
  | 'notes'
  | 'note_labels'
  | 'note_assignees'
  | 'note_versions'
  | 'note_actions';

export type SyncOperation = 'upsert' | 'delete';

export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflict';

/**
 * Table push order respecting foreign key dependencies.
 * Parent tables must be pushed before children so remote_ids are available.
 */
export const TABLE_PUSH_ORDER: SyncTable[] = [
  'contacts',       // No FKs
  'labels',         // No FKs
  'projects',       // No FKs
  'notes',          // FK: project_id, assignee_id
  'note_labels',    // FK: note_id, label_id
  'note_assignees', // FK: note_id, contact_id
  'note_versions',  // FK: note_id
  'note_actions',   // FK: note_id
];

/**
 * Tables that have a deleted_at column for soft deletes
 */
export const TABLES_WITH_SOFT_DELETE: SyncTable[] = [
  'contacts',
  'labels',
  'projects',
  'notes',
];

/**
 * Tables that use created_at instead of updated_at for incremental sync
 */
export const TABLES_WITH_CREATED_AT_ONLY: SyncTable[] = [
  'note_labels',
  'note_assignees',
  'note_versions',
  'note_actions',
];

/**
 * Junction tables with composite keys (no separate id field)
 */
export const JUNCTION_TABLES: SyncTable[] = [
  'note_labels',
  'note_assignees',
];

export interface QueuedOperation {
  id: string;
  table: SyncTable;
  operation: SyncOperation;
  localId: string;
  data: Record<string, unknown>;
  retryCount: number;
  nextRetryAt: number;
  createdAt: number;
  lastError?: string;
}

export interface SyncConflict {
  id: string;
  table: SyncTable;
  localId: string;
  remoteId: string;
  localData: Record<string, unknown>;
  remoteData: Record<string, unknown>;
  localUpdatedAt: string;
  remoteUpdatedAt: string;
  detectedAt: string;
}

export type ConflictResolution = 'keep_local' | 'keep_remote';

export interface SyncProgress {
  phase: 'push' | 'pull' | 'idle';
  table?: SyncTable;
  current: number;
  total: number;
}

export interface SyncServiceConfig {
  batchSize: number;           // Default: 50
  maxRetries: number;          // Default: 5
  baseRetryDelay: number;      // Default: 1000ms
  maxRetryDelay: number;       // Default: 60000ms
  syncDebounceMs: number;      // Default: 2000ms
  syncIntervalMs: number;      // Default: 300000ms (5 min)
}

export const DEFAULT_SYNC_CONFIG: SyncServiceConfig = {
  batchSize: 50,
  maxRetries: 5,
  baseRetryDelay: 1000,
  maxRetryDelay: 60000,
  syncDebounceMs: 2000,
  syncIntervalMs: 300000,
};

export interface PreparedRow {
  localId: string;
  data: Record<string, unknown>;
  remoteId?: string;
  isDelete: boolean;
}

export interface BatchResult {
  localId: string;
  success: boolean;
  remoteId?: string;
  error?: string;
  isDelete: boolean;
  data: Record<string, unknown>;
}

export type ProgressCallback = (progress: SyncProgress) => void;
export type ConflictCallback = (conflict: SyncConflict) => void;
export type ErrorCallback = (error: Error, table: SyncTable) => void;

export interface SyncServiceDependencies {
  store: MergeableStore;
  userId: string;
  config: SyncServiceConfig;
}

/**
 * Remote ID cache type: tableName -> Map<remoteId, localId>
 */
export type RemoteIdCache = Map<SyncTable, Map<string, string>>;
