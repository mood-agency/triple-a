import type { Query } from '../../types';
import type { Contact } from '@/types/contact';

export class GetContactsQuery implements Query<void, Contact[]> {
  readonly type = 'GetContacts';
  readonly payload = undefined;
}

export interface GetAssigneesForNotePayload {
  noteId: string;
}

export class GetAssigneesForNoteQuery implements Query<GetAssigneesForNotePayload, Contact[]> {
  readonly type = 'GetAssigneesForNote';
  readonly payload: GetAssigneesForNotePayload;

  constructor(payload: GetAssigneesForNotePayload) {
    this.payload = payload;
  }
}

export class GetNoteAssigneesMapQuery implements Query<void, Map<string, Contact[]>> {
  readonly type = 'GetNoteAssigneesMap';
  readonly payload = undefined;
}
