import { useState, useCallback, useEffect } from 'react';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import type { Note, NoteCategory } from '@/types/note';

export function useDeletedNotes() {
  const { store, isReady: tinyBaseReady } = useTinyBase();
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDeletedNotes = useCallback(() => {
    if (!store || !tinyBaseReady) return;

    const notesTable = store.getTable('notes') || {};

    const rows: Note[] = Object.entries(notesTable)
      .filter(([, noteRow]) => {
        const row = noteRow as Record<string, unknown>;
        // Only include soft-deleted notes
        return row.deleted_at != null && row.deleted_at !== '';
      })
      .map(([id, noteRow]) => {
        const row = noteRow as Record<string, unknown>;
        return {
          id,
          date: row.date as string,
          content: row.content as string,
          description: (row.description as string) || null,
          category: (row.category as NoteCategory) || 'todo',
          completed: Boolean(row.completed),
          completed_at: (row.completed_at as string) || null,
          deadline: (row.deadline as string) || null,
          pinned: Boolean(row.pinned),
          sort_order: (row.sort_order as number) || 0,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          deleted_at: (row.deleted_at as string) || null,
          assignee_id: (row.assignee_id as string) || null,
        };
      })
      // Sort by deleted_at descending (most recently deleted first)
      .sort((a, b) => {
        const aDeleted = a.deleted_at || '';
        const bDeleted = b.deleted_at || '';
        return bDeleted.localeCompare(aDeleted);
      });

    setDeletedNotes(rows);
    setLoading(false);
  }, [store, tinyBaseReady]);

  useEffect(() => {
    loadDeletedNotes();
  }, [loadDeletedNotes]);

  // Listen to TinyBase store changes
  useEffect(() => {
    if (!store) return;

    const listenerId = store.addTableListener('notes', () => {
      loadDeletedNotes();
    });

    return () => {
      store.delListener(listenerId);
    };
  }, [store, loadDeletedNotes]);

  return {
    deletedNotes,
    loading,
    refresh: loadDeletedNotes,
  };
}
