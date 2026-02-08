export type NoteCategory = 'todo' | 'followup' | 'notes' | 'meeting';

export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflict';

export type ChangelogActionType = 'created' | 'edit' | 'postponed' | 'completed' | 'uncompleted';

export interface MeetingAttendee {
  email: string;
  displayName?: string | null;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
}

export interface Note {
  id: string;
  date: string;
  content: string;
  description: string | null;
  category: NoteCategory;
  completed: boolean;
  completed_at: string | null;
  deadline: string | null;
  is_all_day: boolean;
  pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  // Project (references projects table)
  project_id: string | null;
  // Computed field from history
  last_postpone_reason?: string | null;
  // Sync fields
  remote_id?: string | null;
  sync_status?: SyncStatus;
  last_synced_at?: string | null;
  // Google Calendar sync field
  gcal_event_id?: string | null;
  // Google Calendar meeting metadata (read-only, populated by sync)
  meeting_link?: string | null;
  location?: string | null;
  meeting_attendees?: MeetingAttendee[] | null;
  gcal_html_link?: string | null;
  // Public sharing fields
  is_public: boolean;
  public_slug: string | null;
}

// Legacy interface for backward compatibility
export interface NoteHistory {
  id: string;
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

// New interfaces for separated history system
export interface NoteVersion {
  id: string;
  note_id: string;
  content: string;
  description: string | null;
  category: NoteCategory;
  completed: boolean;
  version_number: number;
  created_at: string;
}

export interface NoteAction {
  id: string;
  note_id: string;
  action_type: 'postponed';
  reason: string | null;
  previous_date: string | null;
  new_date: string | null;
  created_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  // Sync fields
  remote_id?: string | null;
  sync_status?: SyncStatus;
  last_synced_at?: string | null;
}

export interface NoteLabel {
  note_id: string;
  label_id: string;
  created_at: string;
}

export interface NoteAssignee {
  note_id: string;
  contact_id: string;
  created_at: string;
}

// Export/Import types
export interface ExportData {
  version: string;
  exportedAt: string;
  notes: Note[];
  noteHistory?: NoteHistory[]; // Legacy field for backward compatibility
  noteVersions?: NoteVersion[];
  noteActions?: NoteAction[];
  labels?: Label[];
  noteLabels?: NoteLabel[];
}

export interface ImportResult {
  success: boolean;
  notesImported: number;
  historyImported: number;
  versionsImported?: number;
  actionsImported?: number;
  errors: string[];
}
