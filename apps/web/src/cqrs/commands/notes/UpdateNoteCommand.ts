import type { Command } from '../../types';
import type { NoteCategory } from '@/types/note';

export interface UpdateNotePayload {
  noteId: string;
  content?: string;
  category?: NoteCategory;
  description?: string | null;
  deadline?: string | null;
  projectId?: string | null;
  date?: string;
}

export class UpdateNoteCommand implements Command<UpdateNotePayload, void> {
  readonly type = 'UpdateNote';
  readonly payload: UpdateNotePayload;

  constructor(payload: UpdateNotePayload) {
    this.payload = payload;
  }
}
