import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { NoteHistory, NoteCategory, ChangelogActionType } from '@/types/note';

export function useNoteHistory(noteId: string | null) {
  const { user } = useAuth();

  const [history, setHistory] = useState<NoteHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadHistory = useCallback(async () => {
    if (!supabase || !user || !noteId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      // Fetch from note_versions (content snapshots for created/edit actions)
      const { data: versionsData, error: versionsError } = await (supabase as any)
        .from('note_versions')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: false });

      if (versionsError) {
        console.error('[useNoteHistory] Error loading versions:', versionsError);
      }

      // Fetch from note_actions (postponed actions)
      const { data: actionsData, error: actionsError } = await (supabase as any)
        .from('note_actions')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: false });

      if (actionsError) {
        console.error('[useNoteHistory] Error loading actions:', actionsError);
      }

      // Transform note_versions to NoteHistory format
      const versionsHistory: NoteHistory[] = (versionsData || []).map((row: any) => ({
        id: row.id,
        note_id: row.note_id,
        content: row.content,
        description: row.description || null,
        category: row.category as NoteCategory,
        completed: Boolean(row.completed),
        changed_at: row.created_at,
        action_type: (row.version_number === 1 ? 'created' : 'edit') as ChangelogActionType,
        reason: null,
        previous_date: null,
      }));

      // Transform note_actions to NoteHistory format
      const actionsHistory: NoteHistory[] = (actionsData || []).map((row: any) => ({
        id: row.id,
        note_id: row.note_id,
        content: '', // Actions don't store content
        description: null,
        category: 'todo' as NoteCategory, // Default, not stored in actions
        completed: false,
        changed_at: row.created_at,
        action_type: 'postponed' as ChangelogActionType,
        reason: row.reason || null,
        previous_date: row.previous_date || null,
      }));

      // Combine and sort by changed_at descending
      const combined = [...versionsHistory, ...actionsHistory].sort(
        (a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()
      );

      setHistory(combined);
    } catch (err) {
      console.error('[useNoteHistory] Unexpected error:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [user, noteId]);

  const deleteHistoryEntry = useCallback(async (historyId: string) => {
    if (!supabase || !user) return;

    // Try deleting from note_versions first
    const { error: versionsError } = await (supabase as any)
      .from('note_versions')
      .delete()
      .eq('id', historyId);

    if (versionsError) {
      // Try note_actions if not found in note_versions
      const { error: actionsError } = await (supabase as any)
        .from('note_actions')
        .delete()
        .eq('id', historyId);

      if (actionsError) {
        console.error('[useNoteHistory] Error deleting history entry:', actionsError);
        return;
      }
    }

    loadHistory();
  }, [user, loadHistory]);

  const updateHistoryReason = useCallback(async (historyId: string, newReason: string) => {
    if (!supabase || !user) return;

    // Reason is only stored in note_actions (for postponed entries)
    const { error } = await (supabase as any)
      .from('note_actions')
      .update({ reason: newReason })
      .eq('id', historyId);

    if (error) {
      console.error('[useNoteHistory] Error updating history reason:', error);
      return;
    }

    loadHistory();
  }, [user, loadHistory]);

  // Debounce history loading
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!noteId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      loadHistory();
    }, 50);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [noteId, loadHistory]);

  // Realtime subscription for note_versions and note_actions changes
  useEffect(() => {
    if (!supabase || !user || !noteId) return;

    const channel = supabase
      .channel(`note-history-${noteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_versions',
          filter: `note_id=eq.${noteId}`,
        },
        () => {
          loadHistory();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_actions',
          filter: `note_id=eq.${noteId}`,
        },
        () => {
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, noteId, loadHistory]);

  return {
    history,
    loading,
    reload: loadHistory,
    deleteHistoryEntry,
    updateHistoryReason,
  };
}
