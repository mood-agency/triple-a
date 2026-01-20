export type NoteCategory = 'todo' | 'followup' | 'notes';

export interface Note {
  id: string;
  date: string;
  content: string;
  description: string | null;
  category: NoteCategory;
  completed: boolean;
  pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface NoteHistory {
  id: string;
  note_id: string;
  content: string;
  description: string | null;
  category: NoteCategory;
  completed: boolean;
  changed_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface NoteLabel {
  note_id: string;
  label_id: string;
  created_at: string;
}

// Export/Import types
export interface ExportData {
  version: string;
  exportedAt: string;
  notes: Note[];
  noteHistory: NoteHistory[];
  labels?: Label[];
  noteLabels?: NoteLabel[];
}

export interface ImportResult {
  success: boolean;
  notesImported: number;
  historyImported: number;
  errors: string[];
}
