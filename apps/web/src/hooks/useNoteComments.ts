import { useNoteCommentsConvex } from "./convex/useNoteCommentsConvex";

/**
 * Hook for managing note comments
 * Now uses Convex for real-time data
 */
export function useNoteComments(noteId: string) {
  return useNoteCommentsConvex(noteId);
}
