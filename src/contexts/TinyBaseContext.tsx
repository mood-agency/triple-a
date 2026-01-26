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

          // Debug: Expose store to window for debugging
          if (typeof window !== 'undefined') {
            (window as unknown as { __tinybase_debug__: unknown }).__tinybase_debug__ = {
              store: appStore,
              getNotes: () => {
                const notes = appStore.getTable('notes');
                console.table(Object.entries(notes).map(([id, note]) => ({
                  id,
                  content: (note.content as string)?.substring(0, 50),
                  category: note.category,
                  date: note.date,
                  deadline: note.deadline,
                  gcal_event_id: note.gcal_event_id,
                  deleted_at: note.deleted_at,
                  sync_status: note.sync_status,
                })));
                return notes;
              },
              getMeetings: () => {
                const notes = appStore.getTable('notes');
                const meetings = Object.entries(notes).filter(([, note]) => note.category === 'meeting');
                console.table(meetings.map(([id, note]) => ({
                  id,
                  content: (note.content as string)?.substring(0, 50),
                  date: note.date,
                  deadline: note.deadline,
                  gcal_event_id: note.gcal_event_id,
                  deleted_at: note.deleted_at,
                })));
                return Object.fromEntries(meetings);
              },
              getNote: (id: string) => appStore.getRow('notes', id),
              getAllTables: () => ({
                notes: Object.keys(appStore.getTable('notes')).length,
                labels: Object.keys(appStore.getTable('labels')).length,
                contacts: Object.keys(appStore.getTable('contacts')).length,
                projects: Object.keys(appStore.getTable('projects')).length,
              }),
            };
            console.log('TinyBase debug available: window.__tinybase_debug__');
            console.log('Commands: getNotes(), getMeetings(), getNote(id), getAllTables()');
          }
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
