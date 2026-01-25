import { useNotesStore } from './tinybase/useNotesStore';
import { useActiveProject } from '@/contexts/ProjectContext';

interface UseNotesOptions {
  date?: string;
}

/**
 * Main hook for managing notes
 * Automatically filters by the active project
 */
export function useNotes(options: UseNotesOptions = {}) {
  const { activeProjectId } = useActiveProject();

  return useNotesStore({
    date: options.date,
    projectId: activeProjectId,
  });
}
