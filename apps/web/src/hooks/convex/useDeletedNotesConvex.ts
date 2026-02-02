import { useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Note, NoteCategory } from "@/types/note";

/**
 * Check if a string looks like a valid Convex ID (not a UUID)
 */
function isValidConvexId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (id.includes("-")) return false;
  return /^[a-zA-Z0-9_]+$/.test(id);
}

/**
 * Convex-based deleted notes hook
 */
export function useDeletedNotesConvex() {
  const convexNotes = useQuery(api.notes.listDeleted);
  const restoreMutation = useMutation(api.notes.restore);
  const permanentDeleteMutation = useMutation(api.notes.permanentDelete);
  const permanentDeleteAllMutation = useMutation(api.notes.permanentDeleteAll);

  const deletedNotes: Note[] = useMemo(() => {
    if (!convexNotes) return [];

    return convexNotes.map((n) => ({
      id: n._id,
      date: n.date,
      content: n.content,
      description: n.description ?? null,
      category: n.category as NoteCategory,
      completed: n.completed,
      completed_at: n.completedAt ?? null,
      deadline: n.deadline ?? null,
      pinned: n.pinned,
      sort_order: n.sortOrder,
      created_at: n.createdAt,
      updated_at: n.updatedAt,
      deleted_at: n.deletedAt ?? null,
      deleted_reason: n.deletedReason ?? null,
      project_id: n.projectId ?? null,
      remote_id: n._id,
      sync_status: "synced" as const,
      is_public: n.isPublic,
      public_slug: n.publicSlug ?? null,
    }));
  }, [convexNotes]);

  const loading = convexNotes === undefined;

  const refresh = useCallback(() => {
    // Convex automatically refreshes via subscriptions
  }, []);

  const restoreNote = useCallback(
    async (noteId: string) => {
      if (!isValidConvexId(noteId)) return;
      await restoreMutation({ id: noteId as Id<"notes"> });
    },
    [restoreMutation]
  );

  const permanentDelete = useCallback(
    async (noteId: string) => {
      if (!isValidConvexId(noteId)) return;
      await permanentDeleteMutation({ id: noteId as Id<"notes"> });
    },
    [permanentDeleteMutation]
  );

  const permanentDeleteAll = useCallback(async () => {
    const validIds = deletedNotes
      .filter((n) => isValidConvexId(n.id))
      .map((n) => n.id as Id<"notes">);
    if (validIds.length === 0) return;
    await permanentDeleteAllMutation({ ids: validIds });
  }, [deletedNotes, permanentDeleteAllMutation]);

  return {
    deletedNotes,
    loading,
    refresh,
    restoreNote,
    permanentDelete,
    permanentDeleteAll,
  };
}
