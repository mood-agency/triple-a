import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useDatabase } from './DatabaseContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { SyncService } from '@/services/SyncService'
import { supabase } from '@/lib/supabase'
import type { SyncContextState, SyncConnectionStatus, SyncState, SyncTable, SyncOperation } from '@/types/sync'
import { persistDatabase } from '@/db'

interface SyncContextType extends SyncContextState {
  syncNow: () => Promise<void>
  queueOperation: (tableName: SyncTable, operation: SyncOperation, recordId: string, data?: Record<string, unknown>) => Promise<void>
}

const SyncContext = createContext<SyncContextType | null>(null)

const SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes
const SYNC_DEBOUNCE = 2000 // 2 seconds debounce

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { db, isReady } = useDatabase()
  const isOnline = useOnlineStatus()

  const [connectionStatus, setConnectionStatus] = useState<SyncConnectionStatus>('offline')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const syncServiceRef = useRef<SyncService | null>(null)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSyncingRef = useRef(false)
  const initialSyncDoneRef = useRef(false)

  // Initialize sync service when db and user are ready
  useEffect(() => {
    if (db && user && isReady) {
      syncServiceRef.current = new SyncService(db, user.id)
      setLastSyncedAt(syncServiceRef.current.getLastSyncedAt())
      setPendingCount(syncServiceRef.current.getPendingCount())
      initialSyncDoneRef.current = false
    } else {
      syncServiceRef.current = null
      initialSyncDoneRef.current = false
    }
  }, [db, user, isReady])

  // Update connection status
  useEffect(() => {
    if (!supabase) {
      setConnectionStatus('offline')
    } else if (isOnline) {
      setConnectionStatus('online')
    } else {
      setConnectionStatus('offline')
    }
  }, [isOnline])

  // Sync function - stable reference using ref for state check
  const syncNow = useCallback(async () => {
    if (!syncServiceRef.current || !isOnline || isSyncingRef.current) {
      return
    }

    isSyncingRef.current = true
    setSyncState('syncing')
    setError(null)

    try {
      const result = await syncServiceRef.current.sync()

      if (result.success) {
        setLastSyncedAt(syncServiceRef.current.getLastSyncedAt())
        setPendingCount(syncServiceRef.current.getPendingCount())
        await persistDatabase()
        setSyncState('idle')
      } else {
        setError(result.error || 'Sync failed')
        setSyncState('error')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSyncState('error')
    } finally {
      isSyncingRef.current = false
    }
  }, [isOnline])

  // Debounced sync to prevent rapid successive calls
  const debouncedSync = useCallback(() => {
    if (syncDebounceRef.current) {
      clearTimeout(syncDebounceRef.current)
    }
    syncDebounceRef.current = setTimeout(() => {
      syncNow()
    }, SYNC_DEBOUNCE)
  }, [syncNow])

  // Queue operation for sync
  const queueOperation = useCallback(async (
    tableName: SyncTable,
    operation: SyncOperation,
    recordId: string,
    data?: Record<string, unknown>
  ) => {
    if (!syncServiceRef.current || !user) return

    await syncServiceRef.current.queueOperation(tableName, operation, recordId, data)
    setPendingCount(syncServiceRef.current.getPendingCount())
    await persistDatabase()

    // Try to sync with debounce if online
    if (isOnline) {
      debouncedSync()
    }
  }, [user, isOnline, debouncedSync])

  // Initial sync and periodic sync
  useEffect(() => {
    if (!user || !isOnline || !syncServiceRef.current) {
      return
    }

    // Initial sync only once per session
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true
      syncNow()
    }

    // Set up periodic sync
    syncIntervalRef.current = setInterval(() => {
      if (!isSyncingRef.current) {
        syncNow()
      }
    }, SYNC_INTERVAL)

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
  }, [user, isOnline, syncNow])

  // Sync when coming back online with pending changes
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncingRef.current && initialSyncDoneRef.current) {
      debouncedSync()
    }
  }, [isOnline, pendingCount, debouncedSync])

  // Set up realtime subscriptions - separate from sync logic
  useEffect(() => {
    if (!supabase || !user || !db) return

    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Debounced sync when remote changes detected
          debouncedSync()
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
          debouncedSync()
        }
      )
      .subscribe()

    return () => {
      if (supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [user, db, debouncedSync])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current)
      }
    }
  }, [])

  return (
    <SyncContext.Provider
      value={{
        connectionStatus,
        syncState,
        lastSyncedAt,
        pendingCount,
        error,
        syncNow,
        queueOperation,
      }}
    >
      {children}
    </SyncContext.Provider>
  )
}

export function useSync() {
  const context = useContext(SyncContext)
  if (!context) {
    throw new Error('useSync must be used within SyncProvider')
  }
  return context
}
