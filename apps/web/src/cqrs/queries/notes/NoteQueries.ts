import type { Query } from '../../types';
import type { Note, NoteVersion, NoteAction } from '@/types/note';

export interface GetNotesPayload {
  date?: string;
  projectId?: string | null;
  completed?: boolean;
  includeDeleted?: boolean;
}

export class GetNotesQuery implements Query<GetNotesPayload, Note[]> {
  readonly type = 'GetNotes';
  readonly payload: GetNotesPayload;

  constructor(payload: GetNotesPayload = {}) {
    this.payload = payload;
  }
}

export interface GetNoteByIdPayload {
  noteId: string;
}

export class GetNoteByIdQuery implements Query<GetNoteByIdPayload, Note | null> {
  readonly type = 'GetNoteById';
  readonly payload: GetNoteByIdPayload;

  constructor(payload: GetNoteByIdPayload) {
    this.payload = payload;
  }
}

export interface GetNoteVersionsPayload {
  noteId: string;
}

export class GetNoteVersionsQuery implements Query<GetNoteVersionsPayload, NoteVersion[]> {
  readonly type = 'GetNoteVersions';
  readonly payload: GetNoteVersionsPayload;

  constructor(payload: GetNoteVersionsPayload) {
    this.payload = payload;
  }
}

export interface GetNoteActionsPayload {
  noteId: string;
}

export class GetNoteActionsQuery implements Query<GetNoteActionsPayload, NoteAction[]> {
  readonly type = 'GetNoteActions';
  readonly payload: GetNoteActionsPayload;

  constructor(payload: GetNoteActionsPayload) {
    this.payload = payload;
  }
}
