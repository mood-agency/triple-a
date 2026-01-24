import { getFlag } from '@/config/featureFlags';
import { useNotesLegacy } from './legacy/useNotesLegacy';
import { useNotesStore } from './tinybase/useNotesStore';

/**
 * Main hook for managing notes
 * Facade that selects between TinyBase and legacy sql.js implementation
 * based on feature flag
 */
export function useNotes(date?: string) {
  const useTinyBase = getFlag('useTinyBase');

  // We need to call both hooks but only use one
  // This is a limitation of React's rules of hooks
  const legacyResult = useNotesLegacy(date);
  const tinybaseResult = useNotesStore(date);

  return useTinyBase ? tinybaseResult : legacyResult;
}
