import { useAssigneesStore } from './tinybase/useAssigneesStore';

/**
 * Main hook for managing assignees
 */
export function useAssignees() {
  return useAssigneesStore();
}
