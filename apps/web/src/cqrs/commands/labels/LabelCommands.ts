import type { Command } from '../../types';
import type { Label } from '@/types/note';

export interface AddLabelToNotePayload {
  noteId: string;
  labelId: string;
}

export class AddLabelToNoteCommand implements Command<AddLabelToNotePayload, void> {
  readonly type = 'AddLabelToNote';
  readonly payload: AddLabelToNotePayload;

  constructor(payload: AddLabelToNotePayload) {
    this.payload = payload;
  }
}

export interface RemoveLabelFromNotePayload {
  noteId: string;
  labelId: string;
}

export class RemoveLabelFromNoteCommand implements Command<RemoveLabelFromNotePayload, void> {
  readonly type = 'RemoveLabelFromNote';
  readonly payload: RemoveLabelFromNotePayload;

  constructor(payload: RemoveLabelFromNotePayload) {
    this.payload = payload;
  }
}

export interface CreateLabelPayload {
  name: string;
  color: string;
}

export class CreateLabelCommand implements Command<CreateLabelPayload, Label> {
  readonly type = 'CreateLabel';
  readonly payload: CreateLabelPayload;

  constructor(payload: CreateLabelPayload) {
    this.payload = payload;
  }
}

export interface CreateLabelAndAddToNotePayload {
  noteId: string;
  name: string;
  color: string;
}

export class CreateLabelAndAddToNoteCommand implements Command<CreateLabelAndAddToNotePayload, Label> {
  readonly type = 'CreateLabelAndAddToNote';
  readonly payload: CreateLabelAndAddToNotePayload;

  constructor(payload: CreateLabelAndAddToNotePayload) {
    this.payload = payload;
  }
}
