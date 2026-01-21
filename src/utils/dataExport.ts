import { Database } from 'sql.js';
import type { Note, NoteHistory, Label, NoteLabel, ExportData, ImportResult } from '@/types/note';

const EXPORT_VERSION = '1.0';

export function exportAllData(db: Database): ExportData {
  const notesResult = db.exec(`
    SELECT id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at
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
        completed_at: row[6] as string | null,
        deadline: row[7] as string | null,
        pinned: Boolean(row[8]),
        sort_order: (row[9] as number) || 0,
        created_at: row[10] as string,
        updated_at: row[11] as string,
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
  console.log('[Import] Starting validation...');

  if (!data || typeof data !== 'object') {
    console.error('[Import] Data is not an object:', data);
    return false;
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'string') {
    console.error('[Import] Invalid version:', obj.version);
    return false;
  }
  if (typeof obj.exportedAt !== 'string') {
    console.error('[Import] Invalid exportedAt:', obj.exportedAt);
    return false;
  }
  if (!Array.isArray(obj.notes)) {
    console.error('[Import] Notes is not an array:', obj.notes);
    return false;
  }
  if (!Array.isArray(obj.noteHistory)) {
    console.error('[Import] NoteHistory is not an array:', obj.noteHistory);
    return false;
  }

  console.log(`[Import] Validating ${obj.notes.length} notes...`);
  for (let i = 0; i < obj.notes.length; i++) {
    const note = obj.notes[i];
    if (!validateNote(note)) {
      console.error(`[Import] Invalid note at index ${i}:`, note);
      return false;
    }
  }

  console.log(`[Import] Validating ${obj.noteHistory.length} history entries...`);
  for (let i = 0; i < obj.noteHistory.length; i++) {
    const history = obj.noteHistory[i];
    if (!validateNoteHistory(history)) {
      console.error(`[Import] Invalid history at index ${i}:`, history);
      return false;
    }
  }

  // Validate labels if present (optional)
  if (obj.labels !== undefined) {
    if (!Array.isArray(obj.labels)) {
      console.error('[Import] Labels is not an array:', obj.labels);
      return false;
    }
    console.log(`[Import] Validating ${obj.labels.length} labels...`);
    for (let i = 0; i < obj.labels.length; i++) {
      const label = obj.labels[i];
      if (!validateLabel(label)) {
        console.error(`[Import] Invalid label at index ${i}:`, label);
        return false;
      }
    }
  }

  // Validate noteLabels if present (optional)
  if (obj.noteLabels !== undefined) {
    if (!Array.isArray(obj.noteLabels)) {
      console.error('[Import] NoteLabels is not an array:', obj.noteLabels);
      return false;
    }
    console.log(`[Import] Validating ${obj.noteLabels.length} note-label relations...`);
    for (let i = 0; i < obj.noteLabels.length; i++) {
      const noteLabel = obj.noteLabels[i];
      if (!validateNoteLabel(noteLabel)) {
        console.error(`[Import] Invalid noteLabel at index ${i}:`, noteLabel);
        return false;
      }
    }
  }

  console.log('[Import] Validation passed!');
  return true;
}

function validateNote(note: unknown): note is Note {
  if (!note || typeof note !== 'object') {
    console.error('[validateNote] Not an object');
    return false;
  }

  const n = note as Record<string, unknown>;

  if (typeof n.id !== 'string') {
    console.error('[validateNote] Invalid id:', n.id);
    return false;
  }
  if (typeof n.date !== 'string') {
    console.error('[validateNote] Invalid date:', n.date);
    return false;
  }
  if (typeof n.content !== 'string') {
    console.error('[validateNote] Invalid content:', n.content);
    return false;
  }
  if (n.description !== null && typeof n.description !== 'string') {
    console.error('[validateNote] Invalid description:', n.description);
    return false;
  }
  if (n.category !== 'todo' && n.category !== 'followup' && n.category !== 'notes') {
    console.error('[validateNote] Invalid category:', n.category);
    return false;
  }
  if (typeof n.completed !== 'boolean') {
    console.error('[validateNote] Invalid completed:', n.completed);
    return false;
  }
  if (n.pinned !== undefined && typeof n.pinned !== 'boolean') {
    console.error('[validateNote] Invalid pinned:', n.pinned);
    return false;
  }
  if (n.completed_at !== undefined && n.completed_at !== null && typeof n.completed_at !== 'string') {
    console.error('[validateNote] Invalid completed_at:', n.completed_at);
    return false;
  }
  if (n.deadline !== undefined && n.deadline !== null && typeof n.deadline !== 'string') {
    console.error('[validateNote] Invalid deadline:', n.deadline);
    return false;
  }
  if (n.sort_order !== undefined && typeof n.sort_order !== 'number') {
    console.error('[validateNote] Invalid sort_order:', n.sort_order);
    return false;
  }
  if (typeof n.created_at !== 'string') {
    console.error('[validateNote] Invalid created_at:', n.created_at);
    return false;
  }
  if (typeof n.updated_at !== 'string') {
    console.error('[validateNote] Invalid updated_at:', n.updated_at);
    return false;
  }

  return true;
}

function validateNoteHistory(history: unknown): history is NoteHistory {
  if (!history || typeof history !== 'object') {
    console.error('[validateNoteHistory] Not an object');
    return false;
  }

  const h = history as Record<string, unknown>;

  if (typeof h.id !== 'string') {
    console.error('[validateNoteHistory] Invalid id:', h.id);
    return false;
  }
  if (typeof h.note_id !== 'string') {
    console.error('[validateNoteHistory] Invalid note_id:', h.note_id);
    return false;
  }
  if (typeof h.content !== 'string') {
    console.error('[validateNoteHistory] Invalid content:', h.content);
    return false;
  }
  // Description is optional and may not exist in old backups
  if (h.description !== undefined && h.description !== null && typeof h.description !== 'string') {
    // Check if description contains a category value (old format migration)
    if (h.description !== 'todo' && h.description !== 'followup' && h.description !== 'notes') {
      console.error('[validateNoteHistory] Invalid description:', h.description);
      return false;
    }
  }
  // Category validation - accept string or number (old format had numbers)
  const validCategories = ['todo', 'followup', 'notes'];
  if (!validCategories.includes(h.category as string)) {
    // Check if this is an old format where category contains completed (0/1 or '0'/'1')
    if (h.category !== 0 && h.category !== 1 && h.category !== '0' && h.category !== '1') {
      console.error('[validateNoteHistory] Invalid category:', h.category);
      return false;
    }
    // Old format detected - will need migration during import
    console.log('[validateNoteHistory] Detected old format, will migrate during import');
  }
  // Completed validation - accept boolean or number (old format)
  if (typeof h.completed !== 'boolean' && h.completed !== 0 && h.completed !== 1) {
    console.error('[validateNoteHistory] Invalid completed:', h.completed);
    return false;
  }
  if (typeof h.changed_at !== 'string') {
    console.error('[validateNoteHistory] Invalid changed_at:', h.changed_at);
    return false;
  }

  return true;
}

function validateLabel(label: unknown): label is Label {
  if (!label || typeof label !== 'object') {
    console.error('[validateLabel] Not an object');
    return false;
  }

  const l = label as Record<string, unknown>;

  if (typeof l.id !== 'string') {
    console.error('[validateLabel] Invalid id:', l.id);
    return false;
  }
  if (typeof l.name !== 'string') {
    console.error('[validateLabel] Invalid name:', l.name);
    return false;
  }
  if (typeof l.color !== 'string') {
    console.error('[validateLabel] Invalid color:', l.color);
    return false;
  }
  if (typeof l.created_at !== 'string') {
    console.error('[validateLabel] Invalid created_at:', l.created_at);
    return false;
  }
  if (typeof l.updated_at !== 'string') {
    console.error('[validateLabel] Invalid updated_at:', l.updated_at);
    return false;
  }

  return true;
}

function validateNoteLabel(noteLabel: unknown): noteLabel is NoteLabel {
  if (!noteLabel || typeof noteLabel !== 'object') {
    console.error('[validateNoteLabel] Not an object');
    return false;
  }

  const nl = noteLabel as Record<string, unknown>;

  if (typeof nl.note_id !== 'string') {
    console.error('[validateNoteLabel] Invalid note_id:', nl.note_id);
    return false;
  }
  if (typeof nl.label_id !== 'string') {
    console.error('[validateNoteLabel] Invalid label_id:', nl.label_id);
    return false;
  }
  if (typeof nl.created_at !== 'string') {
    console.error('[validateNoteLabel] Invalid created_at:', nl.created_at);
    return false;
  }

  return true;
}

export async function importData(
  db: Database,
  data: ExportData,
  persistDatabase: () => Promise<void>,
  options?: { useCurrentDate?: boolean }
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    notesImported: 0,
    historyImported: 0,
    errors: [],
  };

  // Get today's date if useCurrentDate option is set
  const todayDate = options?.useCurrentDate ? new Date().toISOString().split('T')[0] : null;

  try {
    // Import notes
    for (const note of data.notes) {
      try {
        // Use today's date if option is set, otherwise keep original
        const noteDate = todayDate || note.date;

        // Check if note already exists
        const existing = db.exec(`SELECT id FROM notes WHERE id = ?`, [note.id]);

        if (existing.length > 0 && existing[0].values.length > 0) {
          // Update existing note
          db.run(
            `UPDATE notes SET
              date = ?, content = ?, description = ?, category = ?,
              completed = ?, completed_at = ?, deadline = ?, pinned = ?, sort_order = ?, created_at = ?, updated_at = ?
            WHERE id = ?`,
            [
              noteDate,
              note.content,
              note.description,
              note.category,
              note.completed ? 1 : 0,
              note.completed_at ?? null,
              note.deadline ?? null,
              note.pinned ? 1 : 0,
              note.sort_order ?? 0,
              note.created_at,
              note.updated_at,
              note.id,
            ]
          );
        } else {
          // Insert new note
          db.run(
            `INSERT INTO notes (id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              note.id,
              noteDate,
              note.content,
              note.description,
              note.category,
              note.completed ? 1 : 0,
              note.completed_at ?? null,
              note.deadline ?? null,
              note.pinned ? 1 : 0,
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
          // Handle old format migration where description contains category and category contains completed
          let description: string | null = history.description;
          let category: string = history.category;
          let completed: boolean = history.completed;

          // Detect old format: if category is 0/1/'0'/'1', it's actually the completed field
          const validCategories = ['todo', 'followup', 'notes'];
          if (!validCategories.includes(category)) {
            // Old format detected - shift fields
            // description actually contains category
            // category actually contains completed (as 0/1 or '0'/'1')
            category = description || 'todo';
            const oldCategory = history.category as unknown;
            completed = oldCategory === 1 || oldCategory === '1' || oldCategory === true;
            description = null;
            console.log(`[Import] Migrated old format history ${history.id}: category=${category}, completed=${completed}`);
          }

          db.run(
            `INSERT INTO note_history (id, note_id, content, description, category, completed, changed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              history.id,
              history.note_id,
              history.content,
              description,
              category,
              completed ? 1 : 0,
              history.changed_at,
            ]
          );
          result.historyImported++;
        }
      } catch (error) {
        result.errors.push(`Error importing history ${history.id}: ${error}`);
      }
    }

    // Import labels if present
    if (data.labels && data.labels.length > 0) {
      for (const label of data.labels) {
        try {
          const existing = db.exec(`SELECT id FROM labels WHERE id = ?`, [label.id]);

          if (existing.length > 0 && existing[0].values.length > 0) {
            db.run(
              `UPDATE labels SET name = ?, color = ?, updated_at = ? WHERE id = ?`,
              [label.name, label.color, label.updated_at, label.id]
            );
          } else {
            db.run(
              `INSERT INTO labels (id, name, color, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?)`,
              [label.id, label.name, label.color, label.created_at, label.updated_at]
            );
          }
        } catch (error) {
          result.errors.push(`Error importing label ${label.id}: ${error}`);
        }
      }
    }

    // Import note-label relationships if present
    if (data.noteLabels && data.noteLabels.length > 0) {
      for (const noteLabel of data.noteLabels) {
        try {
          const existing = db.exec(
            `SELECT note_id FROM note_labels WHERE note_id = ? AND label_id = ?`,
            [noteLabel.note_id, noteLabel.label_id]
          );

          if (existing.length === 0 || existing[0].values.length === 0) {
            db.run(
              `INSERT INTO note_labels (note_id, label_id, created_at)
              VALUES (?, ?, ?)`,
              [noteLabel.note_id, noteLabel.label_id, noteLabel.created_at]
            );
          }
        } catch (error) {
          result.errors.push(`Error importing note-label ${noteLabel.note_id}-${noteLabel.label_id}: ${error}`);
        }
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
