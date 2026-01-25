import { useNotesStore } from './tinybase/useNotesStore';

/**
 * Main hook for managing notes
 */
export function useNotes(date?: string) {
  return useNotesStore(date);
}
