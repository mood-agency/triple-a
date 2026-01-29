import { useProjectsSupabase } from './supabase/useProjectsSupabase';

/**
 * Main hook for managing projects
 */
export function useProjects() {
  return useProjectsSupabase();
}
