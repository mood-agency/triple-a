import { useLabelsSupabase } from './supabase/useLabelsSupabase';

/**
 * Main hook for managing labels
 */
export function useLabels() {
  return useLabelsSupabase();
}
