import { useNoteVersionsAndActionsConvex } from "./convex/useNoteVersionsAndActionsConvex";

/**
 * Hook for managing note versions and actions
 * Now uses Convex for real-time data
 */
export function useNoteVersionsAndActions(noteId: string | null) {
  return useNoteVersionsAndActionsConvex(noteId);
}
