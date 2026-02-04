import type { Command } from '../../types';
import type { Note, NoteCategory } from '@/types/note';

export interface CreateNotePayload {
  content: string;
  category: NoteCategory;
  date?: string;
  description?: string | null;
  deadline?: string | null;
  projectId?: string | null;
  labelIds?: string[];
  assigneeId?: string | null;
}

export interface CreateNoteAfterPayload extends CreateNotePayload {
  afterNoteId: string;
  newNoteId?: string;
}

export class CreateNoteCommand implements Command<CreateNotePayload, Note> {
  readonly type = 'CreateNote';
  readonly payload: CreateNotePayload;

  constructor(payload: CreateNotePayload) {
    this.payload = payload;
  }
}

export class CreateNoteAfterCommand implements Command<CreateNoteAfterPayload, Note> {
  readonly type = 'CreateNoteAfter';
  readonly payload: CreateNoteAfterPayload;

  constructor(payload: CreateNoteAfterPayload) {
    this.payload = payload;
  }
}
