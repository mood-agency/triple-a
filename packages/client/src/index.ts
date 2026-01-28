/**
 * @triple-a/client
 *
 * Official TypeScript client for the Triple-A API
 */

// Client
export { TripleAClient, createClient, type ClientError } from './client';

// Config
export { createConfig, validateApiKey, type ClientConfig } from './config';

// Formatters
export {
  formatNotesList,
  formatNote,
  formatSearchResults,
  formatLabelsList,
  formatProjectsList,
  formatContactsList,
  formatSuccess,
  formatError,
} from './formatters';

// Re-export types from @triple-a/types for convenience
export type {
  Note,
  Label,
  Project,
  Contact,
  NoteCategory,
  APIResponse,
  NotesQueryParams,
  CreateNoteInput,
  UpdateNoteInput,
  CreateLabelInput,
  UpdateLabelInput,
  CreateProjectInput,
  UpdateProjectInput,
  CreateContactInput,
  UpdateContactInput,
  SearchRequest,
  BatchRequest,
  BatchResponse,
} from '@triple-a/types';
