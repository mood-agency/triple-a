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
      'SELECT id, date, content, description, category, completed, created_at, updated_at FROM notes WHERE date = ? ORDER BY category ASC, completed ASC, created_at DESC',
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
        created_at: row[6] as string,
        updated_at: row[7] as string,
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
      const note: Note = {
        id: generateId(),
        date,
        content,
        description,
        category,
        completed: false,
        created_at: now,
        updated_at: now,
      };

      db.run(
        'INSERT INTO notes (id, date, content, description, category, completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [note.id, note.date, note.content, note.description, note.category, 0, note.created_at, note.updated_at]
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
      const currentResult = db.exec('SELECT content, description, category, completed FROM notes WHERE id = ?', [id]);
      const currentNote = currentResult.length > 0 ? currentResult[0].values[0] : null;

      const finalCategory = category || (currentNote ? currentNote[2] as NoteCategory : 'todo');
      const finalDescription = description !== undefined ? description : (currentNote ? currentNote[1] as string | null : null);

      db.run('UPDATE notes SET content = ?, description = ?, category = ?, updated_at = ? WHERE id = ?', [
        content,
        finalDescription,
        finalCategory,
        now,
        id,
      ]);

      // Save to history
      const completed = currentNote ? Boolean(currentNote[3]) : false;
      saveNoteHistory(db, id, content, finalDescription, finalCategory, completed);

      await persistDatabase();
      loadNotes();

      return { id, date, content, description: finalDescription, category: finalCategory, completed, created_at: '', updated_at: now };
    },
    [db, date, loadNotes]
  );

  const toggleCompleted = useCallback(
    async (id: string, completed: boolean): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Get current note state for history
      const currentResult = db.exec('SELECT content, description, category FROM notes WHERE id = ?', [id]);
      const currentNote = currentResult.length > 0 ? currentResult[0].values[0] : null;

      db.run('UPDATE notes SET completed = ?, updated_at = ? WHERE id = ?', [
        completed ? 1 : 0,
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

  const deleteNote = useCallback(
    async (id: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      db.run('DELETE FROM notes WHERE id = ?', [id]);

      await persistDatabase();
      loadNotes();
    },
    [db, loadNotes]
  );

  return {
    notes,
    loading,
    createNote,
    updateNote,
    toggleCompleted,
    deleteNote,
  };
}
