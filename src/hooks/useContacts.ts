import { useContactsStore } from './tinybase/useContactsStore';

/**
 * Main hook for managing contacts
 */
export function useContacts() {
  return useContactsStore();
}
