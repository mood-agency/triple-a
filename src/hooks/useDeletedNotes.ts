import { useState, useCallback, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Note, NoteCategory } from '@/types/note';

export function useDeletedNotes() {
  const { db, isReady } = useDatabase();
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDeletedNotes = useCallback(() => {
    if (!db || !isReady) return;

    // Load only soft-deleted notes (deleted_at IS NOT NULL)
    const query = `SELECT id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at, deleted_at
       FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`;

    const result = db.exec(query);

    if (result.length > 0) {
      const rows = result[0].values.map((row) => ({
        id: row[0] as string,
        date: row[1] as string,
        content: row[2] as string,
        description: row[3] as string | null,
        category: (row[4] as NoteCategory) || 'todo',
        completed: Boolean(row[5]),
        completed_at: row[6] as string | null,
        deadline: row[7] as string | null,
        pinned: Boolean(row[8]),
        sort_order: (row[9] as number) || 0,
        created_at: row[10] as string,
        updated_at: row[11] as string,
        deleted_at: row[12] as string | null,
      }));
      setDeletedNotes(rows);
    } else {
      setDeletedNotes([]);
    }
    setLoading(false);
  }, [db, isReady]);

  useEffect(() => {
    loadDeletedNotes();
  }, [loadDeletedNotes]);

  return {
    deletedNotes,
    loading,
    refresh: loadDeletedNotes,
  };
}
