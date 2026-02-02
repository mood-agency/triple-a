import { useContactsConvex, useNoteAssignees } from './convex/useContactsConvex';

/**
 * Main hook for managing contacts
 */
export function useContacts() {
  return useContactsConvex();
}

// Re-export useNoteAssignees for direct assignee queries per note
export { useNoteAssignees };
