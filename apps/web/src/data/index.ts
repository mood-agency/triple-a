// Providers
export { DataProvider, useData, useNoteRepository, useLabelRepository, useAssigneeRepository } from './DataProvider';
export { RepositoryProvider } from './RepositoryProvider';

// Factory
export { createSupabaseRepositories, type CreateRepositoriesOptions } from './createRepositories';

// Types
export type {
  RealtimeEventType,
  RealtimeEvent,
  NoteFilters,
  CreateNoteData,
  UpdateNoteData,
  CreateLabelData,
  UpdateLabelData,
  CreateContactData,
  UpdateContactData,
  INoteRepository,
  ILabelRepository,
  IAssigneeRepository,
  Repositories,
} from './types';

// Supabase Implementations
export {
  SupabaseNoteRepository,
  SupabaseLabelRepository,
  SupabaseAssigneeRepository,
} from './supabase';
