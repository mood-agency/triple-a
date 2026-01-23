import { useState, useCallback, useEffect, useRef } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { persistDatabase } from '@/db';
import type { NoteHistory, NoteCategory, ChangelogActionType } from '@/types/note';

export function useNoteHistory(noteId: string | null) {
  const { db, isReady } = useDatabase();
  const [history, setHistory] = useState<NoteHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadHistory = useCallback(() => {
    if (!db || !isReady || !noteId) {
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
  }, [db, isReady, noteId]);

  const deleteHistoryEntry = useCallback(async (historyId: string) => {
    if (!db || !isReady) return;

    db.run('DELETE FROM note_history WHERE id = ?', [historyId]);
    await persistDatabase();
    loadHistory();
  }, [db, isReady, loadHistory]);

  const updateHistoryReason = useCallback(async (historyId: string, newReason: string) => {
    if (!db || !isReady) return;

    db.run('UPDATE note_history SET reason = ? WHERE id = ?', [newReason, historyId]);
    await persistDatabase();
    loadHistory();
  }, [db, isReady, loadHistory]);

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
    // Delay the SQL query to not block the click event
    timeoutRef.current = setTimeout(() => {
      loadHistory();
    }, 50); // 50ms delay - imperceptible to users but allows click to complete

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [noteId]); // Note: intentionally not including loadHistory to avoid re-running on every noteId change

  return {
    history,
    loading,
    reload: loadHistory,
    deleteHistoryEntry,
    updateHistoryReason,
  };
}
