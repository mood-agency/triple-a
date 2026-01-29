import { createCustomPersister } from 'tinybase/persisters';
import type { MergeableStore } from 'tinybase';

const DB_NAME = 'triple-a-tinybase';
const DB_VERSION = 1;
const STORE_NAME = 'tinybase-store';
const STORE_KEY = 'content';

export interface AppPersister {
  load: () => Promise<void>;
  save: () => Promise<void>;
  startAutoSave: () => Promise<void>;
  stopAutoSave: () => void;
  destroy: () => void;
}

/**
 * Creates a custom IndexedDB persister for TinyBase MergeableStore
 * Stores the entire store content as a single JSON blob
 */
export function createIndexedDbPersister(store: MergeableStore): AppPersister {
  let db: IDBDatabase | null = null;
  let autoSaveListenerId: string | null = null;

  /**
   * Open or create the IndexedDB database
   */
  const openDb = (): Promise<IDBDatabase> => {
    if (db) return Promise.resolve(db);

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[IndexedDbPersister] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        db = request.result;
        resolve(db);
      };

      request.onupgradeneeded = (event) => {
        const database = (event.target as IDBOpenDBRequest).result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };
    });
  };

  /**
   * Get persisted content from IndexedDB
   */
  const getPersisted = async (): Promise<[Tables: unknown, Values: unknown] | undefined> => {
    try {
      const database = await openDb();
      return new Promise((resolve) => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const objectStore = tx.objectStore(STORE_NAME);
        const request = objectStore.get(STORE_KEY);

        request.onsuccess = () => {
          const content = request.result;
          if (content && Array.isArray(content) && content.length === 2) {
            resolve(content as [unknown, unknown]);
          } else {
            resolve(undefined);
          }
        };

        request.onerror = () => {
          console.error('[IndexedDbPersister] Failed to read:', request.error);
          resolve(undefined);
        };
      });
    } catch (error) {
      console.error('[IndexedDbPersister] Error getting persisted data:', error);
      return undefined;
    }
  };

  /**
   * Set persisted content to IndexedDB
   */
  const setPersisted = async (
    getContent: () => [Tables: unknown, Values: unknown]
  ): Promise<void> => {
    try {
      const database = await openDb();
      const content = getContent();

      return new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        const objectStore = tx.objectStore(STORE_NAME);
        const request = objectStore.put(content, STORE_KEY);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          console.error('[IndexedDbPersister] Failed to write:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('[IndexedDbPersister] Error setting persisted data:', error);
      throw error;
    }
  };

  // Create the base persister using TinyBase's createCustomPersister
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const basePersister = createCustomPersister(
    store,
    getPersisted as any,
    setPersisted as any,
    // addPersisterListener - not used, we rely on store listeners
    (_listener) => {
      // Return a handle that can be used to remove the listener
      const handle = setInterval(() => {
        // This is a fallback polling mechanism
        // In practice, we use store listeners instead
      }, 60000); // Check every minute as a fallback
      return handle;
    },
    // delPersisterListener
    (handle) => {
      if (handle) {
        clearInterval(handle as ReturnType<typeof setInterval>);
      }
    },
    // onIgnoredError
    (error) => {
      console.error('[IndexedDbPersister] Ignored error:', error);
    },
    // persist mode: 3 = both Tables and Values for MergeableStore
    3
  ) as unknown as AppPersister;

  // Enhance with custom methods
  const enhancedPersister: AppPersister = {
    ...basePersister,

    load: async () => {
      const content = await getPersisted();
      if (content) {
        const [tables, values] = content;
        if (tables && typeof tables === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          store.setTables(tables as any);
        }
        if (values && typeof values === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          store.setValues(values as any);
        }
      }
    },

    save: async () => {
      await setPersisted(() => [store.getTables(), store.getValues()]);
    },

    startAutoSave: async () => {
      let saveTimer: ReturnType<typeof setTimeout> | null = null;
      const debouncedSave = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          setPersisted(() => [store.getTables(), store.getValues()]).catch((err) => {
            console.error('[IndexedDbPersister] Auto-save failed:', err);
          });
        }, 200);
      };

      // Listen to all table changes (debounced)
      autoSaveListenerId = store.addTablesListener(debouncedSave);

      // Also listen to values changes (debounced)
      store.addValuesListener(debouncedSave);
    },

    stopAutoSave: () => {
      if (autoSaveListenerId) {
        store.delListener(autoSaveListenerId);
        autoSaveListenerId = null;
      }
    },

    destroy: () => {
      enhancedPersister.stopAutoSave();
      if (db) {
        db.close();
        db = null;
      }
    },
  };

  return enhancedPersister;
}
