import { useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Note, NoteCategory } from "@/types/note";
import { formatLocalDate } from "@/utils/dateUtils";

interface UseNotesConvexOptions {
  date?: string;
  projectId?: string | null;
}

/**
 * Check if a string looks like a valid Convex ID (not a UUID)
 * Convex IDs are base64-like strings, UUIDs have dashes
 */
function isValidConvexId(id: string | null | undefined): boolean {
  if (!id) return false;
  // UUIDs have dashes, Convex IDs don't
  if (id.includes("-")) return false;
  // Convex IDs are typically alphanumeric
  return /^[a-zA-Z0-9_]+$/.test(id);
}

/**
 * Convex-based notes hook
 * Provides the same API as useNotesSupabase
 */
export function useNotesConvex(options: UseNotesConvexOptions = {}) {
  const { date, projectId } = options;

  const defaultDate = formatLocalDate(new Date());
  const effectiveDate = date || defaultDate;

  // Only use projectId if it's a valid Convex ID (not a Supabase UUID)
  const validProjectId = isValidConvexId(projectId) ? projectId : undefined;

  // Query notes from Convex
  const convexNotes = useQuery(api.notes.list, {
    projectId: validProjectId as Id<"projects"> | undefined,
    date: date,
  });

  // Mutations
  const createNoteMutation = useMutation(api.notes.create);
  const updateNoteMutation = useMutation(api.notes.update);
  const toggleCompleteMutation = useMutation(api.notes.toggleComplete);
  const togglePinMutation = useMutation(api.notes.togglePin);
  const softDeleteMutation = useMutation(api.notes.softDelete);
  const restoreMutation = useMutation(api.notes.restore);
  const postponeMutation = useMutation(api.notes.postpone);
  const updateSortOrderMutation = useMutation(api.notes.updateSortOrder);

  // Transform Convex notes to match the Note interface
  const notes: Note[] = useMemo(() => {
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
      last_synced_at: n.updatedAt,
      gcal_event_id: n.gcalEventId ?? null,
      is_public: n.isPublic,
      public_slug: n.publicSlug ?? null,
    }));
  }, [convexNotes]);

  const loading = convexNotes === undefined;

  /**
   * Create a new note
   */
  const createNote = useCallback(
    async (
      content: string,
      category: NoteCategory = "todo",
      description?: string | null,
      labelIds?: string[]
    ): Promise<Note> => {
      // Filter out invalid label IDs (Supabase UUIDs)
      const validLabelIds = labelIds?.filter(isValidConvexId);

      const noteId = await createNoteMutation({
        content,
        category,
        description: description ?? undefined,
        date: effectiveDate,
        projectId: validProjectId as Id<"projects"> | undefined,
        labelIds: validLabelIds as Id<"labels">[] | undefined,
      });

      // Return a temporary note object (Convex will update via subscription)
      const now = new Date().toISOString();
      return {
        id: noteId,
        date: effectiveDate,
        content,
        description: description ?? null,
        category,
        completed: false,
        completed_at: null,
        deadline: null,
        pinned: false,
        sort_order: notes.length,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        deleted_reason: null,
        project_id: validProjectId ?? null,
        remote_id: noteId,
        sync_status: "synced",
        is_public: false,
        public_slug: null,
      };
    },
    [createNoteMutation, effectiveDate, validProjectId, notes.length]
  );

  /**
   * Create a note after a specific note
   */
  const createNoteAfter = useCallback(
    async (
      afterNoteId: string,
      category: NoteCategory = "todo",
      deadline?: string | null,
      labelIds: string[] = [],
      _assigneeId?: string | null,
      _newNoteId?: string
    ): Promise<Note> => {
      // Filter out invalid label IDs (Supabase UUIDs)
      const validLabelIds = labelIds.filter(isValidConvexId);

      const noteId = await createNoteMutation({
        content: "",
        category,
        deadline: deadline ?? undefined,
        date: effectiveDate,
        projectId: validProjectId as Id<"projects"> | undefined,
        labelIds: validLabelIds as Id<"labels">[],
      });

      // Reorder to place after the specified note
      const afterNote = notes.find((n) => n.id === afterNoteId);
      if (afterNote) {
        const sortedNotes = [...notes].sort((a, b) => a.sort_order - b.sort_order);
        const afterIndex = sortedNotes.findIndex((n) => n.id === afterNoteId);

        // Calculate new sort order
        let newSortOrder: number;
        if (afterIndex >= 0 && afterIndex < sortedNotes.length - 1) {
          const nextSortOrder = sortedNotes[afterIndex + 1].sort_order;
          newSortOrder = (afterNote.sort_order + nextSortOrder) / 2;
        } else {
          newSortOrder = afterNote.sort_order + 1;
        }

        await updateSortOrderMutation({
          updates: [{ id: noteId, sortOrder: newSortOrder }],
        });
      }

      const now = new Date().toISOString();
      return {
        id: noteId,
        date: effectiveDate,
        content: "",
        description: null,
        category,
        completed: false,
        completed_at: null,
        deadline: deadline ?? null,
        pinned: false,
        sort_order: notes.length,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        deleted_reason: null,
        project_id: validProjectId ?? null,
        remote_id: noteId,
        sync_status: "synced",
        is_public: false,
        public_slug: null,
      };
    },
    [createNoteMutation, updateSortOrderMutation, effectiveDate, validProjectId, notes]
  );

  /**
   * Update a note
   */
  const updateNote = useCallback(
    async (
      id: string,
      content: string,
      category?: NoteCategory,
      description?: string | null
    ): Promise<void> => {
      await updateNoteMutation({
        id: id as Id<"notes">,
        content,
        category,
        description: description ?? undefined,
      });
    },
    [updateNoteMutation]
  );

  /**
   * Delete a note (soft delete)
   */
  const deleteNote = useCallback(
    async (id: string, reason: string): Promise<void> => {
      await softDeleteMutation({
        id: id as Id<"notes">,
        reason,
      });
    },
    [softDeleteMutation]
  );

  /**
   * Restore a deleted note
   */
  const restoreNote = useCallback(
    async (note: Note): Promise<void> => {
      await restoreMutation({
        id: note.id as Id<"notes">,
      });
    },
    [restoreMutation]
  );

  /**
   * Toggle completed status
   */
  const toggleCompleted = useCallback(
    async (id: string, _completed: boolean): Promise<void> => {
      await toggleCompleteMutation({
        id: id as Id<"notes">,
      });
    },
    [toggleCompleteMutation]
  );

  /**
   * Toggle pinned status
   */
  const togglePinned = useCallback(
    async (id: string, _pinned: boolean): Promise<void> => {
      await togglePinMutation({
        id: id as Id<"notes">,
      });
    },
    [togglePinMutation]
  );

  /**
   * Update deadline
   */
  const updateDeadline = useCallback(
    async (id: string, deadline: string | null): Promise<void> => {
      await updateNoteMutation({
        id: id as Id<"notes">,
        deadline: deadline ?? undefined,
      });
    },
    [updateNoteMutation]
  );

  /**
   * Update project
   */
  const updateProject = useCallback(
    async (id: string, newProjectId: string | null): Promise<void> => {
      // Only use projectId if it's a valid Convex ID
      const validNewProjectId = isValidConvexId(newProjectId) ? newProjectId : undefined;

      await updateNoteMutation({
        id: id as Id<"notes">,
        projectId: validNewProjectId as Id<"projects"> | undefined,
      });
    },
    [updateNoteMutation]
  );

  /**
   * Postpone a note
   */
  const postponeNote = useCallback(
    async (id: string, newDeadline: string, reason?: string): Promise<void> => {
      await postponeMutation({
        id: id as Id<"notes">,
        newDeadline,
        reason,
      });
    },
    [postponeMutation]
  );

  /**
   * Reorder notes
   */
  const reorderNotes = useCallback(
    async (orderedIds: string[]): Promise<void> => {
      const updates = orderedIds.map((noteId, index) => ({
        id: noteId as Id<"notes">,
        sortOrder: index,
      }));
      await updateSortOrderMutation({ updates });
    },
    [updateSortOrderMutation]
  );

  // Toggle public mutation
  const togglePublicMutation = useMutation(api.notes.togglePublic);

  /**
   * Toggle public sharing
   */
  const togglePublic = useCallback(
    async (id: string, makePublic: boolean): Promise<string | null> => {
      if (!isValidConvexId(id)) return null;
      const result = await togglePublicMutation({
        id: id as Id<"notes">,
        makePublic,
      });
      return result ?? null;
    },
    [togglePublicMutation]
  );

  return {
    notes,
    loading,
    createNote,
    createNoteAfter,
    updateNote,
    updateDeadline,
    updateProject,
    toggleCompleted,
    togglePinned,
    deleteNote,
    restoreNote,
    reorderNotes,
    postponeNote,
    togglePublic,
  };
}
