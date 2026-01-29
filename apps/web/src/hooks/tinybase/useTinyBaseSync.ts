import { useEffect, useRef, useCallback, useState } from 'react';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSettings } from '@/hooks/useSettings';
import { createSupabaseSync, SupabaseDataSync } from '@/store/persisters/supabaseSync';
import { supabase } from '@/lib/supabase';

const SYNC_INTERVAL = Number(import.meta.env.VITE_SYNC_INTERVAL_MS) || 5 * 60 * 1000;
const SYNC_DEBOUNCE = Number(import.meta.env.VITE_SYNC_DEBOUNCE_MS) || 2000;

interface SyncState {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
}

/**
 * Hook for managing TinyBase sync with Supabase
 */
export function useTinyBaseSync() {
  const { store, isReady } = useTinyBase();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const { settings } = useSettings();

  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
  });

  const syncServiceRef = useRef<SupabaseDataSync | null>(null);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSyncDoneRef = useRef(false);

  // Initialize sync service
  useEffect(() => {
    if (!store || !isReady || !user) {
      syncServiceRef.current = null;
      return;
    }

    syncServiceRef.current = createSupabaseSync(store, {
      userId: user.id,
      onError: (error, table) => {
        console.error(`[TinyBaseSync] Error syncing ${table}:`, error);
        setSyncState((prev) => ({ ...prev, error: error.message }));
      },
    });

    // Get initial sync state
    const status = syncServiceRef.current.getSyncStatus();
    setSyncState((prev) => ({ ...prev, lastSyncedAt: status.lastSyncedAt }));
  }, [store, isReady, user]);

  // Sync function
  const syncNow = useCallback(async () => {
    if (!syncServiceRef.current || !isOnline || syncState.isSyncing) {
      return;
    }

    if (!syncServiceRef.current.isAvailable()) {
      console.log('[TinyBaseSync] Sync not available (no Supabase or user)');
      return;
    }

    setSyncState((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      console.log('[TinyBaseSync] Starting sync...');
      await syncServiceRef.current.sync();

      const status = syncServiceRef.current.getSyncStatus();
      setSyncState({
        isSyncing: false,
        lastSyncedAt: status.lastSyncedAt,
        error: null,
      });
      console.log('[TinyBaseSync] Sync completed');
    } catch (error) {
      console.error('[TinyBaseSync] Sync error:', error);
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  }, [isOnline, syncState.isSyncing]);

  // Debounced sync
  const debouncedSync = useCallback(() => {
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current);
    }
    syncDebounceRef.current = setTimeout(() => {
      syncNow();
    }, SYNC_DEBOUNCE);
  }, [syncNow]);

  // Pull all from Supabase
  const pullAll = useCallback(async () => {
    if (!syncServiceRef.current || !isOnline) {
      return { success: false, error: 'Not connected' };
    }

    setSyncState((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      await syncServiceRef.current.pullAll();
      const status = syncServiceRef.current.getSyncStatus();
      setSyncState({
        isSyncing: false,
        lastSyncedAt: status.lastSyncedAt,
        error: null,
      });
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        error: errorMsg,
      }));
      return { success: false, error: errorMsg };
    }
  }, [isOnline]);

  // Push all to Supabase
  const pushAll = useCallback(async () => {
    if (!syncServiceRef.current || !isOnline) {
      return { success: false, error: 'Not connected' };
    }

    setSyncState((prev) => ({ ...prev, isSyncing: true, error: null }));

    try {
      await syncServiceRef.current.pushAll();
      const status = syncServiceRef.current.getSyncStatus();
      setSyncState({
        isSyncing: false,
        lastSyncedAt: status.lastSyncedAt,
        error: null,
      });
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        error: errorMsg,
      }));
      return { success: false, error: errorMsg };
    }
  }, [isOnline]);

  // Initial sync and periodic sync
  useEffect(() => {
    if (!user || !isOnline || !syncServiceRef.current || !settings.autoSync) {
      return;
    }

    // Initial sync
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true;
      syncNow();
    }

    // Periodic sync
    syncIntervalRef.current = setInterval(() => {
      if (!syncState.isSyncing) {
        syncNow();
      }
    }, SYNC_INTERVAL);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [user, isOnline, syncNow, settings.autoSync, syncState.isSyncing]);

  // Listen to store changes and trigger sync
  useEffect(() => {
    if (!store || !settings.autoSync || !isOnline) return;

    const listenerId = store.addTablesListener(() => {
      debouncedSync();
    });

    return () => {
      store.delListener(listenerId);
    };
  }, [store, settings.autoSync, isOnline, debouncedSync]);

  // Realtime subscriptions for remote changes
  useEffect(() => {
    if (!supabase || !user || !settings.autoSync) return;

    const channel = supabase
      .channel('tinybase-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          debouncedSync();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'labels',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          debouncedSync();
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, debouncedSync, settings.autoSync]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, []);

  return {
    ...syncState,
    syncNow,
    pullAll,
    pushAll,
    isAvailable: syncServiceRef.current?.isAvailable() ?? false,
  };
}
