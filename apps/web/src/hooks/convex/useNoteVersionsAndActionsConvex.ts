import { useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteVersion, NoteAction, NoteCategory } from "@/types/note";

/**
 * Check if a string looks like a valid Convex ID (not a UUID)
 */
function isValidConvexId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (id.includes("-")) return false;
  return /^[a-zA-Z0-9_]+$/.test(id);
}

/**
 * Convex-based note versions and actions hook
 */
export function useNoteVersionsAndActionsConvex(noteId: string | null) {
  const validNoteId = isValidConvexId(noteId) ? noteId : null;

  const convexVersions = useQuery(
    api.notes.getVersions,
    validNoteId ? { noteId: validNoteId as Id<"notes"> } : "skip"
  );

  const convexActions = useQuery(
    api.notes.getActions,
    validNoteId ? { noteId: validNoteId as Id<"notes"> } : "skip"
  );

  const deleteActionMutation = useMutation(api.notes.deleteAction);
  const updateReasonMutation = useMutation(api.notes.updateActionReason);

  const versions: NoteVersion[] = useMemo(() => {
    if (!convexVersions) return [];

    return convexVersions.map((v) => ({
      id: v._id,
      note_id: v.noteId,
      content: v.content,
      description: v.description ?? null,
      category: v.category as NoteCategory,
      completed: v.completed,
      version_number: v.versionNumber,
      created_at: v.createdAt,
    }));
  }, [convexVersions]);

  const actions: NoteAction[] = useMemo(() => {
    if (!convexActions) return [];

    return convexActions.map((a) => ({
      id: a._id,
      note_id: a.noteId,
      action_type: a.actionType as "postponed",
      reason: a.reason ?? null,
      previous_date: a.previousDate ?? null,
      new_date: a.newDate ?? null,
      created_at: a.createdAt,
    }));
  }, [convexActions]);

  const loading = convexVersions === undefined || convexActions === undefined;

  const deleteAction = useCallback(
    async (actionId: string) => {
      if (!isValidConvexId(actionId)) return;
      await deleteActionMutation({ actionId: actionId as Id<"noteActions"> });
    },
    [deleteActionMutation]
  );

  const updateReason = useCallback(
    async (actionId: string, newReason: string) => {
      if (!isValidConvexId(actionId)) return;
      await updateReasonMutation({
        actionId: actionId as Id<"noteActions">,
        reason: newReason,
      });
    },
    [updateReasonMutation]
  );

  const reload = useCallback(() => {
    // Convex automatically refreshes via subscriptions
  }, []);

  return {
    versions,
    actions,
    postponeActions: actions,
    loading,
    reload,
    deleteAction,
    updateReason,
  };
}
