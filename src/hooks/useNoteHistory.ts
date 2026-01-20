import { useState, useCallback, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { NoteHistory, NoteCategory } from '@/types/note';

export function useNoteHistory(noteId: string | null) {
  const { db, isReady } = useDatabase();
  const [history, setHistory] = useState<NoteHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(() => {
    if (!db || !isReady || !noteId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const result = db.exec(
      'SELECT id, note_id, content, description, category, completed, changed_at FROM note_history WHERE note_id = ? ORDER BY changed_at DESC',
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
      }));
      setHistory(rows);
    } else {
      setHistory([]);
    }
    setLoading(false);
  }, [db, isReady, noteId]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return {
    history,
    loading,
    reload: loadHistory,
  };
}
