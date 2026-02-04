import { useLabelsContext } from '@/contexts/LabelsContext';

/**
 * Main hook for managing labels.
 * Uses LabelsContext to share state across all components (single fetch + subscription).
 */
export function useLabels() {
  return useLabelsContext();
}
