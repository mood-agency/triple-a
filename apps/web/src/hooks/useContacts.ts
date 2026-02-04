import { useContactsContext } from '@/contexts/ContactsContext';

/**
 * Main hook for managing contacts.
 * Uses ContactsContext to share state across all components (single fetch + subscription).
 */
export function useContacts() {
  return useContactsContext();
}
