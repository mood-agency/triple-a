import type { QueryHandler } from '../types';
import type { INoteRepository } from '@/data/types';
import {
  GetNotesQuery,
  GetNoteByIdQuery,
  GetNoteVersionsQuery,
  GetNoteActionsQuery,
} from '../queries/notes/NoteQueries';

/**
 * Creates handlers for note-related queries.
 * Uses the repository pattern for database abstraction (Convex-ready).
 */
export function createNoteQueryHandlers(noteRepository: INoteRepository) {
  const handleGetNotes: QueryHandler<GetNotesQuery> = async (query) => {
    return noteRepository.getAll(query.payload);
  };

  const handleGetNoteById: QueryHandler<GetNoteByIdQuery> = async (query) => {
    return noteRepository.getById(query.payload.noteId);
  };

  const handleGetNoteVersions: QueryHandler<GetNoteVersionsQuery> = async (query) => {
    return noteRepository.getVersions(query.payload.noteId);
  };

  const handleGetNoteActions: QueryHandler<GetNoteActionsQuery> = async (query) => {
    return noteRepository.getActions(query.payload.noteId);
  };

  return {
    GetNotes: handleGetNotes,
    GetNoteById: handleGetNoteById,
    GetNoteVersions: handleGetNoteVersions,
    GetNoteActions: handleGetNoteActions,
  };
}

// Type for the handlers object
export type NoteQueryHandlers = ReturnType<typeof createNoteQueryHandlers>;
