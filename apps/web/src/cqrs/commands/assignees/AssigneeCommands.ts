import type { Command } from '../../types';

export interface AddAssigneeToNotePayload {
  noteId: string;
  contactId: string;
}

export class AddAssigneeToNoteCommand implements Command<AddAssigneeToNotePayload, void> {
  readonly type = 'AddAssigneeToNote';

  constructor(public readonly payload: AddAssigneeToNotePayload) {}
}

export interface RemoveAssigneeFromNotePayload {
  noteId: string;
  contactId: string;
}

export class RemoveAssigneeFromNoteCommand implements Command<RemoveAssigneeFromNotePayload, void> {
  readonly type = 'RemoveAssigneeFromNote';

  constructor(public readonly payload: RemoveAssigneeFromNotePayload) {}
}

export interface SetNoteAssigneesPayload {
  noteId: string;
  contactIds: string[];
}

export class SetNoteAssigneesCommand implements Command<SetNoteAssigneesPayload, void> {
  readonly type = 'SetNoteAssignees';

  constructor(public readonly payload: SetNoteAssigneesPayload) {}
}
