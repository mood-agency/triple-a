import { useState, useCallback, useEffect, useRef } from 'react';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import type { NoteVersion, NoteAction, NoteCategory } from '@/types/note';

/**
 * Hook for managing note versions and actions
 * Replaces useNoteHistory with separate queries for versions and actions
 */
export function useNoteVersionsAndActions(noteId: string | null) {
  const { store, isReady: storeReady } = useTinyBase();

  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [actions, setActions] = useState<NoteAction[]>([]);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Load version history for the note
   */
  const loadVersions = useCallback(() => {
    if (!store || !storeReady || !noteId) {
      setVersions([]);
      return;
    }

    const versionsTable = store.getTable('note_versions') || {};
    console.log('[useNoteVersionsAndActions] Total versions in note_versions:', Object.keys(versionsTable).length);

    const filteredVersions = Object.entries(versionsTable)
      .filter(([, v]) => (v as Record<string, unknown>).note_id === noteId);

    console.log('[useNoteVersionsAndActions] Versions for noteId', noteId, ':', filteredVersions.length);

    const versionsList: NoteVersion[] = filteredVersions
      .map(([id, v]) => {
        const row = v as Record<string, unknown>;
        return {
          id,
          note_id: row.note_id as string,
          content: row.content as string,
          description: (row.description as string) || null,
          category: row.category as NoteCategory,
          completed: Boolean(row.completed),
          version_number: row.version_number as number,
          created_at: row.created_at as string,
        };
      })
      .sort((a, b) => b.version_number - a.version_number); // Newest first

    console.log('[useNoteVersionsAndActions] Loaded versions:', versionsList.length);
    setVersions(versionsList);
  }, [store, storeReady, noteId]);

  /**
   * Load action history for the note
   */
  const loadActions = useCallback(() => {
    if (!store || !storeReady || !noteId) {
      setActions([]);
      return;
    }

    const actionsTable = store.getTable('note_actions') || {};
    console.log('[useNoteVersionsAndActions] Total actions in note_actions:', Object.keys(actionsTable).length);

    const filteredActions = Object.entries(actionsTable)
      .filter(([, a]) => (a as Record<string, unknown>).note_id === noteId);

    console.log('[useNoteVersionsAndActions] Actions for noteId', noteId, ':', filteredActions.length);

    const actionsList: NoteAction[] = filteredActions
      .map(([id, a]) => {
        const row = a as Record<string, unknown>;
        const action: NoteAction = {
          id,
          note_id: row.note_id as string,
          action_type: row.action_type as 'postponed',
          reason: (row.reason as string) || null,
          previous_date: (row.previous_date as string) || null,
          new_date: (row.new_date as string) || null,
          created_at: row.created_at as string,
        };
        console.log('[useNoteVersionsAndActions] Action:', action.id, 'type:', action.action_type, 'reason:', action.reason);
        return action;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at)); // Newest first

    console.log('[useNoteVersionsAndActions] Loaded actions:', actionsList.length);
    console.log('[useNoteVersionsAndActions] Postpone actions:', actionsList.filter(a => a.action_type === 'postponed').length);
    setActions(actionsList);
  }, [store, storeReady, noteId]);

  /**
   * Delete an action entry
   */
  const deleteAction = useCallback(
    async (actionId: string) => {
      if (!store || !storeReady) return;
      store.delRow('note_actions', actionId);
      loadActions(); // Reload after deletion
    },
    [store, storeReady, loadActions]
  );

  /**
   * Update the reason for a postpone action
   */
  const updateReason = useCallback(
    async (actionId: string, newReason: string) => {
      if (!store || !storeReady) return;
      store.setPartialRow('note_actions', actionId, { reason: newReason });
      loadActions(); // Reload after update
    },
    [store, storeReady, loadActions]
  );

  // PERFORMANCE: Debounce loading to avoid blocking click interactions
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    if (!noteId) {
      setVersions([]);
      setActions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    timeoutRef.current = setTimeout(() => {
      loadVersions();
      loadActions();
      setLoading(false);
    }, 50);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [noteId, loadVersions, loadActions]);

  // Listen for TinyBase store changes to both tables
  useEffect(() => {
    if (!store || !noteId) return;

    const listener1 = store.addTableListener('note_versions', () => {
      loadVersions();
    });

    const listener2 = store.addTableListener('note_actions', () => {
      loadActions();
    });

    return () => {
      store.delListener(listener1);
      store.delListener(listener2);
    };
  }, [store, noteId, loadVersions, loadActions]);

  return {
    versions,
    actions,
    postponeActions: actions, // All actions are postpone actions
    loading,
    reload: useCallback(() => {
      loadVersions();
      loadActions();
    }, [loadVersions, loadActions]),
    deleteAction,
    updateReason,
  };
}
