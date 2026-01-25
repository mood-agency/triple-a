/**
 * Feature Flags Configuration
 *
 * Controls which features are enabled in the application.
 */

const STORAGE_PREFIX = 'ff_';

export interface FeatureFlags {
  /** Enable TinyBase sync with Supabase */
  tinyBaseSync: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  tinyBaseSync: true,
};

/**
 * Get all feature flags
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    tinyBaseSync: getFlag('tinyBaseSync'),
  };
}

/**
 * Get a single feature flag value
 */
export function getFlag(key: keyof FeatureFlags): boolean {
  try {
    const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
    if (stored === null) {
      return DEFAULT_FLAGS[key];
    }
    return stored === 'true';
  } catch {
    return DEFAULT_FLAGS[key];
  }
}

/**
 * Set a feature flag value
 */
export function setFlag(key: keyof FeatureFlags, value: boolean): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, String(value));
  } catch (error) {
    console.error(`[FeatureFlags] Failed to set ${key}:`, error);
  }
}
