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
      setVersions(prev => prev.length > 0 ? [] : prev);
      return;
    }

    const versionsTable = store.getTable('note_versions') || {};
    
    const versionsList: NoteVersion[] = Object.entries(versionsTable)
      .filter(([, v]) => (v as Record<string, unknown>).note_id === noteId)
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

    setVersions(prev => {
      // Simple equality check to avoid unnecessary re-renders
      if (prev.length === versionsList.length && 
          prev.every((v, i) => v.id === versionsList[i].id && v.version_number === versionsList[i].version_number)) {
        return prev;
      }
      return versionsList;
    });
  }, [store, storeReady, noteId]);

  /**
   * Load action history for the note
   */
  const loadActions = useCallback(() => {
    if (!store || !storeReady || !noteId) {
      setActions(prev => prev.length > 0 ? [] : prev);
      return;
    }

    const actionsTable = store.getTable('note_actions') || {};

    const actionsList: NoteAction[] = Object.entries(actionsTable)
      .filter(([, a]) => (a as Record<string, unknown>).note_id === noteId)
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
        return action;
      })
      .sort((a, b) => b.created_at.localeCompare(a.created_at)); // Newest first

    setActions(prev => {
      // Simple equality check to avoid unnecessary re-renders
      if (prev.length === actionsList.length && 
          prev.every((a, i) => a.id === actionsList[i].id && a.created_at === actionsList[i].created_at)) {
        return prev;
      }
      return actionsList;
    });
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

  // Listen for TinyBase store changes to both tables (debounced to avoid blocking main thread)
  useEffect(() => {
    if (!store || !noteId) return;

    let versionsTimer: ReturnType<typeof setTimeout> | null = null;
    let actionsTimer: ReturnType<typeof setTimeout> | null = null;

    const listener1 = store.addTableListener('note_versions', () => {
      if (versionsTimer) clearTimeout(versionsTimer);
      versionsTimer = setTimeout(() => loadVersions(), 200);
    });

    const listener2 = store.addTableListener('note_actions', () => {
      if (actionsTimer) clearTimeout(actionsTimer);
      actionsTimer = setTimeout(() => loadActions(), 200);
    });

    return () => {
      if (versionsTimer) clearTimeout(versionsTimer);
      if (actionsTimer) clearTimeout(actionsTimer);
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
