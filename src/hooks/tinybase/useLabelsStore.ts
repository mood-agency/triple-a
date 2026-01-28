import { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import type { Label } from '@/types/note';
import { generateId, now } from '@/store/schema';

/**
 * TinyBase-based labels hook
 * Provides the same API as the original useLabels hook
 */
export function useLabelsStore() {
  const { store, isReady } = useTinyBase();
  const { t } = useTranslation();
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteLabelVersion, setNoteLabelVersion] = useState(0);

  /**
   * Load labels from TinyBase store
   */
  const loadLabels = useCallback(() => {
    if (!store || !isReady) return;

    const labelsTable = store.getTable('labels') || {};

    const labelsList: Label[] = Object.entries(labelsTable)
      .filter(([_, row]) => {
        // Filter out soft-deleted labels
        return !(row as Record<string, unknown>).deleted_at;
      })
      .map(([id, row]) => {
        const labelRow = row as Record<string, unknown>;
        return {
          id,
          name: labelRow.name as string,
          color: (labelRow.color as string) || '#6b7280',
          created_at: labelRow.created_at as string,
          updated_at: labelRow.updated_at as string,
          remote_id: (labelRow.remote_id as string) || null,
          sync_status: (labelRow.sync_status as Label['sync_status']) || 'local',
          last_synced_at: (labelRow.last_synced_at as string) || null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    setLabels(labelsList);
    setLoading(false);
  }, [store, isReady]);

  // Load labels when store is ready
  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  // Listen to store changes
  useEffect(() => {
    if (!store) return;

    const listenerId = store.addTableListener('labels', () => {
      loadLabels();
    });

    return () => {
      store.delListener(listenerId);
    };
  }, [store, loadLabels]);

  /**
   * Create a new label
   */
  const createLabel = useCallback(
    async (name: string, color: string = '#6b7280'): Promise<Label> => {
      if (!store) throw new Error('Store not ready');

      const id = generateId();
      const timestamp = now();

      const label: Label = {
        id,
        name,
        color,
        created_at: timestamp,
        updated_at: timestamp,
      };

      store.setRow('labels', id, {
        name,
        color,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        remote_id: null,
        sync_status: 'local',
        last_synced_at: null,
      });

      toast.success(t('toast.labelCreated'));
      return label;
    },
    [store, t]
  );

  /**
   * Update a label
   */
  const updateLabel = useCallback(
    async (id: string, name: string, color: string): Promise<Label> => {
      if (!store) throw new Error('Store not ready');

      const timestamp = now();

      store.setPartialRow('labels', id, {
        name,
        color,
        updated_at: timestamp,
        sync_status: 'pending',
      });

      // Bump version to invalidate caches that depend on label properties
      setNoteLabelVersion((v) => v + 1);

      toast.success(t('toast.labelUpdated'));
      return { id, name, color, created_at: '', updated_at: timestamp };
    },
    [store, t]
  );

  /**
   * Delete a label (soft delete)
   */
  const deleteLabel = useCallback(
    async (id: string): Promise<void> => {
      if (!store) throw new Error('Store not ready');

      const timestamp = now();

      // Soft delete the label
      store.setPartialRow('labels', id, {
        deleted_at: timestamp,
        updated_at: timestamp,
        sync_status: 'pending',
      });

      // Also remove all note_labels associations
      const noteLabelsTable = store.getTable('note_labels') || {};
      for (const [noteLabelId, row] of Object.entries(noteLabelsTable)) {
        if ((row as Record<string, unknown>).label_id === id) {
          store.delRow('note_labels', noteLabelId);
        }
      }

      toast.success(t('toast.labelDeleted'));
    },
    [store, t]
  );

  /**
   * Get labels for a specific note
   */
  const getLabelsForNote = useCallback(
    (noteId: string): Label[] => {
      if (!store || !isReady) return [];

      const noteLabelsTable = store.getTable('note_labels') || {};
      const labelsTable = store.getTable('labels') || {};

      // Find all label IDs for this note
      const labelIds = Object.values(noteLabelsTable)
        .filter((row) => (row as Record<string, unknown>).note_id === noteId)
        .map((row) => (row as Record<string, unknown>).label_id as string);

      // Get the actual labels
      return labelIds
        .map((labelId) => {
          const labelRow = labelsTable[labelId] as Record<string, unknown> | undefined;
          if (!labelRow || labelRow.deleted_at) return null;
          return {
            id: labelId,
            name: labelRow.name as string,
            color: (labelRow.color as string) || '#6b7280',
            created_at: labelRow.created_at as string,
            updated_at: labelRow.updated_at as string,
          };
        })
        .filter((label): label is Label => label !== null)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    [store, isReady]
  );

  /**
   * Add a label to a note
   */
  const addLabelToNote = useCallback(
    async (noteId: string, labelId: string): Promise<void> => {
      if (!store) throw new Error('Store not ready');

      const noteLabelId = `${noteId}-${labelId}`;
      const timestamp = now();

      // Check if already exists
      const existing = store.getRow('note_labels', noteLabelId);
      if (existing && Object.keys(existing).length > 0) return;

      store.setRow('note_labels', noteLabelId, {
        note_id: noteId,
        label_id: labelId,
        created_at: timestamp,
        sync_status: 'pending',
      });

      setNoteLabelVersion((v) => v + 1);
      toast.success(t('toast.labelAdded'));
    },
    [store, t]
  );

  /**
   * Remove a label from a note
   */
  const removeLabelFromNote = useCallback(
    async (noteId: string, labelId: string): Promise<void> => {
      if (!store) throw new Error('Store not ready');

      const noteLabelId = `${noteId}-${labelId}`;
      store.delRow('note_labels', noteLabelId);

      setNoteLabelVersion((v) => v + 1);
      toast.success(t('toast.labelRemoved'));
    },
    [store, t]
  );

  /**
   * Set all labels for a note (replaces existing)
   */
  const setLabelsForNote = useCallback(
    async (noteId: string, labelIds: string[]): Promise<void> => {
      if (!store) throw new Error('Store not ready');

      const timestamp = now();
      const noteLabelsTable = store.getTable('note_labels') || {};

      // Remove all existing labels for this note
      for (const [noteLabelId, row] of Object.entries(noteLabelsTable)) {
        if ((row as Record<string, unknown>).note_id === noteId) {
          store.delRow('note_labels', noteLabelId);
        }
      }

      // Add new labels
      for (const labelId of labelIds) {
        const noteLabelId = `${noteId}-${labelId}`;
        store.setRow('note_labels', noteLabelId, {
          note_id: noteId,
          label_id: labelId,
          created_at: timestamp,
          sync_status: 'pending',
        });
      }

      setNoteLabelVersion((v) => v + 1);
    },
    [store]
  );

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
