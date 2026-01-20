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
