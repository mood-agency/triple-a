import { useMemo } from 'react';
import { useNotesSupabase } from './supabase/useNotesSupabase';
import { useActiveProject } from '@/contexts/ProjectContext';

interface UseNotesOptions {
  date?: string;
}

/**
 * Main hook for managing notes
 * Automatically filters by the active project
 */
export function useNotes(options: UseNotesOptions = {}) {
  const { activeProjectId, loading: projectLoading } = useActiveProject();

  // Use a stable project ID - only use validated activeProjectId after projects load
  // This prevents querying with an invalid project ID from localStorage
  const stableProjectId = useMemo(() => {
    // If project context is still loading, return undefined to skip the query
    // The ProjectContext will validate the settings.activeProjectId before using it
    if (projectLoading) {
      return undefined;
    }
    return activeProjectId;
  }, [projectLoading, activeProjectId]);

  const result = useNotesSupabase({
    date: options.date,
    projectId: stableProjectId,
  });

  // If project context is loading, return loading state
  if (projectLoading) {
    return {
      ...result,
      loading: true,
    };
  }

  return result;
}
