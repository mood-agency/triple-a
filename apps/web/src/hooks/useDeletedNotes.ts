import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Note, NoteCategory } from '@/types/note';

interface UseDeletedNotesOptions {
  /** Only fetch when enabled (default: true). Set to false to defer fetching. */
  enabled?: boolean;
}

export function useDeletedNotes({ enabled = true }: UseDeletedNotesOptions = {}) {
  const { user } = useAuth();
  const userId = user?.id;
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  const hasFetchedRef = useRef(false);
  // Ref to always hold the latest loadDeletedNotes — avoids re-subscribing realtime on fetch changes
  const loadDeletedNotesRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const loadDeletedNotes = useCallback(async () => {
    if (!userId || !supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      console.error('[useDeletedNotes] Fetch error:', error);
      setLoading(false);
      return;
    }

    const notes: Note[] = (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      content: row.content,
      description: row.description || null,
      category: (row.category as NoteCategory) || 'todo',
      completed: Boolean(row.completed),
      completed_at: row.completed_at || null,
      deadline: row.deadline || null,
      is_all_day: Boolean(row.is_all_day) || false,
      pinned: Boolean(row.pinned),
      sort_order: row.sort_order || 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at || null,
      deleted_reason: row.deleted_reason || null,
      project_id: row.project_id || null,
      is_public: Boolean(row.is_public),
      public_slug: row.public_slug || null,
      remote_id: row.id,
      sync_status: 'synced' as const,
    }));

    setDeletedNotes(notes);
    setLoading(false);
    hasFetchedRef.current = true;
  }, [userId]);

  // Keep ref in sync so realtime handlers always call the latest version
  loadDeletedNotesRef.current = loadDeletedNotes;

  // Only fetch and subscribe when enabled
  useEffect(() => {
    if (!enabled) return;
    loadDeletedNotes();
  }, [enabled, loadDeletedNotes]);

  // Realtime subscription — only when enabled
  // Uses loadDeletedNotesRef so subscription doesn't need to be torn down on fetch fn change
  useEffect(() => {
    if (!enabled || !userId || !supabase) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`deleted-notes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        () => loadDeletedNotesRef.current()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId]);

  return {
    deletedNotes,
    loading,
    refresh: loadDeletedNotes,
  };
}
