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
      // Use 'as any' since note_history table may not be in generated types
      const { data, error } = await (supabase as any)
        .from('note_history')
        .select('*')
        .eq('note_id', noteId)
        .order('changed_at', { ascending: false });

      if (error) {
        console.error('[useNoteHistory] Error loading history:', error);
        setHistory([]);
        return;
      }

      const rows: NoteHistory[] = (data || []).map((row: any) => ({
        id: row.id,
        note_id: row.note_id,
        content: row.content,
        description: row.description || null,
        category: row.category as NoteCategory,
        completed: Boolean(row.completed),
        changed_at: row.changed_at,
        action_type: (row.action_type as ChangelogActionType) || 'edit',
        reason: row.reason || null,
        previous_date: row.previous_date || null,
      }));

      setHistory(rows);
    } catch (err) {
      console.error('[useNoteHistory] Unexpected error:', err);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [user, noteId]);

  const deleteHistoryEntry = useCallback(async (historyId: string) => {
    if (!supabase || !user) return;

    const { error } = await (supabase as any)
      .from('note_history')
      .delete()
      .eq('id', historyId);

    if (error) {
      console.error('[useNoteHistory] Error deleting history entry:', error);
      return;
    }

    loadHistory();
  }, [user, loadHistory]);

  const updateHistoryReason = useCallback(async (historyId: string, newReason: string) => {
    if (!supabase || !user) return;

    const { error } = await (supabase as any)
      .from('note_history')
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

  // Realtime subscription for note_history changes
  useEffect(() => {
    if (!supabase || !user || !noteId) return;

    const channel = supabase
      .channel(`note-history-${noteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_history',
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
