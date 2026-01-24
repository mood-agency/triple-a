import { getFlag } from '@/config/featureFlags';
import { useLabelsLegacy } from './legacy/useLabelsLegacy';
import { useLabelsStore } from './tinybase/useLabelsStore';

/**
 * Main hook for managing labels
 * Facade that selects between TinyBase and legacy sql.js implementation
 * based on feature flag
 */
export function useLabels() {
  const useTinyBase = getFlag('useTinyBase');

  // We need to call both hooks but only use one
  // This is a limitation of React's rules of hooks
  const legacyResult = useLabelsLegacy();
  const tinybaseResult = useLabelsStore();

  return useTinyBase ? tinybaseResult : legacyResult;
}
