import { createMergeableStore, type MergeableStore } from 'tinybase';

/**
 * TinyBase Store Schema
 * Defines the data structure for the TinyBase MergeableStore
 */

export type NoteCategory = 'todo' | 'followup' | 'notes' | 'meeting';
export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflict';
export type ChangelogActionType = 'created' | 'edit' | 'postponed' | 'completed' | 'uncompleted';
export type ProjectStatus = 'active' | 'archived' | 'completed';

// Table schemas for type safety
export interface NoteRow {
  date: string;
  content: string;
  description: string | null;
  category: NoteCategory;
  completed: boolean;
  completed_at: string | null;
  deadline: string | null;
  pinned: boolean;
  sort_order: number;
  assignee_id: string | null;
  project_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  remote_id: string | null;
  sync_status: SyncStatus;
  last_synced_at: string | null;
  // Google Calendar sync field
  gcal_event_id: string | null;
}

export interface LabelRow {
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  remote_id: string | null;
  sync_status: SyncStatus;
  last_synced_at: string | null;
}

export interface NoteLabelRow {
  note_id: string;
  label_id: string;
  created_at: string;
}

export interface NoteHistoryRow {
  note_id: string;
  content: string;
  description: string | null;
  category: NoteCategory;
  completed: boolean;
  changed_at: string;
  action_type: ChangelogActionType;
  reason: string | null;
  previous_date: string | null;
}

export interface ContactRow {
  name: string;
  lastname: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  user_id: string | null;
  remote_id: string | null;
  sync_status: SyncStatus;
  last_synced_at: string | null;
}

export interface PendingSyncRow {
  table_name: string;
  operation: 'insert' | 'update' | 'delete';
  record_id: string;
  data: string | null;
  created_at: string;
  retry_count: number;
}

export interface SyncStateRow {
  value: string;
}

export interface ProjectRow {
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: ProjectStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  remote_id: string | null;
  sync_status: SyncStatus;
  last_synced_at: string | null;
}

// Store type with all tables
export interface AppTables {
  notes: Record<string, NoteRow>;
  labels: Record<string, LabelRow>;
  note_labels: Record<string, NoteLabelRow>;
  note_history: Record<string, NoteHistoryRow>;
  contacts: Record<string, ContactRow>;
  projects: Record<string, ProjectRow>;
  pending_sync: Record<string, PendingSyncRow>;
  sync_state: Record<string, SyncStateRow>;
}

/**
 * Creates the TinyBase MergeableStore with schema
 * MergeableStore enables CRDT-based conflict resolution
 */
export function createAppStore(): MergeableStore {
  const store = createMergeableStore();

  // Set default values using Values for app-level settings
  store.setValues({
    last_synced_at: '',
    schema_version: '1',
  });

  return store;
}

/**
 * Generate a unique ID (same as current implementation)
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Get current ISO timestamp
 */
export function now(): string {
  return new Date().toISOString();
}
