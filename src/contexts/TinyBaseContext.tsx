import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { MergeableStore } from 'tinybase';
import { createAppStore } from '@/store/schema';
import { createIndexedDbPersister, type AppPersister } from '@/store/persisters/indexedDbPersister';

interface TinyBaseContextType {
  store: MergeableStore | null;
  persister: AppPersister | null;
  isReady: boolean;
  error: Error | null;
}

const TinyBaseContext = createContext<TinyBaseContextType | null>(null);

interface TinyBaseProviderProps {
  children: ReactNode;
}

export function TinyBaseProvider({ children }: TinyBaseProviderProps) {
  const [store, setStore] = useState<MergeableStore | null>(null);
  const [persister, setPersister] = useState<AppPersister | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {

    let mounted = true;
    let appPersister: AppPersister | null = null;

    const initStore = async () => {
      try {
        // Create the MergeableStore
        const appStore = createAppStore();

        // Create and start the IndexedDB persister
        appPersister = createIndexedDbPersister(appStore);

        // Load existing data from IndexedDB
        await appPersister.load();

        // Start auto-save (saves on every change)
        await appPersister.startAutoSave();

        if (mounted) {
          setStore(appStore);
          setPersister(appPersister);
          setIsReady(true);
        }
      } catch (err) {
        console.error('[TinyBase] Initialization error:', err);
        if (mounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    };

    initStore();

    return () => {
      mounted = false;
      // Clean up persister
      if (appPersister) {
        appPersister.stopAutoSave();
        appPersister.destroy();
      }
    };
  }, []);

  return (
    <TinyBaseContext.Provider value={{ store, persister, isReady, error }}>
      {children}
    </TinyBaseContext.Provider>
  );
}

export function useTinyBase() {
  const context = useContext(TinyBaseContext);
  if (!context) {
    throw new Error('useTinyBase must be used within TinyBaseProvider');
  }
  return context;
}
