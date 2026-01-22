import type { Database } from 'sql.js';
import type { Note, NoteHistory, Label, NoteLabel, ExportData } from '@/types/note';

const EXPORT_VERSION = '1.0';

/**
 * Export all data from the database
 * Retrieves notes, history, labels, and note-label relationships
 */
export function exportAllData(db: Database): ExportData {
  const notesResult = db.exec(`
    SELECT id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at, deleted_at
    FROM notes
    ORDER BY date DESC, sort_order ASC
  `);

  const historyResult = db.exec(`
    SELECT id, note_id, content, description, category, completed, changed_at, action_type, reason, previous_date
    FROM note_history
    ORDER BY changed_at DESC
  `);

  const notes: Note[] = notesResult.length > 0
    ? notesResult[0].values.map((row) => ({
        id: row[0] as string,
        date: row[1] as string,
        content: row[2] as string,
        description: row[3] as string | null,
        category: row[4] as Note['category'],
        completed: Boolean(row[5]),
        completed_at: row[6] as string | null,
        deadline: row[7] as string | null,
        pinned: Boolean(row[8]),
        sort_order: (row[9] as number) || 0,
        created_at: row[10] as string,
        updated_at: row[11] as string,
        deleted_at: row[12] as string | null,
      }))
    : [];

  const noteHistory: NoteHistory[] = historyResult.length > 0
    ? historyResult[0].values.map((row) => ({
        id: row[0] as string,
        note_id: row[1] as string,
        content: row[2] as string,
        description: row[3] as string | null,
        category: row[4] as NoteHistory['category'],
        completed: Boolean(row[5]),
        changed_at: row[6] as string,
        action_type: (row[7] as NoteHistory['action_type']) || 'edit',
        reason: row[8] as string | null,
        previous_date: row[9] as string | null,
      }))
    : [];

  // Export labels
  const labelsResult = db.exec(`
    SELECT id, name, color, created_at, updated_at
    FROM labels
    ORDER BY name ASC
  `);

  const labels: Label[] = labelsResult.length > 0
    ? labelsResult[0].values.map((row) => ({
        id: row[0] as string,
        name: row[1] as string,
        color: row[2] as string,
        created_at: row[3] as string,
        updated_at: row[4] as string,
      }))
    : [];

  // Export note-label relationships
  const noteLabelsResult = db.exec(`
    SELECT note_id, label_id, created_at
    FROM note_labels
  `);

  const noteLabels: NoteLabel[] = noteLabelsResult.length > 0
    ? noteLabelsResult[0].values.map((row) => ({
        note_id: row[0] as string,
        label_id: row[1] as string,
        created_at: row[2] as string,
      }))
    : [];

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    notes,
    noteHistory,
    labels,
    noteLabels,
  };
}

/**
 * Download exported data as JSON file
 * Creates a Blob, generates download link, and triggers download
 */
export function downloadExportFile(data: ExportData): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `notes-backup-${date}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
