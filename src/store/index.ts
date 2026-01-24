// TinyBase Store exports
export { createAppStore, generateId, now } from './schema';
export type {
  NoteRow,
  LabelRow,
  ContactRow,
  NoteHistoryRow,
  NoteLabelRow,
  PendingSyncRow,
  SyncStateRow,
  AppTables,
  NoteCategory,
  SyncStatus,
  ChangelogActionType,
} from './schema';

// Persisters
export { createIndexedDbPersister } from './persisters/indexedDbPersister';
export type { AppPersister } from './persisters/indexedDbPersister';

// Supabase Sync
export { createSupabaseSync, SupabaseDataSync } from './persisters/supabaseSync';
export type { SupabaseSyncOptions, SyncTable } from './persisters/supabaseSync';
