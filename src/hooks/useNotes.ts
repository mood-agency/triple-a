import { useState, useCallback, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Note, NoteCategory } from '@/types/note';
import { useNoteOperations } from './notes/useNoteOperations';
import { useNoteState } from './notes/useNoteState';
import { useNoteDeadline } from './notes/useNoteDeadline';
import { useNoteReorder } from './notes/useNoteReorder';
import { formatLocalDate } from '@/utils/dateUtils';

/**
 * Main hook for managing notes
 * Orchestrates specialized sub-hooks for operations, state, deadlines, and reordering
 */
export function useNotes(date?: string) {
  const { db, isReady } = useDatabase();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Default date for creating new notes (today)
  const defaultDate = formatLocalDate(new Date());
  const effectiveDate = date || defaultDate;

  /**
   * Load notes from database
   */
  const loadNotes = useCallback(() => {
    if (!db || !isReady) return;

    // If no date provided, load all notes; otherwise filter by date
    // Include last postpone reason from note_history
    // Filter out soft-deleted notes (deleted_at IS NULL)
    const query = date
      ? `SELECT n.id, n.date, n.content, n.description, n.category, n.completed, n.completed_at, n.deadline, n.pinned, n.sort_order, n.created_at, n.updated_at, n.deleted_at, n.assignee_id,
          (SELECT h.reason FROM note_history h WHERE h.note_id = n.id AND h.action_type = 'postponed' ORDER BY h.changed_at DESC LIMIT 1) as last_postpone_reason
         FROM notes n WHERE n.date = ? AND n.deleted_at IS NULL ORDER BY n.pinned DESC, n.sort_order ASC`
      : `SELECT n.id, n.date, n.content, n.description, n.category, n.completed, n.completed_at, n.deadline, n.pinned, n.sort_order, n.created_at, n.updated_at, n.deleted_at, n.assignee_id,
          (SELECT h.reason FROM note_history h WHERE h.note_id = n.id AND h.action_type = 'postponed' ORDER BY h.changed_at DESC LIMIT 1) as last_postpone_reason
         FROM notes n WHERE n.deleted_at IS NULL ORDER BY n.date DESC, n.pinned DESC, n.sort_order ASC`;

    const params = date ? [date] : [];
    const result = db.exec(query, params);

    if (result.length > 0) {
      const rows = result[0].values.map((row) => ({
        id: row[0] as string,
        date: row[1] as string,
        content: row[2] as string,
        description: row[3] as string | null,
        category: (row[4] as NoteCategory) || 'todo',
        completed: Boolean(row[5]),
        completed_at: row[6] as string | null,
        deadline: row[7] as string | null,
        pinned: Boolean(row[8]),
        sort_order: (row[9] as number) || 0,
        created_at: row[10] as string,
        updated_at: row[11] as string,
        deleted_at: row[12] as string | null,
        assignee_id: row[13] as string | null,
        last_postpone_reason: row[14] as string | null,
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

  // Initialize specialized hooks
  const operations = useNoteOperations(effectiveDate, loadNotes);
  const state = useNoteState();
  const deadline = useNoteDeadline(loadNotes);
  const reorder = useNoteReorder(loadNotes);

  // Wrap functions to pass setNotes for optimized updates
  const createNote = operations.createNote;
  const createNoteAfter = operations.createNoteAfter;

  const updateNote = useCallback(
    (id: string, content: string, category?: NoteCategory, description?: string | null) =>
      operations.updateNote(id, content, category, description, setNotes),
    [operations]
  );

  const deleteNote = useCallback(
    (id: string) => operations.deleteNote(id, setNotes),
    [operations]
  );

  const restoreNote = operations.restoreNote;

  const toggleCompleted = useCallback(
    (id: string, completed: boolean) => state.toggleCompleted(id, completed, setNotes),
    [state]
  );

  const togglePinned = useCallback(
    (id: string, pinned: boolean) => state.togglePinned(id, pinned, setNotes),
    [state]
  );

  const updateDeadline = useCallback(
    (id: string, deadlineValue: string | null) => deadline.updateDeadline(id, deadlineValue, setNotes),
    [deadline]
  );

  const updateAssignee = useCallback(
    (id: string, assigneeId: string | null) => state.updateAssignee(id, assigneeId, setNotes),
    [state]
  );

  const postponeNote = deadline.postponeNote;
  const reorderNotes = reorder.reorderNotes;

  return {
    notes,
    loading,
    createNote,
    createNoteAfter,
    updateNote,
    updateDeadline,
    updateAssignee,
    toggleCompleted,
    togglePinned,
    deleteNote,
    restoreNote,
    reorderNotes,
    postponeNote,
  };
}
