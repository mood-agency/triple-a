/**
 * Feature Flags Configuration
 *
 * Controls which features are enabled in the application.
 * TinyBase migration uses these flags for gradual rollout.
 */

const STORAGE_PREFIX = 'ff_';

export interface FeatureFlags {
  /** Use TinyBase instead of sql.js for local storage */
  useTinyBase: boolean;
  /** Enable TinyBase sync with Supabase */
  tinyBaseSync: boolean;
  /** Show migration UI to users */
  showMigrationUI: boolean;
}

const DEFAULT_FLAGS: FeatureFlags = {
  useTinyBase: true,
  tinyBaseSync: true,
  showMigrationUI: false,
};

/**
 * Get all feature flags
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    useTinyBase: getFlag('useTinyBase'),
    tinyBaseSync: getFlag('tinyBaseSync'),
    showMigrationUI: getFlag('showMigrationUI'),
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

/**
 * Enable TinyBase (for migration)
 */
export function enableTinyBase(): void {
  setFlag('useTinyBase', true);
  setFlag('tinyBaseSync', true);
}

/**
 * Disable TinyBase (rollback)
 */
export function disableTinyBase(): void {
  setFlag('useTinyBase', false);
  setFlag('tinyBaseSync', false);
}

/**
 * Check if migration has been completed
 */
export function isMigrationComplete(): boolean {
  try {
    return localStorage.getItem('tinybase_migration_complete') === 'true';
  } catch {
    return false;
  }
}

/**
 * Mark migration as complete
 */
export function markMigrationComplete(): void {
  try {
    localStorage.setItem('tinybase_migration_complete', 'true');
    localStorage.setItem('tinybase_migration_date', new Date().toISOString());
  } catch (error) {
    console.error('[FeatureFlags] Failed to mark migration complete:', error);
  }
}

/**
 * Reset migration status (for testing/rollback)
 */
export function resetMigrationStatus(): void {
  try {
    localStorage.removeItem('tinybase_migration_complete');
    localStorage.removeItem('tinybase_migration_date');
  } catch (error) {
    console.error('[FeatureFlags] Failed to reset migration status:', error);
  }
}

/**
 * Hook-friendly feature flag check
 */
export function useTinyBaseEnabled(): boolean {
  return getFlag('useTinyBase');
}
