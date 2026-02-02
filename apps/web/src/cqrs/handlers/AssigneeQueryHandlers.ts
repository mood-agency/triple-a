import type { QueryHandler } from '../types';
import type { IAssigneeRepository } from '@/data/types';
import {
  GetContactsQuery,
  GetAssigneesForNoteQuery,
  GetNoteAssigneesMapQuery,
} from '../queries/assignees/AssigneeQueries';

/**
 * Creates handlers for assignee-related queries.
 * Uses the repository pattern for database abstraction (Convex-ready).
 */
export function createAssigneeQueryHandlers(assigneeRepository: IAssigneeRepository) {
  const handleGetContacts: QueryHandler<GetContactsQuery> = async () => {
    return assigneeRepository.getAll();
  };

  const handleGetAssigneesForNote: QueryHandler<GetAssigneesForNoteQuery> = async (query) => {
    return assigneeRepository.getAssigneesForNote(query.payload.noteId);
  };

  const handleGetNoteAssigneesMap: QueryHandler<GetNoteAssigneesMapQuery> = async () => {
    return assigneeRepository.getNoteAssigneesMap();
  };

  return {
    GetContacts: handleGetContacts,
    GetAssigneesForNote: handleGetAssigneesForNote,
    GetNoteAssigneesMap: handleGetNoteAssigneesMap,
  };
}

// Type for the handlers object
export type AssigneeQueryHandlers = ReturnType<typeof createAssigneeQueryHandlers>;
