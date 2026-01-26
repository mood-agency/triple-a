import type { SyncStatus } from './note';

export type ProjectStatus = 'active' | 'archived' | 'completed';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string | null;
  status: ProjectStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // Google Calendar sync - calendar ID to sync events from
  gcal_calendar_id: string | null;
  // Google Calendar account ID (for multi-account support)
  gcal_account_id: string | null;
  // Sync fields
  remote_id?: string | null;
  sync_status?: SyncStatus;
  last_synced_at?: string | null;
}

export type ProjectInput = Pick<Project, 'name'> &
  Partial<Pick<Project, 'description' | 'color' | 'icon' | 'status'>>;
