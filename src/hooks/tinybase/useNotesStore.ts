import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import type { Note, NoteCategory } from '@/types/note';
import { generateId, now } from '@/store/schema';
import { formatLocalDate } from '@/utils/dateUtils';

/**
 * TinyBase-based notes hook
 * Provides the same API as the original useNotes hook
 */
export function useNotesStore(date?: string) {
  const { store, isReady } = useTinyBase();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  // Default date for creating new notes (today)
  const defaultDate = formatLocalDate(new Date());
  const effectiveDate = date || defaultDate;

  /**
   * Load notes from TinyBase store
   */
  const loadNotes = useCallback(() => {
    if (!store || !isReady) return;

    const notesTable = store.getTable('notes') || {};
    const historyTable = store.getTable('note_history') || {};

    // Convert to array and filter
    const notesList: Note[] = Object.entries(notesTable)
      .filter(([_, noteRow]) => {
        const row = noteRow as Record<string, unknown>;
        // Filter out soft-deleted notes
        if (row.deleted_at) return false;
        // Filter by date if provided
        if (date && row.date !== date) return false;
        return true;
      })
      .map(([id, noteRow]) => {
        const row = noteRow as Record<string, unknown>;

        // Find last postpone reason from history
        let lastPostponeReason: string | null = null;
        const noteHistoryEntries = Object.values(historyTable)
          .filter((h) => {
            const histRow = h as Record<string, unknown>;
            return histRow.note_id === id && histRow.action_type === 'postponed';
          })
          .sort((a, b) => {
            const aTime = (a as Record<string, unknown>).changed_at as string;
            const bTime = (b as Record<string, unknown>).changed_at as string;
            return bTime.localeCompare(aTime);
          });

        if (noteHistoryEntries.length > 0) {
          lastPostponeReason = (noteHistoryEntries[0] as Record<string, unknown>).reason as string | null;
        }

        return {
          id,
          date: row.date as string,
          content: row.content as string,
          description: (row.description as string) || null,
          category: (row.category as NoteCategory) || 'todo',
          completed: Boolean(row.completed),
          completed_at: (row.completed_at as string) || null,
          deadline: (row.deadline as string) || null,
          pinned: Boolean(row.pinned),
          sort_order: (row.sort_order as number) || 0,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
          deleted_at: (row.deleted_at as string) || null,
          assignee_id: (row.assignee_id as string) || null,
          last_postpone_reason: lastPostponeReason,
          remote_id: (row.remote_id as string) || null,
          sync_status: (row.sync_status as Note['sync_status']) || 'local',
          last_synced_at: (row.last_synced_at as string) || null,
        };
      })
      // Sort: pinned first, then by sort_order
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        return a.sort_order - b.sort_order;
      });

    setNotes(notesList);
    setLoading(false);
  }, [store, isReady, date]);

  // Load notes when store is ready or date changes
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Listen to store changes
  useEffect(() => {
    if (!store) return;

    const listenerId = store.addTableListener('notes', () => {
      console.log('[useNotesStore] Table listener triggered, reloading notes');
      loadNotes();
    });

    return () => {
      store.delListener(listenerId);
    };
  }, [store, loadNotes]);

  /**
   * Create a new note
   */
  const createNote = useCallback(
    (
      content: string,
      category: NoteCategory = 'todo',
      description?: string | null,
      labelIds?: string[]
    ): string | null => {
      if (!store) return null;

      const id = generateId();
      const timestamp = now();

      // Calculate sort_order (put at the end of existing notes)
      const existingNotes = Object.values(store.getTable('notes') || {}).filter(
        (n) => (n as Record<string, unknown>).date === effectiveDate
      );
      const maxSortOrder = existingNotes.reduce((max, n) => {
        const sortOrder = (n as Record<string, unknown>).sort_order as number;
        return Math.max(max, sortOrder || 0);
      }, -1);

      store.setRow('notes', id, {
        date: effectiveDate,
        content,
        description: description || null,
        category,
        completed: false,
        completed_at: null,
        deadline: null,
        pinned: false,
        sort_order: maxSortOrder + 1,
        assignee_id: null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        remote_id: null,
        sync_status: 'local',
        last_synced_at: null,
      });

      // Save initial history entry
      const historyId = generateId();
      store.setRow('note_history', historyId, {
        note_id: id,
        content,
        description: description || null,
        category,
        completed: false,
        changed_at: timestamp,
        action_type: 'created',
        reason: null,
        previous_date: null,
      });

      // Add labels if provided
      if (labelIds && labelIds.length > 0) {
        for (const labelId of labelIds) {
          const noteLabelId = `${id}-${labelId}`;
          store.setRow('note_labels', noteLabelId, {
            note_id: id,
            label_id: labelId,
            created_at: timestamp,
          });
        }
      }

      return id;
    },
    [store, effectiveDate]
  );

  /**
   * Create a note after a specific note (for keyboard navigation)
   */
  const createNoteAfter = useCallback(
    (
      afterNoteId: string,
      content: string,
      category: NoteCategory = 'todo',
      description?: string | null
    ): string | null => {
      if (!store) return null;

      const afterNote = store.getRow('notes', afterNoteId);
      if (!afterNote) return createNote(content, category, description);

      const afterSortOrder = (afterNote.sort_order as number) || 0;

      // Find the next note's sort order
      const notesTable = store.getTable('notes') || {};
      const sameDateNotes = Object.entries(notesTable)
        .filter(([_, n]) => (n as Record<string, unknown>).date === effectiveDate)
        .map(([id, n]) => ({ id, sort_order: (n as Record<string, unknown>).sort_order as number }))
        .sort((a, b) => a.sort_order - b.sort_order);

      const afterIndex = sameDateNotes.findIndex((n) => n.id === afterNoteId);
      let newSortOrder: number;

      if (afterIndex < sameDateNotes.length - 1) {
        // Insert between two notes
        const nextSortOrder = sameDateNotes[afterIndex + 1].sort_order;
        newSortOrder = (afterSortOrder + nextSortOrder) / 2;
      } else {
        // Insert at the end
        newSortOrder = afterSortOrder + 1;
      }

      const id = generateId();
      const timestamp = now();

      store.setRow('notes', id, {
        date: effectiveDate,
        content,
        description: description || null,
        category,
        completed: false,
        completed_at: null,
        deadline: null,
        pinned: false,
        sort_order: newSortOrder,
        assignee_id: null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        remote_id: null,
        sync_status: 'local',
        last_synced_at: null,
      });

      // Save initial history entry
      const historyId = generateId();
      store.setRow('note_history', historyId, {
        note_id: id,
        content,
        description: description || null,
        category,
        completed: false,
        changed_at: timestamp,
        action_type: 'created',
        reason: null,
        previous_date: null,
      });

      return id;
    },
    [store, effectiveDate, createNote]
  );

  /**
   * Update a note
   */
  const updateNote = useCallback(
    (
      id: string,
      content: string,
      category?: NoteCategory,
      description?: string | null
    ): void => {
      if (!store) return;

      const existingNote = store.getRow('notes', id);
      if (!existingNote) return;

      const timestamp = now();
      const updates: Record<string, unknown> = {
        content,
        updated_at: timestamp,
        sync_status: 'pending',
      };

      if (category !== undefined) {
        updates.category = category;
      }
      if (description !== undefined) {
        updates.description = description;
      }

      store.setPartialRow('notes', id, updates);

      // Save history entry
      const historyId = generateId();
      store.setRow('note_history', historyId, {
        note_id: id,
        content,
        description: description ?? (existingNote.description as string | null),
        category: category ?? (existingNote.category as NoteCategory),
        completed: existingNote.completed as boolean,
        changed_at: timestamp,
        action_type: 'edit',
        reason: null,
        previous_date: null,
      });
    },
    [store]
  );

  /**
   * Delete a note (soft delete)
   */
  const deleteNote = useCallback(
    (id: string): void => {
      if (!store) return;

      const timestamp = now();
      store.setPartialRow('notes', id, {
        deleted_at: timestamp,
        updated_at: timestamp,
        sync_status: 'pending',
      });
    },
    [store]
  );

  /**
   * Restore a deleted note
   */
  const restoreNote = useCallback(
    (note: Note): void => {
      if (!store) return;

      const timestamp = now();
      store.setPartialRow('notes', note.id, {
        deleted_at: null,
        updated_at: timestamp,
        sync_status: 'pending',
      });
    },
    [store]
  );

  /**
   * Toggle note completed status
   */
  const toggleCompleted = useCallback(
    (id: string, completed: boolean): void => {
      if (!store) return;

      const existingNote = store.getRow('notes', id);
      if (!existingNote) return;

      const timestamp = now();
      store.setPartialRow('notes', id, {
        completed,
        completed_at: completed ? timestamp : null,
        updated_at: timestamp,
        sync_status: 'pending',
      });

      // Save history entry
      const historyId = generateId();
      store.setRow('note_history', historyId, {
        note_id: id,
        content: existingNote.content as string,
        description: existingNote.description as string | null,
        category: existingNote.category as NoteCategory,
        completed,
        changed_at: timestamp,
        action_type: completed ? 'completed' : 'uncompleted',
        reason: null,
        previous_date: null,
      });
    },
    [store]
  );

  /**
   * Toggle note pinned status
   */
  const togglePinned = useCallback(
    (id: string, pinned: boolean): void => {
      if (!store) return;

      const timestamp = now();
      store.setPartialRow('notes', id, {
        pinned,
        updated_at: timestamp,
        sync_status: 'pending',
      });
    },
    [store]
  );

  /**
   * Update note deadline
   */
  const updateDeadline = useCallback(
    (id: string, deadline: string | null): void => {
      if (!store) return;

      const timestamp = now();
      store.setPartialRow('notes', id, {
        deadline,
        updated_at: timestamp,
        sync_status: 'pending',
      });
    },
    [store]
  );

  /**
   * Update note assignee
   */
  const updateAssignee = useCallback(
    (id: string, assigneeId: string | null): void => {
      if (!store) return;

      const timestamp = now();
      store.setPartialRow('notes', id, {
        assignee_id: assigneeId,
        updated_at: timestamp,
        sync_status: 'pending',
      });
    },
    [store]
  );

  /**
   * Postpone a note to a new date
   */
  const postponeNote = useCallback(
    (id: string, newDate: string, reason?: string): void => {
      if (!store) return;

      const existingNote = store.getRow('notes', id);
      if (!existingNote) return;

      const timestamp = now();
      const previousDate = existingNote.date as string;

      store.setPartialRow('notes', id, {
        date: newDate,
        updated_at: timestamp,
        sync_status: 'pending',
      });

      // Save history entry with postpone info
      const historyId = generateId();
      store.setRow('note_history', historyId, {
        note_id: id,
        content: existingNote.content as string,
        description: existingNote.description as string | null,
        category: existingNote.category as NoteCategory,
        completed: existingNote.completed as boolean,
        changed_at: timestamp,
        action_type: 'postponed',
        reason: reason || null,
        previous_date: previousDate,
      });
    },
    [store]
  );

  /**
   * Reorder notes
   */
  const reorderNotes = useCallback(
    (reorderedNotes: Note[]): void => {
      if (!store) return;

      const timestamp = now();

      reorderedNotes.forEach((note, index) => {
        store.setPartialRow('notes', note.id, {
          sort_order: index,
          updated_at: timestamp,
          sync_status: 'pending',
        });
      });
    },
    [store]
  );

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
