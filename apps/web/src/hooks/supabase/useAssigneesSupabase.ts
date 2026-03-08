import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useContactsContext } from '@/contexts/ContactsContext';
import { supabase } from '@/lib/supabase';
import { useEventSubscription } from '@/events';
import type { Contact } from '@/types/contact';

/**
 * Supabase-direct assignees hook.
 * Reuses contacts from ContactsContext (no duplicate fetch).
 * Only fetches note_assignees mappings independently.
 */
export function useAssigneesSupabase() {
  const { user } = useAuth();
  const userId = user?.id;
  const { t } = useTranslation();
  const { contacts } = useContactsContext();
  const [noteAssigneeVersion, setNoteAssigneeVersion] = useState(0);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  // Ref to always hold the latest fetchNoteAssignees — avoids re-subscribing realtime on fetch changes
  const fetchNoteAssigneesRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const [noteAssigneesMap, setNoteAssigneesMap] = useState<Record<string, string[]>>({});

  /**
   * Fetch note_assignees mappings from Supabase
   */
  const fetchNoteAssignees = useCallback(async () => {
    if (!userId || !supabase) return;

    const { data, error } = await supabase
      .from('note_assignees')
      .select('note_id, contact_id');

    if (error) {
      console.error('[useAssigneesSupabase] Fetch note_assignees error:', error);
      return;
    }

    const newNoteAssigneesMap: Record<string, string[]> = {};
    if (data) {
      for (const row of data) {
        if (!newNoteAssigneesMap[row.note_id]) {
          newNoteAssigneesMap[row.note_id] = [];
        }
        newNoteAssigneesMap[row.note_id].push(row.contact_id);
      }
    }

    setNoteAssigneesMap(newNoteAssigneesMap);
  }, [userId]);

  // Keep ref in sync so realtime handlers always call the latest version
  fetchNoteAssigneesRef.current = fetchNoteAssignees;

  // Initial fetch
  useEffect(() => {
    fetchNoteAssignees();
  }, [fetchNoteAssignees]);

  // Realtime subscription for note_assignees changes
  // Uses fetchNoteAssigneesRef so subscription doesn't need to be torn down on fetch fn change
  useEffect(() => {
    if (!userId || !supabase) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`note-assignees-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_assignees',
        },
        () => fetchNoteAssigneesRef.current()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  // Listen for assignee:added events to update local cache immediately (optimistic)
  useEventSubscription('assignee:added', (event) => {
    const { noteId, contactId } = event.payload;
    setNoteAssigneesMap((prev) => {
      const existing = prev[noteId] || [];
      if (existing.includes(contactId)) return prev;
      return { ...prev, [noteId]: [...existing, contactId] };
    });
    setNoteAssigneeVersion((v) => v + 1);
  });

  // Listen for assignee:removed events to update local cache immediately (optimistic)
  useEventSubscription('assignee:removed', (event) => {
    const { noteId, contactId } = event.payload;
    setNoteAssigneesMap((prev) => {
      const existing = prev[noteId] || [];
      if (!existing.includes(contactId)) return prev;
      return { ...prev, [noteId]: existing.filter((id) => id !== contactId) };
    });
    setNoteAssigneeVersion((v) => v + 1);
  });

  /**
   * Get assignees for a specific note (uses cached note_assignees map + shared contacts)
   */
  const getAssigneesForNote = useCallback(
    (noteId: string): Contact[] => {
      const contactIds = noteAssigneesMap[noteId] || [];
      return contacts
        .filter((contact) => contactIds.includes(contact.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [noteAssigneesMap, contacts]
  );

  /**
   * Add an assignee to a note
   */
  const addAssigneeToNote = useCallback(
    async (noteId: string, contactId: string): Promise<void> => {
      if (!supabase || !userId) throw new Error('Supabase not configured');

      // Check if already exists locally
      const existingIds = noteAssigneesMap[noteId] || [];
      if (existingIds.includes(contactId)) return;

      const { error } = await supabase.from('note_assignees').insert({
        note_id: noteId,
        contact_id: contactId,
        user_id: userId,
      });

      if (error) throw error;

      // Update local cache
      setNoteAssigneesMap((prev) => ({
        ...prev,
        [noteId]: [...(prev[noteId] || []), contactId],
      }));

      setNoteAssigneeVersion((v) => v + 1);
      toast.success(t('toast.assigneeAdded'));
    },
    [t, noteAssigneesMap, userId]
  );

  /**
   * Remove an assignee from a note
   */
  const removeAssigneeFromNote = useCallback(
    async (noteId: string, contactId: string): Promise<void> => {
      if (!supabase) throw new Error('Supabase not configured');

      const { error } = await supabase
        .from('note_assignees')
        .delete()
        .eq('note_id', noteId)
        .eq('contact_id', contactId);

      if (error) throw error;

      // Update local cache
      setNoteAssigneesMap((prev) => ({
        ...prev,
        [noteId]: (prev[noteId] || []).filter((id) => id !== contactId),
      }));

      setNoteAssigneeVersion((v) => v + 1);
      toast.success(t('toast.assigneeRemoved'));
    },
    [t]
  );

  /**
   * Set all assignees for a note (replaces existing)
   */
  const setAssigneesForNote = useCallback(async (noteId: string, contactIds: string[]): Promise<void> => {
    if (!supabase || !userId) throw new Error('Supabase not configured');

    // Remove all existing
    await supabase.from('note_assignees').delete().eq('note_id', noteId);

    // Add new ones
    if (contactIds.length > 0) {
      const inserts = contactIds.map((contactId) => ({
        note_id: noteId,
        contact_id: contactId,
        user_id: userId,
      }));
      await supabase.from('note_assignees').insert(inserts);
    }

    // Update local cache
    setNoteAssigneesMap((prev) => ({
      ...prev,
      [noteId]: contactIds,
    }));

    setNoteAssigneeVersion((v) => v + 1);
  }, [userId]);

  return {
    noteAssigneeVersion,
    getAssigneesForNote,
    addAssigneeToNote,
    removeAssigneeFromNote,
    setAssigneesForNote,
  };
}
