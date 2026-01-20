import { useState, useCallback, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { persistDatabase } from '@/db';
import type { Label } from '@/types/note';

function generateId(): string {
  return crypto.randomUUID();
}

export function useLabels() {
  const { db, isReady } = useDatabase();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteLabelVersion, setNoteLabelVersion] = useState(0);

  const loadLabels = useCallback(() => {
    if (!db || !isReady) return;

    const result = db.exec(
      'SELECT id, name, color, created_at, updated_at FROM labels ORDER BY name ASC'
    );

    if (result.length > 0) {
      const rows = result[0].values.map((row) => ({
        id: row[0] as string,
        name: row[1] as string,
        color: row[2] as string,
        created_at: row[3] as string,
        updated_at: row[4] as string,
      }));
      setLabels(rows);
    } else {
      setLabels([]);
    }
    setLoading(false);
  }, [db, isReady]);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  const createLabel = useCallback(
    async (name: string, color: string = '#6b7280'): Promise<Label> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();
      const label: Label = {
        id: generateId(),
        name,
        color,
        created_at: now,
        updated_at: now,
      };

      db.run(
        'INSERT INTO labels (id, name, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [label.id, label.name, label.color, label.created_at, label.updated_at]
      );

      await persistDatabase();
      loadLabels();
      return label;
    },
    [db, loadLabels]
  );

  const updateLabel = useCallback(
    async (id: string, name: string, color: string): Promise<Label> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      db.run('UPDATE labels SET name = ?, color = ?, updated_at = ? WHERE id = ?', [
        name,
        color,
        now,
        id,
      ]);

      await persistDatabase();
      loadLabels();

      return { id, name, color, created_at: '', updated_at: now };
    },
    [db, loadLabels]
  );

  const deleteLabel = useCallback(
    async (id: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      db.run('DELETE FROM labels WHERE id = ?', [id]);

      await persistDatabase();
      loadLabels();
    },
    [db, loadLabels]
  );

  const getLabelsForNote = useCallback(
    (noteId: string): Label[] => {
      if (!db || !isReady) return [];

      const result = db.exec(
        `SELECT l.id, l.name, l.color, l.created_at, l.updated_at
         FROM labels l
         INNER JOIN note_labels nl ON l.id = nl.label_id
         WHERE nl.note_id = ?
         ORDER BY l.name ASC`,
        [noteId]
      );

      if (result.length > 0) {
        return result[0].values.map((row) => ({
          id: row[0] as string,
          name: row[1] as string,
          color: row[2] as string,
          created_at: row[3] as string,
          updated_at: row[4] as string,
        }));
      }
      return [];
    },
    [db, isReady]
  );

  const addLabelToNote = useCallback(
    async (noteId: string, labelId: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Use INSERT OR IGNORE to avoid duplicates
      db.run(
        'INSERT OR IGNORE INTO note_labels (note_id, label_id, created_at) VALUES (?, ?, ?)',
        [noteId, labelId, now]
      );

      await persistDatabase();
      setNoteLabelVersion(v => v + 1);
    },
    [db]
  );

  const removeLabelFromNote = useCallback(
    async (noteId: string, labelId: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      db.run('DELETE FROM note_labels WHERE note_id = ? AND label_id = ?', [noteId, labelId]);

      await persistDatabase();
      setNoteLabelVersion(v => v + 1);
    },
    [db]
  );

  const setLabelsForNote = useCallback(
    async (noteId: string, labelIds: string[]): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Remove all existing labels for this note
      db.run('DELETE FROM note_labels WHERE note_id = ?', [noteId]);

      // Add new labels
      for (const labelId of labelIds) {
        db.run(
          'INSERT INTO note_labels (note_id, label_id, created_at) VALUES (?, ?, ?)',
          [noteId, labelId, now]
        );
      }

      await persistDatabase();
      setNoteLabelVersion(v => v + 1);
    },
    [db]
  );

  return {
    labels,
    loading,
    noteLabelVersion,
    createLabel,
    updateLabel,
    deleteLabel,
    getLabelsForNote,
    addLabelToNote,
    removeLabelFromNote,
    setLabelsForNote,
  };
}
