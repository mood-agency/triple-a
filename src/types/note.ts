export type NoteCategory = 'todo' | 'followup';

export interface Note {
  id: string;
  date: string;
  content: string;
  description: string | null;
  category: NoteCategory;
  completed: boolean;
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

// Export/Import types
export interface ExportData {
  version: string;
  exportedAt: string;
  notes: Note[];
  noteHistory: NoteHistory[];
}

export interface ImportResult {
  success: boolean;
  notesImported: number;
  historyImported: number;
  errors: string[];
}
