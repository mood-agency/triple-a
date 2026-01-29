import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useAssigneesSupabase } from '@/hooks/supabase/useAssigneesSupabase';
import type { Contact } from '@/types/contact';

interface AssigneesContextValue {
  /** Version number that increments when assignees change - use for cache invalidation */
  noteAssigneeVersion: number;
  /** Get assignees for a specific note */
  getAssigneesForNote: (noteId: string) => Contact[];
  /** Add an assignee to a note */
  addAssigneeToNote: (noteId: string, contactId: string) => Promise<void>;
  /** Remove an assignee from a note */
  removeAssigneeFromNote: (noteId: string, contactId: string) => Promise<void>;
  /** Set all assignees for a note (replaces existing) */
  setAssigneesForNote: (noteId: string, contactIds: string[]) => Promise<void>;
}

const AssigneesContext = createContext<AssigneesContextValue | null>(null);

interface AssigneesProviderProps {
  children: ReactNode;
}

export function AssigneesProvider({ children }: AssigneesProviderProps) {
  const {
    noteAssigneeVersion,
    getAssigneesForNote,
    addAssigneeToNote,
    removeAssigneeFromNote,
    setAssigneesForNote,
  } = useAssigneesSupabase();

  const value = useMemo(() => ({
    noteAssigneeVersion,
    getAssigneesForNote,
    addAssigneeToNote,
    removeAssigneeFromNote,
    setAssigneesForNote,
  }), [
    noteAssigneeVersion,
    getAssigneesForNote,
    addAssigneeToNote,
    removeAssigneeFromNote,
    setAssigneesForNote,
  ]);

  return (
    <AssigneesContext.Provider value={value}>
      {children}
    </AssigneesContext.Provider>
  );
}

export function useAssigneesContext() {
  const context = useContext(AssigneesContext);
  if (!context) {
    throw new Error('useAssigneesContext must be used within an AssigneesProvider');
  }
  return context;
}
