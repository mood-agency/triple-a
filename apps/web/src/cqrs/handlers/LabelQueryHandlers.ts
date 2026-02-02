import type { QueryHandler } from '../types';
import type { ILabelRepository } from '@/data/types';
import {
  GetLabelsQuery,
  GetLabelsForNoteQuery,
  GetNoteLabelsMapQuery,
} from '../queries/labels/LabelQueries';

/**
 * Creates handlers for label-related queries.
 * Uses the repository pattern for database abstraction (Convex-ready).
 */
export function createLabelQueryHandlers(labelRepository: ILabelRepository) {
  const handleGetLabels: QueryHandler<GetLabelsQuery> = async () => {
    return labelRepository.getAll();
  };

  const handleGetLabelsForNote: QueryHandler<GetLabelsForNoteQuery> = async (query) => {
    return labelRepository.getLabelsForNote(query.payload.noteId);
  };

  const handleGetNoteLabelsMap: QueryHandler<GetNoteLabelsMapQuery> = async () => {
    return labelRepository.getNoteLabelsMap();
  };

  return {
    GetLabels: handleGetLabels,
    GetLabelsForNote: handleGetLabelsForNote,
    GetNoteLabelsMap: handleGetNoteLabelsMap,
  };
}

// Type for the handlers object
export type LabelQueryHandlers = ReturnType<typeof createLabelQueryHandlers>;
