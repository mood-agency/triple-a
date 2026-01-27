import { useState, useCallback, useEffect } from 'react';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import type { Note, NoteCategory } from '@/types/note';
import { generateId, now } from '@/store/schema';
import { formatLocalDate } from '@/utils/dateUtils';
import type { MergeableStore } from 'tinybase';

/**
 * Cleanup old versions to maintain storage efficiency
 * Keeps only the most recent maxVersions for each note
 */
function cleanupOldVersions(store: MergeableStore, noteId: string, maxVersions = 50): void {
  const versionsTable = store.getTable('note_versions') || {};

  // Get all versions for this note
  const versions = Object.entries(versionsTable)
    .filter(([, v]) => (v as Record<string, unknown>).note_id === noteId)
    .map(([id, v]) => ({
      id,
      version_number: (v as Record<string, unknown>).version_number as number,
    }))
    .sort((a, b) => b.version_number - a.version_number); // DESC

  // Delete versions beyond maxVersions
  if (versions.length > maxVersions) {
    const toDelete = versions.slice(maxVersions);
    toDelete.forEach(({ id }) => {
      store.delRow('note_versions', id);
    });
  }
}

interface UseNotesStoreOptions {
  date?: string;
  projectId?: string | null;
}

/**
 * TinyBase-based notes hook
 * Provides the same API as the original useNotes hook
 * @param options.date - Optional date filter
 * @param options.projectId - Required project ID to filter notes by
 */
