import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useSync } from '@/contexts/SyncContext';
import { persistDatabase } from '@/db';
import type { Note, NoteCategory } from '@/types/note';
import { saveNoteHistory } from './noteUtils';

/**
 * Hook for managing note deadlines (set, clear, postpone)
 */
export function useNoteDeadline(loadNotes: () => void) {
  const { db } = useDatabase();
  const { queueOperation } = useSync();
  const { t } = useTranslation();

  /**
   * Update or clear a note's deadline
   */
  const updateDeadline = useCallback(
    async (id: string, deadline: string | null, setNotes?: React.Dispatch<React.SetStateAction<Note[]>>): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      db.run('UPDATE notes SET deadline = ?, updated_at = ? WHERE id = ?', [
        deadline,
        now,
        id,
      ]);

      await persistDatabase();
      await queueOperation('notes', 'update', id, {
        deadline,
        updated_at: now,
      });

      // Optimized: Update only the modified note's deadline
      if (setNotes) {
        setNotes(prevNotes => prevNotes.map(note =>
          note.id === id ? { ...note, deadline, updated_at: now } : note
        ));
      }

      toast.success(t('toast.deadlineUpdated'));
    },
    [db, queueOperation, t]
  );

  /**
   * Postpone a note with a reason (saves to history)
   */
  const postponeNote = useCallback(
    async (id: string, newDeadline: string, reason: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Get current note state
      const currentResult = db.exec(
        'SELECT content, description, category, completed, deadline FROM notes WHERE id = ?',
        [id]
      );
      if (currentResult.length === 0 || currentResult[0].values.length === 0) {
        throw new Error('Note not found');
      }

      const currentNote = currentResult[0].values[0];
      const content = currentNote[0] as string;
      const description = currentNote[1] as string | null;
      const category = currentNote[2] as NoteCategory;
      const completed = Boolean(currentNote[3]);
      const previousDeadline = currentNote[4] as string | null;

      // Update the note's deadline
      db.run('UPDATE notes SET deadline = ?, updated_at = ? WHERE id = ?', [newDeadline, now, id]);

      // Save to history with postponed action, including the new deadline and previous deadline
      saveNoteHistory(db, id, content, description, category, completed, 'postponed', reason, previousDeadline);

      await persistDatabase();
      await queueOperation('notes', 'update', id, {
        deadline: newDeadline,
        updated_at: now,
      });
      loadNotes();
      toast.success(t('toast.notePostponed'));
    },
    [db, loadNotes, queueOperation, t]
  );

  return {
    updateDeadline,
    postponeNote,
  };
}
