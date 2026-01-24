import { useState, useCallback, useEffect, useRef } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import { getFlag } from '@/config/featureFlags';
import { persistDatabase } from '@/db';
import type { NoteHistory, NoteCategory, ChangelogActionType } from '@/types/note';

export function useNoteHistory(noteId: string | null) {
  const { db, isReady: dbReady } = useDatabase();
  const { store, isReady: storeReady } = useTinyBase();
  const useTinyBaseFlag = getFlag('useTinyBase');

  const [history, setHistory] = useState<NoteHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadHistoryFromTinyBase = useCallback(() => {
    if (!store || !storeReady || !noteId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const historyTable = store.getTable('note_history') || {};
    console.log('[loadHistoryFromTinyBase] Full history table:', historyTable);
    console.log('[loadHistoryFromTinyBase] Looking for noteId:', noteId);

    const rows: NoteHistory[] = Object.entries(historyTable)
      .filter(([_, h]) => (h as Record<string, unknown>).note_id === noteId)
      .map(([id, h]) => {
        const row = h as Record<string, unknown>;
        console.log('[loadHistoryFromTinyBase] Processing row:', { id, row });
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

    console.log('[loadHistoryFromTinyBase] Final rows:', rows);
    setHistory(rows);
    setLoading(false);
  }, [store, storeReady, noteId]);

  const loadHistoryFromSqlJs = useCallback(() => {
    if (!db || !dbReady || !noteId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const result = db.exec(
      'SELECT id, note_id, content, description, category, completed, changed_at, action_type, reason, previous_date FROM note_history WHERE note_id = ? ORDER BY changed_at DESC',
      [noteId]
    );

    if (result.length > 0) {
      const rows = result[0].values.map((row) => ({
        id: row[0] as string,
        note_id: row[1] as string,
        content: row[2] as string,
        description: row[3] as string | null,
        category: row[4] as NoteCategory,
        completed: Boolean(row[5]),
        changed_at: row[6] as string,
        action_type: (row[7] as ChangelogActionType) || 'edit',
        reason: row[8] as string | null,
        previous_date: row[9] as string | null,
      }));
      setHistory(rows);
    } else {
      setHistory([]);
    }
    setLoading(false);
  }, [db, dbReady, noteId]);

  const loadHistory = useCallback(() => {
    if (useTinyBaseFlag) {
      loadHistoryFromTinyBase();
    } else {
      loadHistoryFromSqlJs();
    }
  }, [useTinyBaseFlag, loadHistoryFromTinyBase, loadHistoryFromSqlJs]);

  const deleteHistoryEntry = useCallback(async (historyId: string) => {
    if (useTinyBaseFlag) {
      if (!store || !storeReady) return;
      store.delRow('note_history', historyId);
      loadHistory();
    } else {
      if (!db || !dbReady) return;
      db.run('DELETE FROM note_history WHERE id = ?', [historyId]);
      await persistDatabase();
      loadHistory();
    }
  }, [useTinyBaseFlag, store, storeReady, db, dbReady, loadHistory]);

  const updateHistoryReason = useCallback(async (historyId: string, newReason: string) => {
    if (useTinyBaseFlag) {
      if (!store || !storeReady) return;
      store.setPartialRow('note_history', historyId, { reason: newReason });
      loadHistory();
    } else {
      if (!db || !dbReady) return;
      db.run('UPDATE note_history SET reason = ? WHERE id = ?', [newReason, historyId]);
      await persistDatabase();
      loadHistory();
    }
  }, [useTinyBaseFlag, store, storeReady, db, dbReady, loadHistory]);

  // PERFORMANCE: Debounce history loading to avoid blocking click interactions
  // This delays the SQL query until after the UI has updated
  useEffect(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Clear history immediately when noteId changes (for immediate UI feedback)
    if (!noteId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Delay the query to not block the click event
    timeoutRef.current = setTimeout(() => {
      loadHistory();
    }, 50); // 50ms delay - imperceptible to users but allows click to complete

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [noteId, loadHistory]);

  // Listen for TinyBase store changes to note_history table
  useEffect(() => {
    if (!useTinyBaseFlag || !store || !noteId) return;

    const listenerId = store.addTableListener('note_history', () => {
      loadHistoryFromTinyBase();
    });

    return () => {
      store.delListener(listenerId);
    };
  }, [useTinyBaseFlag, store, noteId, loadHistoryFromTinyBase]);

  return {
    history,
    loading,
    reload: loadHistory,
    deleteHistoryEntry,
    updateHistoryReason,
  };
}
