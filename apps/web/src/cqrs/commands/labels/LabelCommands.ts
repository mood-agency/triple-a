import type { Command } from '../../types';
import type { Label } from '@/types/note';

export interface AddLabelToNotePayload {
  noteId: string;
  labelId: string;
}

export class AddLabelToNoteCommand implements Command<AddLabelToNotePayload, void> {
  readonly type = 'AddLabelToNote';

  constructor(public readonly payload: AddLabelToNotePayload) {}
}

export interface RemoveLabelFromNotePayload {
  noteId: string;
  labelId: string;
}

export class RemoveLabelFromNoteCommand implements Command<RemoveLabelFromNotePayload, void> {
  readonly type = 'RemoveLabelFromNote';

  constructor(public readonly payload: RemoveLabelFromNotePayload) {}
}

export interface CreateLabelPayload {
  name: string;
  color: string;
}

export class CreateLabelCommand implements Command<CreateLabelPayload, Label> {
  readonly type = 'CreateLabel';

  constructor(public readonly payload: CreateLabelPayload) {}
}

export interface CreateLabelAndAddToNotePayload {
  noteId: string;
  name: string;
  color: string;
}

export class CreateLabelAndAddToNoteCommand implements Command<CreateLabelAndAddToNotePayload, Label> {
  readonly type = 'CreateLabelAndAddToNote';

  constructor(public readonly payload: CreateLabelAndAddToNotePayload) {}
}
