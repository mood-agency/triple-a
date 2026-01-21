export type SyncOperation = 'insert' | 'update' | 'delete'

export type SyncTable = 'notes' | 'labels' | 'note_labels' | 'note_history'

export interface PendingSyncOperation {
  id: string
  table_name: SyncTable
  operation: SyncOperation
  record_id: string
  data: string | null
  created_at: string
  retry_count: number
}

export type SyncConnectionStatus = 'online' | 'offline' | 'connecting'

export type SyncState = 'idle' | 'syncing' | 'error'

export interface SyncContextState {
  connectionStatus: SyncConnectionStatus
  syncState: SyncState
  lastSyncedAt: string | null
  pendingCount: number
  error: string | null
}

export interface SyncConflict {
  id: string
  table_name: SyncTable
  record_id: string
  localData: Record<string, unknown>
  remoteData: Record<string, unknown>
  localUpdatedAt: string
  remoteUpdatedAt: string
}

export type ConflictResolution = 'keep_local' | 'keep_remote' | 'merge'
