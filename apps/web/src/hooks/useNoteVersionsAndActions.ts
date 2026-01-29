import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { NoteVersion, NoteAction, NoteCategory } from '@/types/note';

/**
 * Hook for managing note versions and actions
 * Uses Supabase for fetching and managing history data
 */
export function useNoteVersionsAndActions(noteId: string | null) {
  const { user } = useAuth();

  const [versions, setVersions] = useState<NoteVersion[]>([]);
  const [actions, setActions] = useState<NoteAction[]>([]);
  const [loading, setLoading] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Load version history for the note
   */
  const loadVersions = useCallback(async () => {
    if (!supabase || !user || !noteId) {
      setVersions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('note_versions')
        .select('*')
        .eq('note_id', noteId)
        .order('version_number', { ascending: false });

      if (error) {
        console.error('[useNoteVersionsAndActions] Error loading versions:', error);
        setVersions([]);
        return;
      }

      const versionsList: NoteVersion[] = (data || []).map((row) => ({
        id: row.id,
        note_id: row.note_id,
        content: row.content,
        description: row.description || null,
        category: row.category as NoteCategory,
        completed: Boolean(row.completed),
        version_number: row.version_number,
        created_at: row.created_at,
      }));

      setVersions(versionsList);
    } catch (err) {
      console.error('[useNoteVersionsAndActions] Unexpected error loading versions:', err);
      setVersions([]);
    }
  }, [user, noteId]);

  /**
   * Load action history for the note
   */
  const loadActions = useCallback(async () => {
    if (!supabase || !user || !noteId) {
      setActions([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('note_actions')
        .select('*')
        .eq('note_id', noteId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useNoteVersionsAndActions] Error loading actions:', error);
        setActions([]);
        return;
      }

      const actionsList: NoteAction[] = (data || []).map((row) => ({
        id: row.id,
        note_id: row.note_id,
        action_type: row.action_type as 'postponed',
        reason: row.reason || null,
        previous_date: row.previous_date || null,
        new_date: row.new_date || null,
        created_at: row.created_at,
      }));

      setActions(actionsList);
    } catch (err) {
      console.error('[useNoteVersionsAndActions] Unexpected error loading actions:', err);
      setActions([]);
    }
  }, [user, noteId]);

  /**
   * Delete an action entry
   */
  const deleteAction = useCallback(
    async (actionId: string) => {
      if (!supabase || !user) return;

      const { error } = await supabase
        .from('note_actions')
        .delete()
        .eq('id', actionId);

      if (error) {
        console.error('[useNoteVersionsAndActions] Error deleting action:', error);
        return;
      }

      loadActions();
    },
    [user, loadActions]
  );

  /**
   * Update the reason for a postpone action
   */
  const updateReason = useCallback(
    async (actionId: string, newReason: string) => {
      if (!supabase || !user) return;

      const { error } = await supabase
        .from('note_actions')
        .update({ reason: newReason })
        .eq('id', actionId);

      if (error) {
        console.error('[useNoteVersionsAndActions] Error updating reason:', error);
        return;
      }

      loadActions();
    },
    [user, loadActions]
  );

  // Debounce loading
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
    timeoutRef.current = setTimeout(async () => {
      await Promise.all([loadVersions(), loadActions()]);
      setLoading(false);
    }, 50);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [noteId, loadVersions, loadActions]);

  // Realtime subscriptions
  useEffect(() => {
    if (!supabase || !user || !noteId) return;

    const versionsChannel = supabase
      .channel(`note-versions-${noteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_versions',
          filter: `note_id=eq.${noteId}`,
        },
        () => {
          loadVersions();
        }
      )
      .subscribe();

    const actionsChannel = supabase
      .channel(`note-actions-${noteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_actions',
          filter: `note_id=eq.${noteId}`,
        },
        () => {
          loadActions();
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(versionsChannel);
        supabase.removeChannel(actionsChannel);
      }
    };
  }, [user, noteId, loadVersions, loadActions]);

  return {
    versions,
    actions,
    postponeActions: actions, // All actions are postpone actions
    loading,
    reload: useCallback(async () => {
      await Promise.all([loadVersions(), loadActions()]);
    }, [loadVersions, loadActions]),
    deleteAction,
    updateReason,
  };
}
