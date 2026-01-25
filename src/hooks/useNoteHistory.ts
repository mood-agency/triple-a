import { useState, useCallback, useEffect, useRef } from 'react';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import type { NoteHistory, NoteCategory, ChangelogActionType } from '@/types/note';

export function useNoteHistory(noteId: string | null) {
  const { store, isReady: storeReady } = useTinyBase();

  const [history, setHistory] = useState<NoteHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadHistory = useCallback(() => {
    if (!store || !storeReady || !noteId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const historyTable = store.getTable('note_history') || {};

    const rows: NoteHistory[] = Object.entries(historyTable)
      .filter(([, h]) => (h as Record<string, unknown>).note_id === noteId)
      .map(([id, h]) => {
        const row = h as Record<string, unknown>;
        return {
          id,
          note_id: row.note_id as string,
          content: row.content as string,
          description: (row.description as string) || null,
          category: row.category as NoteCategory,
          completed: Boolean(row.completed),
          changed_at: row.changed_at as string,
          action_type: (row.action_type as ChangelogActionType) || 'edit',
          reason: (row.reason as string) || null,
          previous_date: (row.previous_date as string) || null,
        };
      })
      .sort((a, b) => b.changed_at.localeCompare(a.changed_at));

    setHistory(rows);
    setLoading(false);
  }, [store, storeReady, noteId]);

  const deleteHistoryEntry = useCallback(async (historyId: string) => {
    if (!store || !storeReady) return;
    store.delRow('note_history', historyId);
    loadHistory();
  }, [store, storeReady, loadHistory]);

  const updateHistoryReason = useCallback(async (historyId: string, newReason: string) => {
    if (!store || !storeReady) return;
    store.setPartialRow('note_history', historyId, { reason: newReason });
    loadHistory();
  }, [store, storeReady, loadHistory]);

  // PERFORMANCE: Debounce history loading to avoid blocking click interactions
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

  // Listen for TinyBase store changes to note_history table
  useEffect(() => {
    if (!store || !noteId) return;

    const listenerId = store.addTableListener('note_history', () => {
      loadHistory();
    });

    return () => {
      store.delListener(listenerId);
    };
  }, [store, noteId, loadHistory]);

  return {
    history,
    loading,
    reload: loadHistory,
    deleteHistoryEntry,
    updateHistoryReason,
  };
}
