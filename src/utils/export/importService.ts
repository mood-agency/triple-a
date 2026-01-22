import type { Database } from 'sql.js';
import type { ExportData, ImportResult } from '@/types/note';

/**
 * Import data into the database
 * Handles notes, history, labels, and note-label relationships
 * Supports old format migration
 */
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
            `INSERT INTO note_history (id, note_id, content, description, category, completed, changed_at, action_type, reason, previous_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              history.id,
              history.note_id,
              history.content,
              description,
              category,
              completed ? 1 : 0,
              history.changed_at,
              history.action_type || 'edit',
              history.reason || null,
              history.previous_date || null,
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
