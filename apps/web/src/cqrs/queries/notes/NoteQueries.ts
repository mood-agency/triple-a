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

  constructor(public readonly payload: GetNotesPayload = {}) {}
}

export interface GetNoteByIdPayload {
  noteId: string;
}

export class GetNoteByIdQuery implements Query<GetNoteByIdPayload, Note | null> {
  readonly type = 'GetNoteById';

  constructor(public readonly payload: GetNoteByIdPayload) {}
}

export interface GetNoteVersionsPayload {
  noteId: string;
}

export class GetNoteVersionsQuery implements Query<GetNoteVersionsPayload, NoteVersion[]> {
  readonly type = 'GetNoteVersions';

  constructor(public readonly payload: GetNoteVersionsPayload) {}
}

export interface GetNoteActionsPayload {
  noteId: string;
}

export class GetNoteActionsQuery implements Query<GetNoteActionsPayload, NoteAction[]> {
  readonly type = 'GetNoteActions';

  constructor(public readonly payload: GetNoteActionsPayload) {}
}
