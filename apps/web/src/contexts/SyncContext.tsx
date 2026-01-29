import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSettings } from '@/hooks/useSettings';
import { supabase } from '@/lib/supabase';
import { useTinyBase } from './TinyBaseContext';
import { SyncService } from '@/services/sync';
import type { SyncConflict, ConflictResolution, SyncProgress } from '@/services/sync';
import i18n from '@/i18n';

export type SyncConnectionStatus = 'online' | 'offline' | 'connecting';
export type SyncState = 'idle' | 'syncing' | 'error';

interface PushAllProgress {
  current: number;
  total: number;
  item: string;
}

interface PushAllResult {
  success: boolean;
  error?: string;
}

interface PullAllResult {
  success: boolean;
  error?: string;
}

interface SyncContextType {
  connectionStatus: SyncConnectionStatus;
  syncState: SyncState;
  lastSyncedAt: string | null;
  pendingCount: number;
  error: string | null;
  conflicts: SyncConflict[];
  syncNow: () => Promise<void>;
  pushAllToSupabase: (onProgress?: (progress: PushAllProgress) => void) => Promise<PushAllResult>;
  pullAllFromSupabase: (onProgress?: (progress: PushAllProgress) => void) => Promise<PullAllResult>;
  resolveConflict: (conflictId: string, resolution: ConflictResolution) => void;
  isPushingAll: boolean;
  isPullingAll: boolean;
  retryQueueLength: number;
}

const SyncContext = createContext<SyncContextType | null>(null);

