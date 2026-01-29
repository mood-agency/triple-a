import { useLabelsStore } from './tinybase/useLabelsStore';

/**
 * Main hook for managing labels
 */
export function useLabels() {
  return useLabelsStore();
}
