import type { Command } from '../../types';

export interface DeleteNotePayload {
  noteId: string;
  reason: string;
}

export class DeleteNoteCommand implements Command<DeleteNotePayload, void> {
  readonly type = 'DeleteNote';

  constructor(public readonly payload: DeleteNotePayload) {}
}

export interface RestoreNotePayload {
  noteId: string;
}

export class RestoreNoteCommand implements Command<RestoreNotePayload, void> {
  readonly type = 'RestoreNote';

  constructor(public readonly payload: RestoreNotePayload) {}
}
