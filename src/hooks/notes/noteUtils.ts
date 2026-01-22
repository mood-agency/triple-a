import type { Database } from 'sql.js';
import type { NoteCategory, ChangelogActionType } from '@/types/note';

/**
 * Generate a unique ID for notes
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Save note change to history
 */
export function saveNoteHistory(
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
