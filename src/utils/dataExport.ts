import { Database } from 'sql.js';
import type { Note, NoteHistory, ExportData, ImportResult } from '@/types/note';

const EXPORT_VERSION = '1.0';

export function exportAllData(db: Database): ExportData {
  const notesResult = db.exec(`
    SELECT id, date, content, description, category, completed, pinned, sort_order, created_at, updated_at
    FROM notes
    ORDER BY date DESC, sort_order ASC
  `);

  const historyResult = db.exec(`
    SELECT id, note_id, content, description, category, completed, changed_at
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
        pinned: Boolean(row[6]),
        sort_order: (row[7] as number) || 0,
        created_at: row[8] as string,
        updated_at: row[9] as string,
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
      }))
    : [];

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    notes,
    noteHistory,
  };
}

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

export function validateImportData(data: unknown): data is ExportData {
  if (!data || typeof data !== 'object') return false;

  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'string') return false;
  if (typeof obj.exportedAt !== 'string') return false;
  if (!Array.isArray(obj.notes)) return false;
  if (!Array.isArray(obj.noteHistory)) return false;

  for (const note of obj.notes) {
    if (!validateNote(note)) return false;
  }

  for (const history of obj.noteHistory) {
    if (!validateNoteHistory(history)) return false;
  }

  return true;
}

function validateNote(note: unknown): note is Note {
  if (!note || typeof note !== 'object') return false;

  const n = note as Record<string, unknown>;

  return (
    typeof n.id === 'string' &&
    typeof n.date === 'string' &&
    typeof n.content === 'string' &&
    (n.description === null || typeof n.description === 'string') &&
    (n.category === 'todo' || n.category === 'followup' || n.category === 'notes') &&
    typeof n.completed === 'boolean' &&
    (n.sort_order === undefined || typeof n.sort_order === 'number') &&
    typeof n.created_at === 'string' &&
    typeof n.updated_at === 'string'
  );
}

function validateNoteHistory(history: unknown): history is NoteHistory {
  if (!history || typeof history !== 'object') return false;

  const h = history as Record<string, unknown>;

  return (
    typeof h.id === 'string' &&
    typeof h.note_id === 'string' &&
    typeof h.content === 'string' &&
    (h.description === null || typeof h.description === 'string') &&
    (h.category === 'todo' || h.category === 'followup' || h.category === 'notes') &&
    typeof h.completed === 'boolean' &&
    typeof h.changed_at === 'string'
  );
}

export async function importData(
  db: Database,
  data: ExportData,
  persistDatabase: () => Promise<void>
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    notesImported: 0,
    historyImported: 0,
    errors: [],
  };

  try {
    // Import notes
    for (const note of data.notes) {
      try {
        // Check if note already exists
        const existing = db.exec(`SELECT id FROM notes WHERE id = ?`, [note.id]);

        if (existing.length > 0 && existing[0].values.length > 0) {
          // Update existing note
          db.run(
            `UPDATE notes SET
              date = ?, content = ?, description = ?, category = ?,
              completed = ?, sort_order = ?, created_at = ?, updated_at = ?
            WHERE id = ?`,
            [
              note.date,
              note.content,
              note.description,
              note.category,
              note.completed ? 1 : 0,
              note.sort_order ?? 0,
              note.created_at,
              note.updated_at,
              note.id,
            ]
          );
        } else {
          // Insert new note
          db.run(
            `INSERT INTO notes (id, date, content, description, category, completed, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              note.id,
              note.date,
              note.content,
              note.description,
              note.category,
              note.completed ? 1 : 0,
              note.sort_order ?? 0,
              note.created_at,
              note.updated_at,
            ]
          );
        }
        result.notesImported++;
      } catch (error) {
        result.errors.push(`Error importing note ${note.id}: ${error}`);
      }
    }

    // Import note history
    for (const history of data.noteHistory) {
      try {
        const existing = db.exec(`SELECT id FROM note_history WHERE id = ?`, [history.id]);

        if (existing.length === 0 || existing[0].values.length === 0) {
          db.run(
            `INSERT INTO note_history (id, note_id, content, description, category, completed, changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              history.id,
              history.note_id,
              history.content,
              history.description,
              history.category,
              history.completed ? 1 : 0,
              history.changed_at,
            ]
          );
          result.historyImported++;
        }
      } catch (error) {
        result.errors.push(`Error importing history ${history.id}: ${error}`);
      }
    }

    await persistDatabase();
    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`General import error: ${error}`);
  }

  return result;
}

export function readFileAsJson(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        resolve(json);
      } catch {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
}
