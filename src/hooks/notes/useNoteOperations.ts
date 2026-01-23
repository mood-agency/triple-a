import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useSync } from '@/contexts/SyncContext';
import { persistDatabase } from '@/db';
import type { Note, NoteCategory } from '@/types/note';
import { generateId, saveNoteHistory } from './noteUtils';

/**
 * Hook for CRUD operations on notes (Create, Update, Delete, Restore)
 */
export function useNoteOperations(effectiveDate: string, loadNotes: () => void) {
  const { db } = useDatabase();
  const { queueOperation } = useSync();
  const { t } = useTranslation();

  /**
   * Create a new note with optional labels
   */
  const createNote = useCallback(
    async (content: string, category: NoteCategory = 'todo', description: string | null = null, labelIds: string[] = []): Promise<Note> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Get the minimum sort_order and subtract 1 for the new note (so it appears at the top)
      const minResult = db.exec('SELECT MIN(sort_order) FROM notes WHERE date = ?', [effectiveDate]);
      const minSortOrder = minResult.length > 0 && minResult[0].values[0][0] !== null
        ? (minResult[0].values[0][0] as number) - 1
        : 0;

      const note: Note = {
        id: generateId(),
        date: effectiveDate,
        content,
        description,
        category,
        completed: false,
        completed_at: null,
        deadline: null,
        pinned: false,
        sort_order: minSortOrder,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        assignee_id: null,
      };

      db.run(
        'INSERT INTO notes (id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [note.id, note.date, note.content, note.description, note.category, 0, null, null, 0, note.sort_order, note.created_at, note.updated_at]
      );

      // Add labels to the note if provided
      for (const labelId of labelIds) {
        db.run(
          'INSERT OR IGNORE INTO note_labels (note_id, label_id, created_at) VALUES (?, ?, ?)',
          [note.id, labelId, now]
        );
      }

      await persistDatabase();
      await queueOperation('notes', 'insert', note.id, {
        date: note.date,
        content: note.content,
        description: note.description,
        category: note.category,
        completed: note.completed,
        completed_at: note.completed_at,
        deadline: note.deadline,
        pinned: note.pinned,
        sort_order: note.sort_order,
        created_at: note.created_at,
        updated_at: note.updated_at,
      });

      // Queue label operations
      for (const labelId of labelIds) {
        await queueOperation('note_labels', 'insert', `${note.id}-${labelId}`, {
          note_id: note.id,
          label_id: labelId,
          created_at: now,
        });
      }

      loadNotes();
      toast.success(t('toast.noteCreated'));
      return note;
    },
    [db, effectiveDate, loadNotes, queueOperation, t]
  );

  /**
   * Create a new note after another note (for keyboard navigation)
   */
  const createNoteAfter = useCallback(
    async (afterNoteId: string, category: NoteCategory = 'todo', deadline?: string | null, labelIds: string[] = []): Promise<Note> => {
      if (!db) throw new Error('Database not ready');

      // Get the sort_order of the note we're inserting after
      const afterNoteResult = db.exec('SELECT sort_order FROM notes WHERE id = ?', [afterNoteId]);
      if (afterNoteResult.length === 0) {
        throw new Error('Note not found');
      }
      const afterSortOrder = (afterNoteResult[0].values[0][0] as number) || 0;

      // Find the next note (the one with the next higher sort_order)
      const nextNoteResult = db.exec(
        'SELECT sort_order FROM notes WHERE date = ? AND sort_order > ? ORDER BY sort_order ASC LIMIT 1',
        [effectiveDate, afterSortOrder]
      );

      let newSortOrder: number;
      if (nextNoteResult.length > 0) {
        // Insert between afterNote and nextNote
        const nextSortOrder = (nextNoteResult[0].values[0][0] as number) || 0;
        newSortOrder = (afterSortOrder + nextSortOrder) / 2;
      } else {
        // No next note, insert after
        newSortOrder = afterSortOrder + 1;
      }

      const now = new Date().toISOString();
      const note: Note = {
        id: generateId(),
        date: effectiveDate,
        content: '',
        description: null,
        category,
        completed: false,
        completed_at: null,
        deadline: deadline ?? null,
        pinned: false,
        sort_order: newSortOrder,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        assignee_id: null,
      };

      db.run(
        'INSERT INTO notes (id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at, assignee_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [note.id, note.date, note.content, note.description, note.category, 0, null, note.deadline, 0, note.sort_order, note.created_at, note.updated_at, null]
      );

      // Add labels to the note if provided
      for (const labelId of labelIds) {
        db.run(
          'INSERT OR IGNORE INTO note_labels (note_id, label_id, created_at) VALUES (?, ?, ?)',
          [note.id, labelId, now]
        );
      }

      await persistDatabase();
      await queueOperation('notes', 'insert', note.id, {
        date: note.date,
        content: note.content,
        description: note.description,
        category: note.category,
        completed: note.completed,
        completed_at: note.completed_at,
        deadline: note.deadline,
        pinned: note.pinned,
        sort_order: note.sort_order,
        created_at: note.created_at,
        updated_at: note.updated_at,
      });

      // Queue label operations
      for (const labelId of labelIds) {
        await queueOperation('note_labels', 'insert', `${note.id}-${labelId}`, {
          note_id: note.id,
          label_id: labelId,
          created_at: now,
        });
      }

      loadNotes();
      return note;
    },
    [db, effectiveDate, loadNotes, queueOperation]
  );

  /**
   * Update note content and/or category
   */
  const updateNote = useCallback(
    async (
      id: string,
      content: string,
      category?: NoteCategory,
      description?: string | null,
      setNotes?: React.Dispatch<React.SetStateAction<Note[]>>
    ): Promise<Note> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Get current note state for history
      const currentResult = db.exec('SELECT content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, assignee_id FROM notes WHERE id = ?', [id]);
      const currentNote = currentResult.length > 0 ? currentResult[0].values[0] : null;

      const finalCategory = category || (currentNote ? currentNote[2] as NoteCategory : 'todo');
      const finalDescription = description !== undefined ? description : (currentNote ? currentNote[1] as string | null : null);
      const completed = currentNote ? Boolean(currentNote[3]) : false;
      const completedAt = currentNote ? currentNote[4] as string | null : null;
      const deadline = currentNote ? currentNote[5] as string | null : null;
      const pinned = currentNote ? Boolean(currentNote[6]) : false;
      const sortOrder = currentNote ? (currentNote[7] as number) || 0 : 0;
      const createdAt = currentNote ? currentNote[8] as string : now;
      const assigneeId = currentNote ? currentNote[9] as string | null : null;

      db.run('UPDATE notes SET content = ?, description = ?, category = ?, updated_at = ? WHERE id = ?', [
        content,
        finalDescription,
        finalCategory,
        now,
        id,
      ]);

      // Save to history
      saveNoteHistory(db, id, content, finalDescription, finalCategory, completed);

      await persistDatabase();
      await queueOperation('notes', 'update', id, {
        content,
        description: finalDescription,
        category: finalCategory,
        completed,
        completed_at: completedAt,
        deadline,
        pinned,
        sort_order: sortOrder,
        updated_at: now,
      });

      const updatedNote: Note = {
        id,
        date: effectiveDate,
        content,
        description: finalDescription,
        category: finalCategory,
        completed,
        completed_at: completedAt,
        deadline,
        pinned,
        sort_order: sortOrder,
        created_at: createdAt,
        updated_at: now,
        deleted_at: null,
        assignee_id: assigneeId,
      };

      // Optimized: Update only the modified note instead of reloading all notes
      if (setNotes) {
        setNotes(prevNotes => prevNotes.map(note => note.id === id ? updatedNote : note));
      }

      toast.success(t('toast.noteUpdated'));
      return updatedNote;
    },
    [db, effectiveDate, queueOperation, t]
  );

  /**
   * Soft delete a note (sets deleted_at timestamp)
   */
  const deleteNote = useCallback(
    async (id: string, setNotes?: React.Dispatch<React.SetStateAction<Note[]>>): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Soft delete: set deleted_at instead of removing the record
      db.run('UPDATE notes SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);

      await persistDatabase();
      await queueOperation('notes', 'update', id, {
        deleted_at: now,
        updated_at: now,
      });

      // Optimized: Remove the deleted note from the list (soft delete)
      if (setNotes) {
        setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
      }
    },
    [db, queueOperation]
  );

  /**
   * Restore a soft-deleted note (clears deleted_at timestamp)
   */
  const restoreNote = useCallback(
    async (note: Note): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Clear deleted_at to restore the soft-deleted note
      db.run('UPDATE notes SET deleted_at = NULL, updated_at = ? WHERE id = ?', [now, note.id]);

      await persistDatabase();
      await queueOperation('notes', 'update', note.id, {
        deleted_at: null,
        updated_at: now,
      });
      loadNotes();
      toast.success(t('toast.noteRestored'));
    },
    [db, loadNotes, queueOperation, t]
  );

  return {
    createNote,
    createNoteAfter,
    updateNote,
    deleteNote,
    restoreNote,
  };
}
