import { useLabelsConvex, useNoteLabels } from './convex/useLabelsConvex';

/**
 * Main hook for managing labels
 */
export function useLabels() {
  return useLabelsConvex();
}

// Re-export useNoteLabels for direct label queries per note
export { useNoteLabels };