const SYNC_INTERVAL = Number(import.meta.env.VITE_SYNC_INTERVAL_MS) || 5 * 60 * 1000;
const SYNC_DEBOUNCE = Number(import.meta.env.VITE_SYNC_DEBOUNCE_MS) || 2000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const { settings } = useSettings();
  const { store } = useTinyBase();

  const [connectionStatus, setConnectionStatus] = useState<SyncConnectionStatus>('offline');
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [retryQueueLength, setRetryQueueLength] = useState(0);

  const [isPushingAll, setIsPushingAll] = useState(false);
  const [isPullingAll, setIsPullingAll] = useState(false);

  const prevOnlineRef = useRef<boolean | null>(null);
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSyncDoneRef = useRef(false);

  // Initialize SyncService when user and store are ready
  useEffect(() => {
    if (!user || !store) {
      SyncService.destroy();
      initialSyncDoneRef.current = false;
      return;
    }

    const service = SyncService.initialize(store, user.id, {
      syncDebounceMs: SYNC_DEBOUNCE,
      syncIntervalMs: SYNC_INTERVAL,
    });

    // Subscribe to progress updates
    const unsubProgress = service.onProgress((progress: SyncProgress) => {
      setSyncState(progress.phase === 'idle' ? 'idle' : 'syncing');

      // Update status after sync
      const status = service.getStatus();
      setLastSyncedAt(status.lastSyncedAt);
      setRetryQueueLength(status.pendingQueueLength);
    });

    // Subscribe to conflicts
    const unsubConflict = service.onConflict((conflict: SyncConflict) => {
      setConflicts((prev) => [...prev, conflict]);
      toast.warning(i18n.t('sync.conflictDetected', { table: conflict.table }));
    });

    // Subscribe to errors
    const unsubError = service.onError((err: Error) => {
      setError(err.message);
      setSyncState('error');
      console.error('[SyncContext] Sync error:', err);
    });

    // Subscribe to realtime changes
    service.subscribeToRealtime();

    return () => {
      unsubProgress();
      unsubConflict();
      unsubError();
      SyncService.destroy();
    };
  }, [user, store]);

  // Update connection status
  useEffect(() => {
    if (!supabase) {
      setConnectionStatus('offline');
    } else if (isOnline) {
      setConnectionStatus('online');
    } else {
      setConnectionStatus('offline');
    }
  }, [isOnline]);

  // Show toast notifications for online/offline transitions
  useEffect(() => {
    if (prevOnlineRef.current === null) {
      prevOnlineRef.current = isOnline;
      return;
    }

    if (prevOnlineRef.current !== isOnline) {
      if (isOnline) {
        toast.success(i18n.t('sync.backOnline'));
      } else {
        toast.warning(i18n.t('sync.nowOffline'));
      }
      prevOnlineRef.current = isOnline;
    }
  }, [isOnline]);

  // Sync function
  const syncNow = useCallback(async () => {
    const service = SyncService.getInstance();
    if (!service || !isOnline) return;

    setError(null);
    await service.sync();

    const status = service.getStatus();
    setLastSyncedAt(status.lastSyncedAt);
    setRetryQueueLength(status.pendingQueueLength);
  }, [isOnline]);

  // Push all local data to Supabase
  const pushAllToSupabase = useCallback(
    async (onProgress?: (progress: PushAllProgress) => void): Promise<PushAllResult> => {
      const service = SyncService.getInstance();
      if (!service || !isOnline) {
        return { success: false, error: 'Not connected' };
      }

      setIsPushingAll(true);
      setError(null);

      try {
        // Subscribe to progress for this operation
        const unsubProgress = service.onProgress((progress) => {
          if (progress.table) {
            onProgress?.({
              current: progress.current,
              total: progress.total,
              item: progress.table,
            });
          }
        });

        await service.pushAll();
        unsubProgress();

        const status = service.getStatus();
        setLastSyncedAt(status.lastSyncedAt);
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsPushingAll(false);
      }
    },
    [isOnline]
  );

  // Pull all data from Supabase
  const pullAllFromSupabase = useCallback(
    async (onProgress?: (progress: PushAllProgress) => void): Promise<PullAllResult> => {
      const service = SyncService.getInstance();
      if (!service || !isOnline) {
        return { success: false, error: 'Not connected' };
      }

      setIsPullingAll(true);
      setError(null);

      try {
        // Subscribe to progress for this operation
        const unsubProgress = service.onProgress((progress) => {
          if (progress.table) {
            onProgress?.({
              current: progress.current,
              total: progress.total,
              item: progress.table,
            });
          }
        });

        await service.pullAll();
        unsubProgress();

        const status = service.getStatus();
        setLastSyncedAt(status.lastSyncedAt);
        return { success: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsPullingAll(false);
      }
    },
    [isOnline]
  );

  // Resolve a conflict
  const resolveConflict = useCallback(
    (conflictId: string, resolution: ConflictResolution) => {
      const conflict = conflicts.find((c) => c.id === conflictId);
      if (!conflict) return;

      const service = SyncService.getInstance();
      if (!service) return;

      service.resolveConflict(conflict, resolution);
      setConflicts((prev) => prev.filter((c) => c.id !== conflictId));

      // Trigger sync to push the resolved conflict
      service.sync();
    },
    [conflicts]
  );

  // Calculate pending count
  const calculatePendingCount = useCallback(() => {
    if (!store) return 0;
    const tables = ['notes', 'labels', 'contacts', 'note_labels', 'note_assignees'] as const;
    let count = 0;
    tables.forEach((tableName) => {
      const table = store.getTable(tableName) || {};
      count += Object.values(table).filter(
        (row) =>
          (row as Record<string, unknown>).sync_status === 'pending' ||
          (row as Record<string, unknown>).sync_status === 'local'
      ).length;
    });
    return count;
  }, [store]);

  // Initial sync and periodic sync
  useEffect(() => {
    const service = SyncService.getInstance();
    if (!user || !isOnline || !settings.autoSync || !service) {
      return;
    }

    // Initial sync only once per session
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true;
      service.sync();
    }

    // Set up periodic sync
    const intervalId = setInterval(() => {
      service.sync();
    }, SYNC_INTERVAL);

    return () => {
      clearInterval(intervalId);
    };
  }, [user?.id, isOnline, settings.autoSync]);

  // Listen for store changes and trigger debounced sync
  useEffect(() => {
    if (!store || !settings.autoSync) return;

    const service = SyncService.getInstance();
    if (!service) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleChange = () => {
      // Update pending count
      setPendingCount(calculatePendingCount());

      // Debounce sync
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        service.sync().then(() => {
          setPendingCount(calculatePendingCount());
        });
      }, SYNC_DEBOUNCE);
    };

    // Initial count
    setPendingCount(calculatePendingCount());

    // Listen to all sync-relevant tables
    const listenerIds = [
      store.addTableListener('notes', handleChange),
      store.addTableListener('labels', handleChange),
      store.addTableListener('contacts', handleChange),
      store.addTableListener('note_labels', handleChange),
      store.addTableListener('note_assignees', handleChange),
    ];

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      listenerIds.forEach((id) => store.delListener(id));
    };
  }, [store, settings.autoSync, calculatePendingCount]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
    };
  }, []);

  return (
    <SyncContext.Provider
      value={{
        connectionStatus,
        syncState,
        lastSyncedAt,
        pendingCount,
        error,
        conflicts,
        syncNow,
        pushAllToSupabase,
        pullAllFromSupabase,
        resolveConflict,
        isPushingAll,
        isPullingAll,
        retryQueueLength,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
