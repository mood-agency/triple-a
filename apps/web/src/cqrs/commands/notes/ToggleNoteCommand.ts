import type { Command } from '../../types';

export interface ToggleCompletedPayload {
  noteId: string;
  completed: boolean;
}

export class ToggleCompletedCommand implements Command<ToggleCompletedPayload, void> {
  readonly type = 'ToggleCompleted';
  readonly payload: ToggleCompletedPayload;

  constructor(payload: ToggleCompletedPayload) {
    this.payload = payload;
  }
}

export interface TogglePinnedPayload {
  noteId: string;
  pinned: boolean;
}

export class TogglePinnedCommand implements Command<TogglePinnedPayload, void> {
  readonly type = 'TogglePinned';
  readonly payload: TogglePinnedPayload;

  constructor(payload: TogglePinnedPayload) {
    this.payload = payload;
  }
}

export interface ReorderNotesPayload {
  noteIds: string[];
}

export class ReorderNotesCommand implements Command<ReorderNotesPayload, void> {
  readonly type = 'ReorderNotes';
  readonly payload: ReorderNotesPayload;

  constructor(payload: ReorderNotesPayload) {
    this.payload = payload;
  }
}

export interface PostponeNotePayload {
  noteId: string;
  newDate: string;
  reason?: string;
}

export class PostponeNoteCommand implements Command<PostponeNotePayload, void> {
  readonly type = 'PostponeNote';
  readonly payload: PostponeNotePayload;

  constructor(payload: PostponeNotePayload) {
    this.payload = payload;
  }
}
