import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAssigneesConvex } from "@/hooks/convex/useAssigneesConvex";
import type { Contact } from "@/types/contact";

interface AssigneesContextValue {
  /** All contacts */
  contacts: Contact[];
  /** Get assignees for a specific note - reactive with Convex */
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
    contacts,
    getAssigneesForNote,
    addAssigneeToNote,
    removeAssigneeFromNote,
    setAssigneesForNote,
  } = useAssigneesConvex();

  const value = useMemo(
    () => ({
      contacts,
      getAssigneesForNote,
      addAssigneeToNote,
      removeAssigneeFromNote,
      setAssigneesForNote,
    }),
    [
      contacts,
      getAssigneesForNote,
      addAssigneeToNote,
      removeAssigneeFromNote,
      setAssigneesForNote,
    ]
  );

  return (
    <AssigneesContext.Provider value={value}>
      {children}
    </AssigneesContext.Provider>
  );
}

export function useAssigneesContext() {
  const context = useContext(AssigneesContext);
  if (!context) {
    throw new Error(
      "useAssigneesContext must be used within an AssigneesProvider"
    );
  }
  return context;
}
