import { useCallback } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useSync } from '@/contexts/SyncContext';
import { persistDatabase } from '@/db';

/**
 * Hook for managing note ordering (reorder, drag-and-drop)
 */
export function useNoteReorder(loadNotes: () => void) {
  const { db } = useDatabase();
  const { queueOperation } = useSync();

  /**
   * Reorder notes based on an array of IDs
   */
  const reorderNotes = useCallback(
    async (orderedIds: string[]): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Update sort_order for each note based on its position in the array
      for (const [index, id] of orderedIds.entries()) {
        db.run('UPDATE notes SET sort_order = ?, updated_at = ? WHERE id = ?', [index, now, id]);
        await queueOperation('notes', 'update', id, {
          sort_order: index,
          updated_at: now,
        });
      }

      await persistDatabase();
      loadNotes();
    },
    [db, loadNotes, queueOperation]
  );

  return {
    reorderNotes,
  };
}
