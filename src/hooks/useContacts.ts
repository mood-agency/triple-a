import { getFlag } from '@/config/featureFlags';
import { useContactsLegacy } from './legacy/useContactsLegacy';
import { useContactsStore } from './tinybase/useContactsStore';

/**
 * Main hook for managing contacts
 * Facade that selects between TinyBase and legacy sql.js implementation
 * based on feature flag
 */
export function useContacts() {
  const useTinyBase = getFlag('useTinyBase');

  // We need to call both hooks but only use one
  // This is a limitation of React's rules of hooks
  const legacyResult = useContactsLegacy();
  const tinybaseResult = useContactsStore();

  return useTinyBase ? tinybaseResult : legacyResult;
}
