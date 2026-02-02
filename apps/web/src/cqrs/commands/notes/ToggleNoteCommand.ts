import type { Command } from '../../types';

export interface ToggleCompletedPayload {
  noteId: string;
  completed: boolean;
}

export class ToggleCompletedCommand implements Command<ToggleCompletedPayload, void> {
  readonly type = 'ToggleCompleted';

  constructor(public readonly payload: ToggleCompletedPayload) {}
}

export interface TogglePinnedPayload {
  noteId: string;
  pinned: boolean;
}

export class TogglePinnedCommand implements Command<TogglePinnedPayload, void> {
  readonly type = 'TogglePinned';

  constructor(public readonly payload: TogglePinnedPayload) {}
}

export interface ReorderNotesPayload {
  noteIds: string[];
}

export class ReorderNotesCommand implements Command<ReorderNotesPayload, void> {
  readonly type = 'ReorderNotes';

  constructor(public readonly payload: ReorderNotesPayload) {}
}

export interface PostponeNotePayload {
  noteId: string;
  newDate: string;
  reason?: string;
}

export class PostponeNoteCommand implements Command<PostponeNotePayload, void> {
  readonly type = 'PostponeNote';

  constructor(public readonly payload: PostponeNotePayload) {}
}
