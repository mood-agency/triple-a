import { useAssigneesContext } from '@/contexts/AssigneesContext';

/**
 * Main hook for managing assignees
 * Uses AssigneesContext to share state across all components
 */
export function useAssignees() {
  return useAssigneesContext();
}
