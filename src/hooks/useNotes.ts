import { useState, useCallback, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { persistDatabase } from '@/db';
import type { Note, NoteCategory } from '@/types/note';
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
  completed: boolean
): void {
  const historyId = generateId();
  const changedAt = new Date().toISOString();
  db.run(
    'INSERT INTO note_history (id, note_id, content, description, category, completed, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [historyId, noteId, content, description, category, completed ? 1 : 0, changedAt]
  );
}

export function useNotes(date: string) {
  const { db, isReady } = useDatabase();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(() => {
    if (!db || !isReady) return;

    const result = db.exec(
      'SELECT id, date, content, description, category, completed, completed_at, pinned, sort_order, created_at, updated_at FROM notes WHERE date = ? ORDER BY pinned DESC, sort_order ASC',
      [date]
    );

    if (result.length > 0) {
      const rows = result[0].values.map((row) => ({
        id: row[0] as string,
        date: row[1] as string,
        content: row[2] as string,
        description: row[3] as string | null,
        category: (row[4] as NoteCategory) || 'todo',
        completed: Boolean(row[5]),
        completed_at: row[6] as string | null,
        pinned: Boolean(row[7]),
        sort_order: (row[8] as number) || 0,
        created_at: row[9] as string,
        updated_at: row[10] as string,
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
      const minResult = db.exec('SELECT MIN(sort_order) FROM notes WHERE date = ?', [date]);
      const minSortOrder = minResult.length > 0 && minResult[0].values[0][0] !== null
        ? (minResult[0].values[0][0] as number) - 1
        : 0;

      const note: Note = {
        id: generateId(),
        date,
        content,
        description,
        category,
        completed: false,
        completed_at: null,
        pinned: false,
        sort_order: minSortOrder,
        created_at: now,
        updated_at: now,
      };

      db.run(
        'INSERT INTO notes (id, date, content, description, category, completed, completed_at, pinned, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [note.id, note.date, note.content, note.description, note.category, 0, null, 0, note.sort_order, note.created_at, note.updated_at]
      );

      await persistDatabase();
      loadNotes();
      return note;
    },
    [db, date, loadNotes]
  );

  const updateNote = useCallback(
    async (id: string, content: string, category?: NoteCategory, description?: string | null): Promise<Note> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Get current note state for history
      const currentResult = db.exec('SELECT content, description, category, completed, completed_at, pinned, sort_order, created_at FROM notes WHERE id = ?', [id]);
      const currentNote = currentResult.length > 0 ? currentResult[0].values[0] : null;

      const finalCategory = category || (currentNote ? currentNote[2] as NoteCategory : 'todo');
      const finalDescription = description !== undefined ? description : (currentNote ? currentNote[1] as string | null : null);
      const completed = currentNote ? Boolean(currentNote[3]) : false;
      const completedAt = currentNote ? currentNote[4] as string | null : null;
      const pinned = currentNote ? Boolean(currentNote[5]) : false;
      const sortOrder = currentNote ? (currentNote[6] as number) || 0 : 0;
      const createdAt = currentNote ? currentNote[7] as string : now;

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
      loadNotes();

      return { id, date, content, description: finalDescription, category: finalCategory, completed, completed_at: completedAt, pinned, sort_order: sortOrder, created_at: createdAt, updated_at: now };
    },
    [db, date, loadNotes]
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
        saveNoteHistory(db, id, content, description, category, completed);
      }

      await persistDatabase();
      loadNotes();
    },
    [db, loadNotes]
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
      loadNotes();
    },
    [db, loadNotes]
  );

  const deleteNote = useCallback(
    async (id: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      db.run('DELETE FROM notes WHERE id = ?', [id]);

      await persistDatabase();
      loadNotes();
    },
    [db, loadNotes]
  );

  const restoreNote = useCallback(
    async (note: Note): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      db.run(
        'INSERT INTO notes (id, date, content, description, category, completed, completed_at, pinned, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [note.id, note.date, note.content, note.description, note.category, note.completed ? 1 : 0, note.completed_at, note.pinned ? 1 : 0, note.sort_order, note.created_at, note.updated_at]
      );

      await persistDatabase();
      loadNotes();
    },
    [db, loadNotes]
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
        [date, afterSortOrder]
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
        date,
        content: '',
        description: null,
        category,
        completed: false,
        completed_at: null,
        pinned: false,
        sort_order: newSortOrder,
        created_at: now,
        updated_at: now,
      };

      db.run(
        'INSERT INTO notes (id, date, content, description, category, completed, completed_at, pinned, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [note.id, note.date, note.content, note.description, note.category, 0, null, 0, note.sort_order, note.created_at, note.updated_at]
      );

      await persistDatabase();
      loadNotes();
      return note;
    },
    [db, date, loadNotes]
  );

  const reorderNotes = useCallback(
    async (orderedIds: string[]): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      // Update sort_order for each note based on its position in the array
      orderedIds.forEach((id, index) => {
        db.run('UPDATE notes SET sort_order = ? WHERE id = ?', [index, id]);
      });

      await persistDatabase();
      loadNotes();
    },
    [db, loadNotes]
  );

  return {
    notes,
    loading,
    createNote,
    createNoteAfter,
    updateNote,
    toggleCompleted,
    togglePinned,
    deleteNote,
    restoreNote,
    reorderNotes,
  };
}
