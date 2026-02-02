import { useCallback, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { Contact, ContactInput } from "@/types/contact";

/**
 * Convex-based contacts hook
 * Provides the same API as useContactsSupabase
 */
export function useContactsConvex() {
  // Query contacts from Convex
  const convexContacts = useQuery(api.contacts.list);

  // Mutations
  const createContactMutation = useMutation(api.contacts.create);
  const updateContactMutation = useMutation(api.contacts.update);
  const removeContactMutation = useMutation(api.contacts.remove);

  // Transform Convex contacts to match the Contact interface
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
      user_id: c.userId,
      remote_id: c._id,
      sync_status: "synced" as const,
      last_synced_at: c.updatedAt,
      deleted_at: c.deletedAt ?? null,
    }));
  }, [convexContacts]);

  const loading = convexContacts === undefined;

  /**
   * Create a new contact
   */
  const createContact = useCallback(
    async (contactInput: ContactInput): Promise<Contact> => {
      const contactId = await createContactMutation({
        name: contactInput.name,
        lastname: contactInput.lastname || undefined,
        email: contactInput.email || undefined,
        phone: contactInput.phone || undefined,
      });

      const now = new Date().toISOString();
      return {
        id: contactId,
        name: contactInput.name,
        lastname: contactInput.lastname || "",
        phone: contactInput.phone || "",
        email: contactInput.email || "",
        created_at: now,
        updated_at: now,
        remote_id: contactId,
        sync_status: "synced",
      };
    },
    [createContactMutation]
  );

  /**
   * Update a contact
   */
  const updateContact = useCallback(
    async (id: string, contactInput: Partial<ContactInput>): Promise<Contact> => {
      await updateContactMutation({
        id: id as Id<"contacts">,
        name: contactInput.name,
        lastname: contactInput.lastname,
        email: contactInput.email,
        phone: contactInput.phone,
      });

      // Find existing contact for return value
      const existing = contacts.find((c) => c.id === id);
      const now = new Date().toISOString();

      return {
        id,
        name: contactInput.name ?? existing?.name ?? "",
        lastname: contactInput.lastname ?? existing?.lastname ?? "",
        phone: contactInput.phone ?? existing?.phone ?? "",
        email: contactInput.email ?? existing?.email ?? "",
        created_at: existing?.created_at ?? now,
        updated_at: now,
        user_id: existing?.user_id,
      };
    },
    [updateContactMutation, contacts]
  );

  /**
   * Delete a contact (soft delete)
   */
  const deleteContact = useCallback(
    async (id: string): Promise<void> => {
      await removeContactMutation({ id: id as Id<"contacts"> });
    },
    [removeContactMutation]
  );

  return {
    contacts,
    loading,
    createContact,
    updateContact,
    deleteContact,
  };
}

/**
 * Hook to get assignees for a specific note
 */
export function useNoteAssignees(noteId: string | null) {
  const convexAssignees = useQuery(
    api.contacts.getAssigneesForNote,
    noteId ? { noteId: noteId as Id<"notes"> } : "skip"
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
      user_id: c.userId,
      remote_id: c._id,
      sync_status: "synced" as const,
      last_synced_at: c.updatedAt,
      deleted_at: c.deletedAt ?? null,
    }));
  }, [convexAssignees]);

  return {
    assignees,
    loading: convexAssignees === undefined,
  };
}
