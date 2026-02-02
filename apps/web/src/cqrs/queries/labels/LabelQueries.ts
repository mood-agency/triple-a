import type { Query } from '../../types';
import type { Label } from '@/types/note';

export class GetLabelsQuery implements Query<void, Label[]> {
  readonly type = 'GetLabels';
  readonly payload = undefined;
}

export interface GetLabelsForNotePayload {
  noteId: string;
}

export class GetLabelsForNoteQuery implements Query<GetLabelsForNotePayload, Label[]> {
  readonly type = 'GetLabelsForNote';

  constructor(public readonly payload: GetLabelsForNotePayload) {}
}

export class GetNoteLabelsMapQuery implements Query<void, Map<string, Label[]>> {
  readonly type = 'GetNoteLabelsMap';
  readonly payload = undefined;
}
