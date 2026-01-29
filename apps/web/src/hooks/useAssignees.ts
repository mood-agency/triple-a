import { useAssigneesSupabase } from './supabase/useAssigneesSupabase';

/**
 * Main hook for managing assignees
 */
export function useAssignees() {
  return useAssigneesSupabase();
}
