import type { MergeableStore } from 'tinybase';
import type { ExportData, ImportResult } from '@/types/note';
import { now } from '@/store/schema';

/**
 * Import data into the TinyBase store
 * Handles notes, history, labels, and note-label relationships
 * Supports old format migration
 */
export async function importData(
  store: MergeableStore,
  data: ExportData,
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
  const timestamp = now();

  try {
    // Import notes
    for (const note of data.notes) {
      try {
        // Use today's date if option is set, otherwise keep original
        const noteDate = todayDate || note.date;

        // Check if note already exists
        const existing = store.getRow('notes', note.id);

        if (existing && Object.keys(existing).length > 0) {
          // Update existing note
          store.setRow('notes', note.id, {
            date: noteDate,
            content: note.content,
            description: note.description ?? null,
            category: note.category,
            completed: note.completed,
            completed_at: note.completed_at ?? null,
            deadline: note.deadline ?? null,
            pinned: note.pinned,
            sort_order: note.sort_order ?? 0,
            assignee_id: note.assignee_id ?? null,
            created_at: note.created_at,
            updated_at: timestamp,
            deleted_at: note.deleted_at ?? null,
            remote_id: null,
            sync_status: 'pending',
            last_synced_at: null,
          });
        } else {
          // Insert new note
          store.setRow('notes', note.id, {
            date: noteDate,
            content: note.content,
            description: note.description ?? null,
            category: note.category,
            completed: note.completed,
            completed_at: note.completed_at ?? null,
            deadline: note.deadline ?? null,
            pinned: note.pinned,
            sort_order: note.sort_order ?? 0,
            assignee_id: note.assignee_id ?? null,
            created_at: note.created_at,
            updated_at: note.updated_at,
            deleted_at: note.deleted_at ?? null,
            remote_id: null,
            sync_status: 'pending',
            last_synced_at: null,
          });
        }
        result.notesImported++;
      } catch (error) {
        result.errors.push(`Error importing note ${note.id}: ${error}`);
      }
    }

    // Import note history (legacy support)
    if (data.noteHistory && data.noteHistory.length > 0) {
      for (const history of data.noteHistory) {
        try {
          const existing = store.getRow('note_history', history.id);

        if (!existing || Object.keys(existing).length === 0) {
          // Handle old format migration where description contains category and category contains completed
          let description: string | null = history.description;
          let category: string = history.category;
          let completed: boolean = history.completed;

          // Detect old format: if category is 0/1/'0'/'1', it's actually the completed field
          const validCategories = ['todo', 'followup', 'notes', 'meeting'];
          if (!validCategories.includes(category)) {
            // Old format detected - shift fields
            category = description || 'todo';
            const oldCategory = history.category as unknown;
            completed = oldCategory === 1 || oldCategory === '1' || oldCategory === true;
            description = null;
            console.log(`[Import] Migrated old format history ${history.id}: category=${category}, completed=${completed}`);
          }

          store.setRow('note_history', history.id, {
            note_id: history.note_id,
            content: history.content,
            description: description,
            category: category as 'todo' | 'followup' | 'notes' | 'meeting',
            completed: completed,
            changed_at: history.changed_at,
            action_type: history.action_type || 'edit',
            reason: history.reason ?? null,
            previous_date: history.previous_date ?? null,
            created_at: history.changed_at,
            remote_id: null,
            sync_status: 'local',
            last_synced_at: null,
          });
          result.historyImported++;
        }
      } catch (error) {
        result.errors.push(`Error importing history ${history.id}: ${error}`);
      }
      }
    }

    // Import labels if present
    if (data.labels && data.labels.length > 0) {
      for (const label of data.labels) {
        try {
          const existing = store.getRow('labels', label.id);

          if (existing && Object.keys(existing).length > 0) {
            store.setRow('labels', label.id, {
              name: label.name,
              color: label.color,
              created_at: label.created_at,
              updated_at: timestamp,
              deleted_at: null,
              remote_id: null,
              sync_status: 'pending',
              last_synced_at: null,
            });
          } else {
            store.setRow('labels', label.id, {
              name: label.name,
              color: label.color,
              created_at: label.created_at,
              updated_at: label.updated_at,
              deleted_at: null,
              remote_id: null,
              sync_status: 'pending',
              last_synced_at: null,
            });
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
          // Use a composite key for note_labels
          const id = `${noteLabel.note_id}_${noteLabel.label_id}`;
          const existing = store.getRow('note_labels', id);

          if (!existing || Object.keys(existing).length === 0) {
            store.setRow('note_labels', id, {
              note_id: noteLabel.note_id,
              label_id: noteLabel.label_id,
              created_at: noteLabel.created_at,
            });
          }
        } catch (error) {
          result.errors.push(`Error importing note-label ${noteLabel.note_id}-${noteLabel.label_id}: ${error}`);
        }
      }
    }

    result.success = result.errors.length === 0;
  } catch (error) {
    result.errors.push(`General import error: ${error}`);
  }

  return result;
}
