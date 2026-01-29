import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Contact } from '@/types/contact';

/**
 * Supabase-direct assignees hook
 * Provides the same API as useAssigneesStore but queries Supabase directly
 */
export function useAssigneesSupabase() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [noteAssigneeVersion, setNoteAssigneeVersion] = useState(0);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  // Cache for contacts and note-assignee relationships
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [noteAssigneesMap, setNoteAssigneesMap] = useState<Record<string, string[]>>({});

  /**
   * Fetch contacts and note_assignees from Supabase
   */
  const fetchAssignees = useCallback(async () => {
    if (!user || !supabase) return;

    // Fetch contacts and note_assignees in parallel
    const [contactsResult, noteAssigneesResult] = await Promise.all([
      supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('name'),
      supabase.from('note_assignees').select('note_id, contact_id'),
    ]);

    if (contactsResult.error) {
      console.error('[useAssigneesSupabase] Fetch contacts error:', contactsResult.error);
      return;
    }

    const contactsList: Contact[] = (contactsResult.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      lastname: row.lastname || '',
      phone: row.phone || '',
      email: row.email || '',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      remote_id: row.id,
      sync_status: 'synced' as const,
      last_synced_at: row.updated_at || null,
    }));

    // Build note-assignees map
    const newNoteAssigneesMap: Record<string, string[]> = {};
    if (noteAssigneesResult.data) {
      for (const row of noteAssigneesResult.data) {
        if (!newNoteAssigneesMap[row.note_id]) {
          newNoteAssigneesMap[row.note_id] = [];
        }
        newNoteAssigneesMap[row.note_id].push(row.contact_id);
      }
    }

    setContacts(contactsList);
    setNoteAssigneesMap(newNoteAssigneesMap);
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchAssignees();
  }, [fetchAssignees]);

  // Realtime subscription for note_assignees changes
  useEffect(() => {
    if (!user || !supabase) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`note-assignees-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_assignees',
        },
        () => fetchAssignees()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, fetchAssignees]);

  /**
   * Get assignees for a specific note (uses cached note_assignees map)
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
      if (!supabase || !user) throw new Error('Supabase not configured');

      // Check if already exists locally
      const existingIds = noteAssigneesMap[noteId] || [];
      if (existingIds.includes(contactId)) return;

      const { error } = await supabase.from('note_assignees').insert({
        note_id: noteId,
        contact_id: contactId,
        user_id: user.id,
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
    [t, noteAssigneesMap, user]
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
    if (!supabase || !user) throw new Error('Supabase not configured');

    // Remove all existing
    await supabase.from('note_assignees').delete().eq('note_id', noteId);

    // Add new ones
    if (contactIds.length > 0) {
      const inserts = contactIds.map((contactId) => ({
        note_id: noteId,
        contact_id: contactId,
        user_id: user.id,
      }));
      await supabase.from('note_assignees').insert(inserts);
    }

    // Update local cache
    setNoteAssigneesMap((prev) => ({
      ...prev,
      [noteId]: contactIds,
    }));

    setNoteAssigneeVersion((v) => v + 1);
  }, [user]);

  return {
    noteAssigneeVersion,
    getAssigneesForNote,
    addAssigneeToNote,
    removeAssigneeFromNote,
    setAssigneesForNote,
  };
}
