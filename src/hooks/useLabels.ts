import { useState, useCallback, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useSync } from '@/contexts/SyncContext';
import { persistDatabase } from '@/db';
import type { Label } from '@/types/note';

function generateId(): string {
  return crypto.randomUUID();
}

export function useLabels() {
  const { db, isReady } = useDatabase();
  const { queueOperation } = useSync();
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
      await queueOperation('labels', 'insert', label.id, {
        name: label.name,
        color: label.color,
        created_at: label.created_at,
        updated_at: label.updated_at,
      });
      loadLabels();
      return label;
    },
    [db, loadLabels, queueOperation]
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
      await queueOperation('labels', 'update', id, {
        name,
        color,
        updated_at: now,
      });
      loadLabels();

      return { id, name, color, created_at: '', updated_at: now };
    },
    [db, loadLabels, queueOperation]
  );

  const deleteLabel = useCallback(
    async (id: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      db.run('DELETE FROM labels WHERE id = ?', [id]);

      await persistDatabase();
      await queueOperation('labels', 'delete', id);
      loadLabels();
    },
    [db, loadLabels, queueOperation]
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
      await queueOperation('note_labels', 'insert', `${noteId}-${labelId}`, {
        note_id: noteId,
        label_id: labelId,
        created_at: now,
      });
      setNoteLabelVersion(v => v + 1);
    },
    [db, queueOperation]
  );

  const removeLabelFromNote = useCallback(
    async (noteId: string, labelId: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      db.run('DELETE FROM note_labels WHERE note_id = ? AND label_id = ?', [noteId, labelId]);

      await persistDatabase();
      await queueOperation('note_labels', 'delete', `${noteId}-${labelId}`, {
        note_id: noteId,
        label_id: labelId,
      });
      setNoteLabelVersion(v => v + 1);
    },
    [db, queueOperation]
  );

  const setLabelsForNote = useCallback(
    async (noteId: string, labelIds: string[]): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Get existing labels for this note to queue delete operations
      const existingResult = db.exec(
        'SELECT label_id FROM note_labels WHERE note_id = ?',
        [noteId]
      );
      const existingLabelIds = existingResult.length > 0
        ? existingResult[0].values.map(row => row[0] as string)
        : [];

      // Remove all existing labels for this note
      db.run('DELETE FROM note_labels WHERE note_id = ?', [noteId]);

      // Queue delete operations for removed labels
      for (const labelId of existingLabelIds) {
        await queueOperation('note_labels', 'delete', `${noteId}-${labelId}`, {
          note_id: noteId,
          label_id: labelId,
        });
      }

      // Add new labels
      for (const labelId of labelIds) {
        db.run(
          'INSERT INTO note_labels (note_id, label_id, created_at) VALUES (?, ?, ?)',
          [noteId, labelId, now]
        );
        await queueOperation('note_labels', 'insert', `${noteId}-${labelId}`, {
          note_id: noteId,
          label_id: labelId,
          created_at: now,
        });
      }

      await persistDatabase();
      setNoteLabelVersion(v => v + 1);
    },
    [db, queueOperation]
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
