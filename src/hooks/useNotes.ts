import { useState, useCallback, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useSync } from '@/contexts/SyncContext';
import { persistDatabase } from '@/db';
import type { Note, NoteCategory, ChangelogActionType } from '@/types/note';
import type { Database } from 'sql.js';

function generateId(): string {
  return crypto.randomUUID();
}

function saveNoteHistory(
  db: Database,
  noteId: string,
  content: string,
  description: string | null,
  category: NoteCategory,
  completed: boolean,
  actionType: ChangelogActionType = 'edit',
  reason: string | null = null,
  previousDate: string | null = null
): void {
  const historyId = generateId();
  const changedAt = new Date().toISOString();
  db.run(
    'INSERT INTO note_history (id, note_id, content, description, category, completed, changed_at, action_type, reason, previous_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [historyId, noteId, content, description, category, completed ? 1 : 0, changedAt, actionType, reason, previousDate]
  );
}

export function useNotes(date?: string) {
  const { db, isReady } = useDatabase();
  const { queueOperation } = useSync();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Default date for creating new notes (today)
  const defaultDate = new Date().toISOString().split('T')[0];
  const effectiveDate = date || defaultDate;

  const loadNotes = useCallback(() => {
    if (!db || !isReady) return;

    // If no date provided, load all notes; otherwise filter by date
    // Include last postpone reason from note_history
    // Filter out soft-deleted notes (deleted_at IS NULL)
    const query = date
      ? `SELECT n.id, n.date, n.content, n.description, n.category, n.completed, n.completed_at, n.deadline, n.pinned, n.sort_order, n.created_at, n.updated_at, n.deleted_at,
          (SELECT h.reason FROM note_history h WHERE h.note_id = n.id AND h.action_type = 'postponed' ORDER BY h.changed_at DESC LIMIT 1) as last_postpone_reason
         FROM notes n WHERE n.date = ? AND n.deleted_at IS NULL ORDER BY n.pinned DESC, n.sort_order ASC`
      : `SELECT n.id, n.date, n.content, n.description, n.category, n.completed, n.completed_at, n.deadline, n.pinned, n.sort_order, n.created_at, n.updated_at, n.deleted_at,
          (SELECT h.reason FROM note_history h WHERE h.note_id = n.id AND h.action_type = 'postponed' ORDER BY h.changed_at DESC LIMIT 1) as last_postpone_reason
         FROM notes n WHERE n.deleted_at IS NULL ORDER BY n.date DESC, n.pinned DESC, n.sort_order ASC`;

    const params = date ? [date] : [];
    const result = db.exec(query, params);

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
        last_postpone_reason: row[13] as string | null,
      }));
      setNotes(rows);
    } else {
      setNotes([]);
    }
    setLoading(false);
  }, [db, isReady, date]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const createNote = useCallback(
    async (content: string, category: NoteCategory = 'todo', description: string | null = null): Promise<Note> => {
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
      };

      db.run(
        'INSERT INTO notes (id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [note.id, note.date, note.content, note.description, note.category, 0, null, null, 0, note.sort_order, note.created_at, note.updated_at]
      );

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
      loadNotes();
      return note;
    },
    [db, effectiveDate, loadNotes, queueOperation]
  );

  const updateNote = useCallback(
    async (id: string, content: string, category?: NoteCategory, description?: string | null): Promise<Note> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Get current note state for history
      const currentResult = db.exec('SELECT content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at FROM notes WHERE id = ?', [id]);
      const currentNote = currentResult.length > 0 ? currentResult[0].values[0] : null;

      const finalCategory = category || (currentNote ? currentNote[2] as NoteCategory : 'todo');
      const finalDescription = description !== undefined ? description : (currentNote ? currentNote[1] as string | null : null);
      const completed = currentNote ? Boolean(currentNote[3]) : false;
      const completedAt = currentNote ? currentNote[4] as string | null : null;
      const deadline = currentNote ? currentNote[5] as string | null : null;
      const pinned = currentNote ? Boolean(currentNote[6]) : false;
      const sortOrder = currentNote ? (currentNote[7] as number) || 0 : 0;
      const createdAt = currentNote ? currentNote[8] as string : now;

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

      // Optimized: Update only the modified note instead of reloading all notes
      const updatedNote = {
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
        deleted_at: null
      };
      setNotes(prevNotes => prevNotes.map(note => note.id === id ? updatedNote : note));

      return updatedNote;
    },
    [db, effectiveDate, queueOperation]
  );

  const updateDeadline = useCallback(
    async (id: string, deadline: string | null): Promise<void> => {
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
      setNotes(prevNotes => prevNotes.map(note =>
        note.id === id ? { ...note, deadline, updated_at: now } : note
      ));
    },
    [db, queueOperation]
  );

  const toggleCompleted = useCallback(
    async (id: string, completed: boolean): Promise<void> => {
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
      setNotes(prevNotes => prevNotes.map(note =>
        note.id === id ? { ...note, completed, completed_at: completedAt, updated_at: now } : note
      ));
    },
    [db, queueOperation]
  );

  const togglePinned = useCallback(
    async (id: string, pinned: boolean): Promise<void> => {
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
      setNotes(prevNotes => prevNotes.map(note =>
        note.id === id ? { ...note, pinned, updated_at: now } : note
      ));
    },
    [db, queueOperation]
  );

  const deleteNote = useCallback(
    async (id: string): Promise<void> => {
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
      setNotes(prevNotes => prevNotes.filter(note => note.id !== id));
    },
    [db, queueOperation]
  );

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
    },
    [db, loadNotes, queueOperation]
  );

  const createNoteAfter = useCallback(
    async (afterNoteId: string, category: NoteCategory = 'todo'): Promise<Note> => {
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
        deadline: null,
        pinned: false,
        sort_order: newSortOrder,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };

      db.run(
        'INSERT INTO notes (id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [note.id, note.date, note.content, note.description, note.category, 0, null, null, 0, note.sort_order, note.created_at, note.updated_at]
      );

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
      loadNotes();
      return note;
    },
    [db, effectiveDate, loadNotes, queueOperation]
  );

  const reorderNotes = useCallback(
    async (orderedIds: string[]): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Update sort_order for each note based on its position in the array
      for (const [index, id] of orderedIds.entries()) {
        db.run('UPDATE notes SET sort_order = ?, updated_at = ? WHERE id = ?', [index, now, id]);
        await queueOperation('notes', 'update', id, {
          sort_order: index,
          updated_at: now,
        });
      }

      await persistDatabase();
      loadNotes();
    },
    [db, loadNotes, queueOperation]
  );

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
    },
    [db, loadNotes, queueOperation]
  );

  return {
    notes,
    loading,
    createNote,
    createNoteAfter,
    updateNote,
    updateDeadline,
    toggleCompleted,
    togglePinned,
    deleteNote,
    restoreNote,
    reorderNotes,
    postponeNote,
  };
}
