import { useMemo } from 'react';
import { useNotesConvex } from './convex/useNotesConvex';
import { useActiveProject } from '@/contexts/ProjectContext';
import { useSettings } from './useSettings';

interface UseNotesOptions {
  date?: string;
}

/**
 * Main hook for managing notes
 * Automatically filters by the active project
 */
export function useNotes(options: UseNotesOptions = {}) {
  const { activeProjectId, loading: projectLoading } = useActiveProject();
  const { settings } = useSettings();

  // Use a stable project ID - don't change while loading
  // This prevents the flash of all notes before filtering by project
  const stableProjectId = useMemo(() => {
    // If project context is still loading, use settings as initial value
    if (projectLoading) {
      return settings.activeProjectId;
    }
    return activeProjectId;
  }, [projectLoading, activeProjectId, settings.activeProjectId]);

  const result = useNotesConvex({
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
