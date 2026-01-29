import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Label } from '@/types/note';

/**
 * Supabase-direct labels hook
 * Provides the same API as useLabelsStore but queries Supabase directly
 */
export function useLabelsSupabase() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteLabelVersion, setNoteLabelVersion] = useState(0);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  // Cache for note-label relationships
  const [noteLabelsMap, setNoteLabelsMap] = useState<Record<string, string[]>>({});

  /**
   * Fetch labels and note_labels from Supabase
   */
  const fetchLabels = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    // Fetch labels and note_labels in parallel
    const [labelsResult, noteLabelsResult] = await Promise.all([
      supabase
        .from('labels')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('name'),
      supabase
        .from('note_labels')
        .select('note_id, label_id'),
    ]);

    if (labelsResult.error) {
      console.error('[useLabelsSupabase] Fetch labels error:', labelsResult.error);
      setLoading(false);
      return;
    }

    if (noteLabelsResult.error) {
      console.error('[useLabelsSupabase] Fetch note_labels error:', noteLabelsResult.error);
    }

    const labelsList: Label[] = (labelsResult.data || []).map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color || '#6b7280',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      remote_id: row.id,
      sync_status: 'synced' as const,
      last_synced_at: row.updated_at || null,
    }));

    // Build note-labels map
    const newNoteLabelsMap: Record<string, string[]> = {};
    if (noteLabelsResult.data) {
      for (const row of noteLabelsResult.data) {
        if (!newNoteLabelsMap[row.note_id]) {
          newNoteLabelsMap[row.note_id] = [];
        }
        newNoteLabelsMap[row.note_id].push(row.label_id);
      }
    }

    setLabels(labelsList);
    setNoteLabelsMap(newNoteLabelsMap);
    setLoading(false);
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchLabels();
  }, [fetchLabels]);

  // Realtime subscription for labels and note_labels
  useEffect(() => {
    if (!user || !supabase) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`labels-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'labels',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchLabels()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_labels',
        },
        () => fetchLabels()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, fetchLabels]);

  /**
   * Create a new label
   */
  const createLabel = useCallback(
    async (name: string, color: string = '#6b7280'): Promise<Label> => {
      if (!user || !supabase) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('labels')
        .insert({
          user_id: user.id,
          name,
          color,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(t('toast.labelCreated'));

      return {
        id: data.id,
        name: data.name,
        color: data.color,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        remote_id: data.id,
        sync_status: 'synced',
      };
    },
    [user, t]
  );

  /**
   * Update a label
   */
  const updateLabel = useCallback(
    async (id: string, name: string, color: string): Promise<Label> => {
      if (!supabase) throw new Error('Supabase not configured');

      const { data, error } = await supabase
        .from('labels')
        .update({ name, color })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setNoteLabelVersion((v) => v + 1);
      toast.success(t('toast.labelUpdated'));

      return {
        id: data.id,
        name: data.name,
        color: data.color,
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
      };
    },
    [t]
  );

  /**
   * Delete a label (soft delete)
   */
  const deleteLabel = useCallback(
    async (id: string): Promise<void> => {
      if (!supabase) throw new Error('Supabase not configured');

      const { error } = await supabase
        .from('labels')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Remove note_labels associations
      await supabase.from('note_labels').delete().eq('label_id', id);

      toast.success(t('toast.labelDeleted'));
    },
    [t]
  );

  /**
   * Get labels for a specific note (uses cached note_labels map)
   */
  const getLabelsForNote = useCallback(
    (noteId: string): Label[] => {
      const labelIds = noteLabelsMap[noteId] || [];
      return labels
        .filter((label) => labelIds.includes(label.id))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [noteLabelsMap, labels]
  );

  /**
   * Add a label to a note
   */
  const addLabelToNote = useCallback(
    async (noteId: string, labelId: string): Promise<void> => {
      if (!supabase || !user) throw new Error('Supabase not configured');

      // Check if already exists locally
      const existingIds = noteLabelsMap[noteId] || [];
      if (existingIds.includes(labelId)) return;

      const { error } = await supabase.from('note_labels').insert({
        note_id: noteId,
        label_id: labelId,
        user_id: user.id,
      });

      if (error) throw error;

      // Update local cache
      setNoteLabelsMap((prev) => ({
        ...prev,
        [noteId]: [...(prev[noteId] || []), labelId],
      }));

      setNoteLabelVersion((v) => v + 1);
      toast.success(t('toast.labelAdded'));
    },
    [t, noteLabelsMap, user]
  );

  /**
   * Remove a label from a note
   */
  const removeLabelFromNote = useCallback(
    async (noteId: string, labelId: string): Promise<void> => {
      if (!supabase) throw new Error('Supabase not configured');

      const { error } = await supabase
        .from('note_labels')
        .delete()
        .eq('note_id', noteId)
        .eq('label_id', labelId);

      if (error) throw error;

      // Update local cache
      setNoteLabelsMap((prev) => ({
        ...prev,
        [noteId]: (prev[noteId] || []).filter((id) => id !== labelId),
      }));

      setNoteLabelVersion((v) => v + 1);
      toast.success(t('toast.labelRemoved'));
    },
    [t]
  );

  /**
   * Set all labels for a note (replaces existing)
   */
  const setLabelsForNote = useCallback(async (noteId: string, labelIds: string[]): Promise<void> => {
    if (!supabase || !user) throw new Error('Supabase not configured');

    // Remove all existing
    await supabase.from('note_labels').delete().eq('note_id', noteId);

    // Add new ones
    if (labelIds.length > 0) {
      const inserts = labelIds.map((labelId) => ({
        note_id: noteId,
        label_id: labelId,
        user_id: user.id,
      }));
      await supabase.from('note_labels').insert(inserts);
    }

    // Update local cache
    setNoteLabelsMap((prev) => ({
      ...prev,
      [noteId]: labelIds,
    }));

    setNoteLabelVersion((v) => v + 1);
  }, [user]);

  return {
    labels,
    loading,
    noteLabelVersion,
    createLabel,
    updateLabel,
    deleteLabel,
    getLabelsForNote,
    addLabelToNote,
    removeLabelFromNote,
    setLabelsForNote,
  };
}
