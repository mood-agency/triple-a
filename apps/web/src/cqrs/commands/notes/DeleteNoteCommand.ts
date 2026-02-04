import type { Command } from '../../types';

export interface DeleteNotePayload {
  noteId: string;
  reason: string;
}

export class DeleteNoteCommand implements Command<DeleteNotePayload, void> {
  readonly type = 'DeleteNote';
  readonly payload: DeleteNotePayload;

  constructor(payload: DeleteNotePayload) {
    this.payload = payload;
  }
}

export interface RestoreNotePayload {
  noteId: string;
}

export class RestoreNoteCommand implements Command<RestoreNotePayload, void> {
  readonly type = 'RestoreNote';
  readonly payload: RestoreNotePayload;

  constructor(payload: RestoreNotePayload) {
    this.payload = payload;
  }
}
