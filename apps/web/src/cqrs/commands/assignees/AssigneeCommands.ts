import type { Command } from '../../types';

export interface AddAssigneeToNotePayload {
  noteId: string;
  contactId: string;
}

export class AddAssigneeToNoteCommand implements Command<AddAssigneeToNotePayload, void> {
  readonly type = 'AddAssigneeToNote';
  readonly payload: AddAssigneeToNotePayload;

  constructor(payload: AddAssigneeToNotePayload) {
    this.payload = payload;
  }
}

export interface RemoveAssigneeFromNotePayload {
  noteId: string;
  contactId: string;
}

export class RemoveAssigneeFromNoteCommand implements Command<RemoveAssigneeFromNotePayload, void> {
  readonly type = 'RemoveAssigneeFromNote';
  readonly payload: RemoveAssigneeFromNotePayload;

  constructor(payload: RemoveAssigneeFromNotePayload) {
    this.payload = payload;
  }
}

export interface SetNoteAssigneesPayload {
  noteId: string;
  contactIds: string[];
}

export class SetNoteAssigneesCommand implements Command<SetNoteAssigneesPayload, void> {
  readonly type = 'SetNoteAssignees';
  readonly payload: SetNoteAssigneesPayload;

  constructor(payload: SetNoteAssigneesPayload) {
    this.payload = payload;
  }
}
