import { useActiveProject } from '@/contexts/ProjectContext';

/**
 * Main hook for managing projects.
 * Uses ProjectContext to share state across all components (single fetch + subscription).
 */
export function useProjects() {
  return useActiveProject();
}
