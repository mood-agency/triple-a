import { useDeletedNotesConvex } from "./convex/useDeletedNotesConvex";

/**
 * Hook for managing deleted notes
 * Now uses Convex for real-time data
 */
export function useDeletedNotes() {
  return useDeletedNotesConvex();
}
