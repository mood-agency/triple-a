import { useState, useCallback, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import { getFlag } from '@/config/featureFlags';
import type { Note, NoteCategory } from '@/types/note';

export function useDeletedNotes() {
  const { db, isReady } = useDatabase();
  const { store, isReady: tinyBaseReady } = useTinyBase();
  const useTinyBaseFlag = getFlag('useTinyBase');
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDeletedNotes = useCallback(() => {
    if (useTinyBaseFlag) {
      // TinyBase implementation
      if (!store || !tinyBaseReady) return;

      const notesTable = store.getTable('notes') || {};

      // Debug: log all notes with their deleted_at values
      console.log('[useDeletedNotes] All notes in TinyBase:',
        Object.entries(notesTable).map(([id, row]) => ({
          id,
          content: (row as Record<string, unknown>).content,
          deleted_at: (row as Record<string, unknown>).deleted_at,
        }))
      );

      const rows: Note[] = Object.entries(notesTable)
        .filter(([_, noteRow]) => {
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
    } else {
      // Legacy SQL.js implementation
      if (!db || !isReady) return;

      const query = `SELECT id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at, deleted_at, assignee_id
         FROM notes WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC`;

      const result = db.exec(query);

      if (result.length > 0) {
        const rows: Note[] = result[0].values.map((row) => ({
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
          assignee_id: row[13] as string | null,
        }));
        setDeletedNotes(rows);
      } else {
        setDeletedNotes([]);
      }
      setLoading(false);
    }
  }, [useTinyBaseFlag, store, tinyBaseReady, db, isReady]);

  useEffect(() => {
    loadDeletedNotes();
  }, [loadDeletedNotes]);

  // Listen to TinyBase store changes
  useEffect(() => {
    if (!useTinyBaseFlag || !store) return;

    const listenerId = store.addTableListener('notes', () => {
      loadDeletedNotes();
    });

    return () => {
      store.delListener(listenerId);
    };
  }, [useTinyBaseFlag, store, loadDeletedNotes]);

  return {
    deletedNotes,
    loading,
    refresh: loadDeletedNotes,
  };
}
