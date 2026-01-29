import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Note, NoteCategory } from '@/types/note';

export function useDeletedNotes() {
  const { user } = useAuth();
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  const loadDeletedNotes = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
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
  }, [user]);

  useEffect(() => {
    loadDeletedNotes();
  }, [loadDeletedNotes]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !supabase) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`deleted-notes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`,
        },
        () => loadDeletedNotes()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, loadDeletedNotes]);

  return {
    deletedNotes,
    loading,
    refresh: loadDeletedNotes,
  };
}
