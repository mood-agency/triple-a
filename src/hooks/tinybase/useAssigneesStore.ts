import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import type { Contact } from '@/types/contact';
import { now } from '@/store/schema';

/**
 * TinyBase-based assignees hook
 * Provides API for managing note-assignee relationships
 * Mirrors the structure of useLabelsStore
 */
export function useAssigneesStore() {
  const { store, isReady } = useTinyBase();
  const { t } = useTranslation();
  const [noteAssigneeVersion, setNoteAssigneeVersion] = useState(0);

  /**
   * Get assignees for a specific note
   */
  const getAssigneesForNote = useCallback(
    (noteId: string): Contact[] => {
      if (!store || !isReady) return [];

      const noteAssigneesTable = store.getTable('note_assignees') || {};
      const contactsTable = store.getTable('contacts') || {};

      // Find all contact IDs for this note
      const contactIds = Object.values(noteAssigneesTable)
        .filter((row) => (row as Record<string, unknown>).note_id === noteId)
        .map((row) => (row as Record<string, unknown>).contact_id as string);

      // Get the actual contacts
      const contacts = contactIds
        .map((contactId) => {
          const contactRow = contactsTable[contactId] as Record<string, unknown> | undefined;
          if (!contactRow || contactRow.deleted_at) return null;
          const contact: Contact = {
            id: contactId,
            name: contactRow.name as string,
            lastname: (contactRow.lastname as string) || '',
            phone: (contactRow.phone as string) || '',
            email: (contactRow.email as string) || '',
            created_at: contactRow.created_at as string,
            updated_at: contactRow.updated_at as string,
            user_id: (contactRow.user_id as string) || undefined,
            remote_id: (contactRow.remote_id as string) || null,
            sync_status: (contactRow.sync_status as Contact['sync_status']) || 'local',
            last_synced_at: (contactRow.last_synced_at as string) || null,
            deleted_at: (contactRow.deleted_at as string) || null,
          };
          return contact;
        })
        .filter((c): c is Contact => c !== null);

      return contacts.sort((a, b) => 
        `${a.name} ${a.lastname}`.localeCompare(`${b.name} ${b.lastname}`)
      );
    },
    [store, isReady]
  );

  /**
   * Add an assignee to a note
   */
  const addAssigneeToNote = useCallback(
    async (noteId: string, contactId: string): Promise<void> => {
      if (!store) throw new Error('Store not ready');

      const noteAssigneeId = `${noteId}-${contactId}`;
      const timestamp = now();

      // Check if already exists
      const existing = store.getRow('note_assignees', noteAssigneeId);
      if (existing && Object.keys(existing).length > 0) return;

      store.setRow('note_assignees', noteAssigneeId, {
        note_id: noteId,
        contact_id: contactId,
        created_at: timestamp,
        sync_status: 'pending',
      });

      setNoteAssigneeVersion((v) => v + 1);
      toast.success(t('toast.assigneeAdded'));
    },
    [store, t]
  );

  /**
   * Remove an assignee from a note
   */
  const removeAssigneeFromNote = useCallback(
    async (noteId: string, contactId: string): Promise<void> => {
      if (!store) throw new Error('Store not ready');

      const noteAssigneeId = `${noteId}-${contactId}`;
      store.delRow('note_assignees', noteAssigneeId);

      setNoteAssigneeVersion((v) => v + 1);
      toast.success(t('toast.assigneeRemoved'));
    },
    [store, t]
  );

  /**
   * Set all assignees for a note (replaces existing)
   */
  const setAssigneesForNote = useCallback(
    async (noteId: string, contactIds: string[]): Promise<void> => {
      if (!store) throw new Error('Store not ready');

      const timestamp = now();
      const noteAssigneesTable = store.getTable('note_assignees') || {};

      // Remove all existing assignees for this note
      for (const [noteAssigneeId, row] of Object.entries(noteAssigneesTable)) {
        if ((row as Record<string, unknown>).note_id === noteId) {
          store.delRow('note_assignees', noteAssigneeId);
        }
      }

      // Add new assignees
      for (const contactId of contactIds) {
        const noteAssigneeId = `${noteId}-${contactId}`;
        store.setRow('note_assignees', noteAssigneeId, {
          note_id: noteId,
          contact_id: contactId,
          created_at: timestamp,
          sync_status: 'pending',
        });
      }

      setNoteAssigneeVersion((v) => v + 1);
    },
    [store]
  );

  return {
    noteAssigneeVersion,
    getAssigneesForNote,
    addAssigneeToNote,
    removeAssigneeFromNote,
    setAssigneesForNote,
  };
}
