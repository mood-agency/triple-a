import { useProjectsStore } from './tinybase/useProjectsStore';

/**
 * Main hook for managing projects
 */
export function useProjects() {
  return useProjectsStore();
}
