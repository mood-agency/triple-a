import { useContactsSupabase } from './supabase/useContactsSupabase';

/**
 * Main hook for managing contacts
 */
export function useContacts() {
  return useContactsSupabase();
}
