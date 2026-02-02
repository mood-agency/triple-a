import { useCallback, useMemo, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Contact } from "@/types/contact";

const EMPTY_ASSIGNEES: Contact[] = [];

/**
 * Check if a string looks like a valid Convex ID (not a UUID)
 */
function isValidConvexId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (id.includes("-")) return false;
  return /^[a-zA-Z0-9_]+$/.test(id);
}

/**
 * Convex-based assignees hook
 * Fully reactive - no manual refresh needed
 */
export function useAssigneesConvex() {
  const { t } = useTranslation();

  // Reactive query - automatically updates when data changes
  const convexContacts = useQuery(api.contacts.list);

  // Reactive batch query for all note assignees - updates automatically
  const allNoteAssigneesData = useQuery(api.contacts.getAllNoteAssignees);

  // Mutations
  const addToNoteMutation = useMutation(api.contacts.addToNote);
  const removeFromNoteMutation = useMutation(api.contacts.removeFromNote);
  const setAssigneesMutation = useMutation(api.contacts.setAssigneesForNote);

  const contacts: Contact[] = useMemo(() => {
    if (!convexContacts) return [];

    return convexContacts.map((c) => ({
      id: c._id,
      name: c.name,
      lastname: c.lastname ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      remote_id: c._id,
      sync_status: "synced" as const,
      last_synced_at: c.updatedAt,
    }));
  }, [convexContacts]);

  // PERFORMANCE: Create a stable key to detect actual data changes
  // This prevents unnecessary cache rebuilds when Convex returns the same data
  const allNoteAssigneesDataKey = useMemo(() => {
    if (!allNoteAssigneesData) return "";
    const entries: string[] = [];
    for (const [noteId, noteContacts] of Object.entries(allNoteAssigneesData)) {
      entries.push(`${noteId}:${noteContacts.map((c) => c._id).join(",")}`);
    }
    return entries.sort().join("|");
  }, [allNoteAssigneesData]);

  // Ref to hold the stable Map - only updates when data actually changes
  const allNoteAssigneesRef = useRef<Map<string, Contact[]>>(new Map());

  // Transform all note assignees to a map - only when data key changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _allNoteAssignees = useMemo(() => {
    if (!allNoteAssigneesData) {
      allNoteAssigneesRef.current = new Map<string, Contact[]>();
      return allNoteAssigneesRef.current;
    }

    const map = new Map<string, Contact[]>();
    for (const [noteId, noteContacts] of Object.entries(allNoteAssigneesData)) {
      map.set(
        noteId,
        noteContacts.map((c) => ({
          id: c._id,
          name: c.name,
          lastname: c.lastname ?? "",
          phone: c.phone ?? "",
          email: c.email ?? "",
          created_at: c.createdAt,
          updated_at: c.updatedAt,
          remote_id: c._id,
          sync_status: "synced" as const,
          last_synced_at: c.updatedAt,
        }))
      );
    }
    allNoteAssigneesRef.current = map;
    return map;
  }, [allNoteAssigneesDataKey]);

  /**
   * Get assignees for a specific note from the reactive cache
   * This is reactive - updates automatically when assignees change
   * PERFORMANCE: Uses ref to maintain stable callback reference
   */
  const getAssigneesForNote = useCallback(
    (noteId: string): Contact[] => {
      return allNoteAssigneesRef.current.get(noteId) ?? EMPTY_ASSIGNEES;
    },
    [] // Stable reference - uses ref internally
  );

  const addAssigneeToNote = useCallback(
    async (noteId: string, contactId: string): Promise<void> => {
      if (!isValidConvexId(noteId) || !isValidConvexId(contactId)) return;

      await addToNoteMutation({
        noteId: noteId as Id<"notes">,
        contactId: contactId as Id<"contacts">,
      });

      toast.success(t("toast.assigneeAdded"));
    },
    [addToNoteMutation, t]
  );

  const removeAssigneeFromNote = useCallback(
    async (noteId: string, contactId: string): Promise<void> => {
      if (!isValidConvexId(noteId) || !isValidConvexId(contactId)) return;

      await removeFromNoteMutation({
        noteId: noteId as Id<"notes">,
        contactId: contactId as Id<"contacts">,
      });

      toast.success(t("toast.assigneeRemoved"));
    },
    [removeFromNoteMutation, t]
  );

  const setAssigneesForNote = useCallback(
    async (noteId: string, contactIds: string[]): Promise<void> => {
      if (!isValidConvexId(noteId)) return;

      const validContactIds = contactIds.filter(isValidConvexId);

      await setAssigneesMutation({
        noteId: noteId as Id<"notes">,
        contactIds: validContactIds as Id<"contacts">[],
      });
    },
    [setAssigneesMutation]
  );

  return {
    contacts,
    getAssigneesForNote,
    addAssigneeToNote,
    removeAssigneeFromNote,
    setAssigneesForNote,
  };
}

/**
 * Hook to get assignees for a specific note
 * Fully reactive - updates automatically when assignees change
 */
export function useNoteAssignees(noteId: string | null) {
  const validNoteId = isValidConvexId(noteId) ? noteId : null;

  const convexAssignees = useQuery(
    api.contacts.getAssigneesForNote,
    validNoteId ? { noteId: validNoteId as Id<"notes"> } : "skip"
  );

  const assignees: Contact[] = useMemo(() => {
    if (!convexAssignees) return [];

    return convexAssignees.map((c) => ({
      id: c._id,
      name: c.name,
      lastname: c.lastname ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      remote_id: c._id,
      sync_status: "synced" as const,
      last_synced_at: c.updatedAt,
    }));
  }, [convexAssignees]);

  return {
    assignees,
    loading: convexAssignees === undefined,
  };
}
