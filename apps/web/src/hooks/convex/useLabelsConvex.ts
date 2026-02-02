import { useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Label } from "@/types/note";

const EMPTY_LABELS: Label[] = [];

/**
 * Check if a string looks like a valid Convex ID (not a UUID)
 */
function isValidConvexId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (id.includes("-")) return false;
  return /^[a-zA-Z0-9_]+$/.test(id);
}

/**
 * Convex-based labels hook
 * Fully reactive - no manual refresh needed
 */
export function useLabelsConvex() {
  const { t } = useTranslation();

  // Reactive query - automatically updates when data changes
  const convexLabels = useQuery(api.labels.list);

  // Reactive batch query for all note labels - updates automatically
  const allNoteLabelsData = useQuery(api.labels.getAllNoteLabels);

  // Mutations
  const createLabelMutation = useMutation(api.labels.create);
  const updateLabelMutation = useMutation(api.labels.update);
  const removeLabelMutation = useMutation(api.labels.remove);
  const addToNoteMutation = useMutation(api.labels.addToNote);
  const removeFromNoteMutation = useMutation(api.labels.removeFromNote);
  const setLabelsForNoteMutation = useMutation(api.labels.setLabelsForNote);

  // Transform Convex labels to match the Label interface
  const labels: Label[] = useMemo(() => {
    if (!convexLabels) return [];

    return convexLabels.map((l) => ({
      id: l._id,
      name: l.name,
      color: l.color,
      created_at: l.createdAt,
      updated_at: l.updatedAt,
      remote_id: l._id,
      sync_status: "synced" as const,
      last_synced_at: l.updatedAt,
    }));
  }, [convexLabels]);

  // PERFORMANCE: Create a stable key to detect actual data changes
  // This prevents unnecessary cache rebuilds when Convex returns the same data
  const allNoteLabelsDataKey = useMemo(() => {
    if (!allNoteLabelsData) return "";
    const entries: string[] = [];
    for (const [noteId, noteLabels] of Object.entries(allNoteLabelsData)) {
      entries.push(`${noteId}:${noteLabels.map((l) => l._id).join(",")}`);
    }
    return entries.sort().join("|");
  }, [allNoteLabelsData]);

  // Ref to hold the stable Map - only updates when data actually changes
  const allNoteLabelsRef = useRef<Map<string, Label[]>>(new Map());

  // Transform all note labels to a map - only when data key changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _allNoteLabels = useMemo(() => {
    if (!allNoteLabelsData) {
      allNoteLabelsRef.current = new Map<string, Label[]>();
      return allNoteLabelsRef.current;
    }

    const map = new Map<string, Label[]>();
    for (const [noteId, noteLabels] of Object.entries(allNoteLabelsData)) {
      map.set(
        noteId,
        noteLabels.map((l) => ({
          id: l._id,
          name: l.name,
          color: l.color,
          created_at: l.createdAt,
          updated_at: l.updatedAt,
          remote_id: l._id,
          sync_status: "synced" as const,
          last_synced_at: l.updatedAt,
        }))
      );
    }
    allNoteLabelsRef.current = map;
    return map;
  }, [allNoteLabelsDataKey]);

  const loading = convexLabels === undefined;

  /**
   * Get labels for a specific note from the reactive cache
   * This is reactive - updates automatically when labels change
   * PERFORMANCE: Uses ref to maintain stable callback reference
   */
  const getLabelsForNote = useCallback(
    (noteId: string): Label[] => {
      return allNoteLabelsRef.current.get(noteId) ?? EMPTY_LABELS;
    },
    [] // Stable reference - uses ref internally
  );

  const createLabel = useCallback(
    async (name: string, color: string = "#6b7280"): Promise<string> => {
      const labelId = await createLabelMutation({ name, color });
      toast.success(t("toast.labelCreated"));
      return labelId;
    },
    [createLabelMutation, t]
  );

  const updateLabel = useCallback(
    async (id: string, name: string, color: string): Promise<void> => {
      if (!isValidConvexId(id)) return;
      await updateLabelMutation({
        id: id as Id<"labels">,
        name,
        color,
      });
      toast.success(t("toast.labelUpdated"));
    },
    [updateLabelMutation, t]
  );

  const deleteLabel = useCallback(
    async (id: string): Promise<void> => {
      if (!isValidConvexId(id)) return;
      await removeLabelMutation({ id: id as Id<"labels"> });
      toast.success(t("toast.labelDeleted"));
    },
    [removeLabelMutation, t]
  );

  const addLabelToNote = useCallback(
    async (noteId: string, labelId: string): Promise<void> => {
      if (!isValidConvexId(noteId) || !isValidConvexId(labelId)) return;
      await addToNoteMutation({
        noteId: noteId as Id<"notes">,
        labelId: labelId as Id<"labels">,
      });
      toast.success(t("toast.labelAdded"));
    },
    [addToNoteMutation, t]
  );

  const removeLabelFromNote = useCallback(
    async (noteId: string, labelId: string): Promise<void> => {
      if (!isValidConvexId(noteId) || !isValidConvexId(labelId)) return;
      await removeFromNoteMutation({
        noteId: noteId as Id<"notes">,
        labelId: labelId as Id<"labels">,
      });
      toast.success(t("toast.labelRemoved"));
    },
    [removeFromNoteMutation, t]
  );

  const setLabelsForNote = useCallback(
    async (noteId: string, labelIds: string[]): Promise<void> => {
      if (!isValidConvexId(noteId)) return;
      const validLabelIds = labelIds.filter(isValidConvexId);
      await setLabelsForNoteMutation({
        noteId: noteId as Id<"notes">,
        labelIds: validLabelIds as Id<"labels">[],
      });
    },
    [setLabelsForNoteMutation]
  );

  return {
    labels,
    loading,
    getLabelsForNote,
    createLabel,
    updateLabel,
    deleteLabel,
    addLabelToNote,
    removeLabelFromNote,
    setLabelsForNote,
  };
}

/**
 * Hook to get labels for a specific note
 * Fully reactive - updates automatically when labels change
 */
export function useNoteLabels(noteId: string | null) {
  const validNoteId = isValidConvexId(noteId) ? noteId : null;

  const convexLabels = useQuery(
    api.labels.getLabelsForNote,
    validNoteId ? { noteId: validNoteId as Id<"notes"> } : "skip"
  );

  const labels: Label[] = useMemo(() => {
    if (!convexLabels) return [];

    return convexLabels.map((l) => ({
      id: l._id,
      name: l.name,
      color: l.color,
      created_at: l.createdAt,
      updated_at: l.updatedAt,
      remote_id: l._id,
      sync_status: "synced" as const,
      last_synced_at: l.updatedAt,
    }));
  }, [convexLabels]);

  return {
    labels,
    loading: convexLabels === undefined,
  };
}
