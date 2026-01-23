import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useSync } from '@/contexts/SyncContext';
import { persistDatabase } from '@/db';
import type { Note, NoteCategory } from '@/types/note';
import { saveNoteHistory } from './noteUtils';

/**
 * Hook for managing note state (completed, pinned)
 */
export function useNoteState() {
  const { db } = useDatabase();
  const { queueOperation } = useSync();
  const { t } = useTranslation();

  /**
   * Toggle the completed status of a note
   */
  const toggleCompleted = useCallback(
    async (id: string, completed: boolean, setNotes?: React.Dispatch<React.SetStateAction<Note[]>>): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();
      const completedAt = completed ? now : null;

      // Get current note state for history
      const currentResult = db.exec('SELECT content, description, category FROM notes WHERE id = ?', [id]);
      const currentNote = currentResult.length > 0 ? currentResult[0].values[0] : null;

      db.run('UPDATE notes SET completed = ?, completed_at = ?, updated_at = ? WHERE id = ?', [
        completed ? 1 : 0,
        completedAt,
        now,
        id,
      ]);

      // Save to history
      if (currentNote) {
        const content = currentNote[0] as string;
        const description = currentNote[1] as string | null;
        const category = currentNote[2] as NoteCategory;
        saveNoteHistory(db, id, content, description, category, completed, completed ? 'completed' : 'uncompleted');
      }

      await persistDatabase();
      await queueOperation('notes', 'update', id, {
        completed,
        completed_at: completedAt,
        updated_at: now,
      });

      // Optimized: Update only the completed status of this note
      if (setNotes) {
        setNotes(prevNotes => prevNotes.map(note =>
          note.id === id ? { ...note, completed, completed_at: completedAt, updated_at: now } : note
        ));
      }
    },
    [db, queueOperation]
  );

  /**
   * Toggle the pinned status of a note
   */
  const togglePinned = useCallback(
    async (id: string, pinned: boolean, setNotes?: React.Dispatch<React.SetStateAction<Note[]>>): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      db.run('UPDATE notes SET pinned = ?, updated_at = ? WHERE id = ?', [
        pinned ? 1 : 0,
        now,
        id,
      ]);

      await persistDatabase();
      await queueOperation('notes', 'update', id, {
        pinned,
        updated_at: now,
      });

      // Optimized: Update only the pinned status of this note
      if (setNotes) {
        setNotes(prevNotes => prevNotes.map(note =>
          note.id === id ? { ...note, pinned, updated_at: now } : note
        ));
      }

      toast.success(pinned ? t('toast.notePinned') : t('toast.noteUnpinned'));
    },
    [db, queueOperation, t]
  );

  /**
   * Update the assignee of a note
   */
  const updateAssignee = useCallback(
    async (id: string, assigneeId: string | null, setNotes?: React.Dispatch<React.SetStateAction<Note[]>>): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      db.run('UPDATE notes SET assignee_id = ?, updated_at = ? WHERE id = ?', [
        assigneeId,
        now,
        id,
      ]);

      await persistDatabase();
      await queueOperation('notes', 'update', id, {
        assignee_id: assigneeId,
        updated_at: now,
      });

      // Optimized: Update only the assignee of this note
      if (setNotes) {
        setNotes(prevNotes => prevNotes.map(note =>
          note.id === id ? { ...note, assignee_id: assigneeId, updated_at: now } : note
        ));
      }

      toast.success(t('toast.assigneeUpdated'));
    },
    [db, queueOperation, t]
  );

  return {
    toggleCompleted,
    togglePinned,
    updateAssignee,
  };
}