export function useNotesStore(options: UseNotesStoreOptions = {}) {
  const { date, projectId } = options;
  const { store, isReady } = useTinyBase();
  const [notes, setNotes] = useState<Note[]>([]);
  // Start as false since we load synchronously when store is ready
  const [loading, setLoading] = useState(!isReady);

  // Clear notes immediately when projectId changes to prevent showing stale data
  const [lastProjectId, setLastProjectId] = useState<string | null | undefined>(projectId);
  if (projectId !== lastProjectId) {
    setLastProjectId(projectId);
    setNotes([]);
    setLoading(true);
  }

  // Default date for creating new notes (today)
  const defaultDate = formatLocalDate(new Date());
  const effectiveDate = date || defaultDate;

  /**
   * Load notes from TinyBase store
   */
  const loadNotes = useCallback(() => {
    if (!store || !isReady) return;

    console.log('[useNotesStore] loadNotes called with projectId:', projectId);

    const notesTable = store.getTable('notes') || {};
    const actionsTable = store.getTable('note_actions') || {};

    // Convert to array and filter
    const notesList: Note[] = Object.entries(notesTable)
      .filter(([_, noteRow]) => {
        const row = noteRow as Record<string, unknown>;
        // Filter out soft-deleted notes
        if (row.deleted_at) return false;
        // Filter by date if provided
        if (date && row.date !== date) return false;
        // Filter by project if provided
        if (projectId !== undefined && row.project_id !== projectId) return false;
        return true;
      })
      .map(([id, noteRow]) => {
        const row = noteRow as Record<string, unknown>;

        // Find last postpone reason from actions table
        let lastPostponeReason: string | null = null;
        const postponeActions = Object.values(actionsTable)
          .filter((a) => {
            const action = a as Record<string, unknown>;
            return action.note_id === id && action.action_type === 'postponed';
          })
          .sort((a, b) => {
            const aTime = (a as Record<string, unknown>).created_at as string;
            const bTime = (b as Record<string, unknown>).created_at as string;
            return bTime.localeCompare(aTime);
          });

        if (postponeActions.length > 0) {
          lastPostponeReason = (postponeActions[0] as Record<string, unknown>).reason as string | null;
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
          deleted_reason: (row.deleted_reason as string) || null,
          assignee_id: (row.assignee_id as string) || null,
          project_id: (row.project_id as string) || null,
          last_postpone_reason: lastPostponeReason,
          remote_id: (row.remote_id as string) || null,
          sync_status: (row.sync_status as Note['sync_status']) || 'local',
          last_synced_at: (row.last_synced_at as string) || null,
          gcal_event_id: (row.gcal_event_id as string) || null,
        };
      })
      // Sort: pinned first, then by sort_order
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
        return a.sort_order - b.sort_order;
      });

    setNotes(notesList);
    setLoading(false);
  }, [store, isReady, date, projectId]);

  // Load notes when store is ready or date changes
  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Listen to store changes
  useEffect(() => {
    if (!store) return;

    const listenerId = store.addTableListener('notes', () => {
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
    async (
      content: string,
      category: NoteCategory = 'todo',
      description?: string | null,
      labelIds?: string[]
    ): Promise<Note> => {
      if (!store) throw new Error('Store not ready');

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

      const sortOrder = maxSortOrder + 1;

      store.setRow('notes', id, {
        date: effectiveDate,
        content,
        description: description || null,
        category,
        completed: false,
        completed_at: null,
        deadline: null,
        pinned: false,
        sort_order: sortOrder,
        assignee_id: null,
        project_id: projectId || null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        remote_id: null,
        sync_status: 'local',
        last_synced_at: null,
      });

      // Save initial version entry
      const versionId = generateId();
      store.setRow('note_versions', versionId, {
        note_id: id,
        content,
        description: description || null,
        category,
        completed: false,
        version_number: 1, // First version
        created_at: timestamp,
        remote_id: null,
        sync_status: 'local',
        last_synced_at: null,
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

      // Return the created note
      return {
        id,
        date: effectiveDate,
        content,
        description: description || null,
        category,
        completed: false,
        completed_at: null,
        deadline: null,
        pinned: false,
        sort_order: sortOrder,
        assignee_id: null,
        project_id: projectId || null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        deleted_reason: null,
      };
    },
    [store, effectiveDate, projectId]
  );

  /**
   * Create a note after a specific note (for keyboard navigation)
   */
  const createNoteAfter = useCallback(
    async (
      afterNoteId: string,
      category: NoteCategory = 'todo',
      deadline?: string | null,
      labelIds: string[] = [],
      assigneeId?: string | null
    ): Promise<Note> => {
      if (!store) throw new Error('Store not ready');

      const afterNote = store.getRow('notes', afterNoteId);
      const afterSortOrder = afterNote ? (afterNote.sort_order as number) || 0 : 0;

      // Find the next note's sort order
      const notesTable = store.getTable('notes') || {};
      const sameDateNotes = Object.entries(notesTable)
        .filter(([_, n]) => (n as Record<string, unknown>).date === effectiveDate)
        .map(([id, n]) => ({ id, sort_order: (n as Record<string, unknown>).sort_order as number }))
        .sort((a, b) => a.sort_order - b.sort_order);

      const afterIndex = sameDateNotes.findIndex((n) => n.id === afterNoteId);
      let newSortOrder: number;

      if (afterIndex >= 0 && afterIndex < sameDateNotes.length - 1) {
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
        content: '',
        description: null,
        category,
        completed: false,
        completed_at: null,
        deadline: deadline || null,
        pinned: false,
        sort_order: newSortOrder,
        assignee_id: assigneeId || null,
        project_id: projectId || null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        remote_id: null,
        sync_status: 'local',
        last_synced_at: null,
      });

      // Add labels to the note if provided
      for (const labelId of labelIds) {
        const noteLabelId = generateId();
        store.setRow('note_labels', noteLabelId, {
          note_id: id,
          label_id: labelId,
          created_at: timestamp,
        });
      }

      // Save initial version entry
      const versionId = generateId();
      store.setRow('note_versions', versionId, {
        note_id: id,
        content: '',
        description: null,
        category,
        completed: false,
        version_number: 1, // First version
        created_at: timestamp,
        remote_id: null,
        sync_status: 'local',
        last_synced_at: null,
      });

      // Return the created note
      return {
        id,
        date: effectiveDate,
        content: '',
        description: null,
        category,
        completed: false,
        completed_at: null,
        deadline: deadline || null,
        pinned: false,
        sort_order: newSortOrder,
        assignee_id: null,
        project_id: projectId || null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        deleted_reason: null,
      };
    },
    [store, effectiveDate, projectId]
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
      const updates: Record<string, string | number | boolean | null> = {
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

      store.setPartialRow('notes', id, updates as Record<string, string | number | boolean>);

      // Calculate next version number
      const versionsTable = store.getTable('note_versions') || {};
      const existingVersions = Object.values(versionsTable)
        .filter((v) => (v as Record<string, unknown>).note_id === id);
      const maxVersion = existingVersions.reduce(
        (max, v) => Math.max(max, (v as Record<string, unknown>).version_number as number),
        0
      );

      // Save version entry
      const versionId = generateId();
      store.setRow('note_versions', versionId, {
        note_id: id,
        content,
        description: description ?? (existingNote.description as string | null),
        category: category ?? (existingNote.category as NoteCategory),
        completed: existingNote.completed as boolean,
        version_number: maxVersion + 1,
        created_at: timestamp,
        remote_id: null,
        sync_status: 'local',
        last_synced_at: null,
      });

      // Cleanup old versions (keep max 50)
      cleanupOldVersions(store, id, 50);
    },
    [store]
  );

  /**
   * Delete a note (soft delete)
   */
  const deleteNote = useCallback(
    (id: string, reason: string): void => {
      if (!store) return;

      const timestamp = now();
      store.setPartialRow('notes', id, {
        deleted_at: timestamp,
        deleted_reason: reason,
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
        deleted_reason: null,
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

      // No history entry for completed/uncompleted actions (optimization)
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
   * Update note project
   */
  const updateProject = useCallback(
    (id: string, projectId: string | null): void => {
      if (!store) return;

      const timestamp = now();
      store.setPartialRow('notes', id, {
        project_id: projectId,
        updated_at: timestamp,
        sync_status: 'pending',
      });
    },
    [store]
  );

  /**
   * Postpone a note to a new deadline
   */
  const postponeNote = useCallback(
    (id: string, newDeadline: string, reason?: string): void => {
      if (!store) return;

      const existingNote = store.getRow('notes', id);
      if (!existingNote) return;

      const timestamp = now();
      const previousDeadline = existingNote.deadline as string | null;

      console.log('[postponeNote] Called with:', { id, newDeadline, reason });

      store.setPartialRow('notes', id, {
        deadline: newDeadline,
        updated_at: timestamp,
        sync_status: 'pending',
      });

      // Save lightweight action entry (no content/description for efficiency)
      const actionId = generateId();
      const actionEntry = {
        note_id: id,
        action_type: 'postponed' as const,
        reason: reason || null,
        previous_date: previousDeadline,
        new_date: newDeadline,
        created_at: timestamp,
        remote_id: null,
        sync_status: 'local' as const,
        last_synced_at: null,
      };
      console.log('[postponeNote] Saving action entry:', actionEntry);
      store.setRow('note_actions', actionId, actionEntry);

      // Verify it was saved
      const saved = store.getRow('note_actions', actionId);
      console.log('[postponeNote] Saved action entry:', saved);
    },
    [store]
  );

  /**
   * Reorder notes
   */
  const reorderNotes = useCallback(
    (orderedIds: string[]): void => {
      if (!store) return;

      const timestamp = now();

      orderedIds.forEach((noteId, index) => {
        store.setPartialRow('notes', noteId, {
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
    updateProject,
    toggleCompleted,
    togglePinned,
    deleteNote,
    restoreNote,
    reorderNotes,
    postponeNote,
  };
}
