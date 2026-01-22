import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useDatabase } from './DatabaseContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSettings } from '@/hooks/useSettings'
import { SyncService } from '@/services/SyncService'
import { supabase } from '@/lib/supabase'
import type { SyncContextState, SyncConnectionStatus, SyncState, SyncTable, SyncOperation } from '@/types/sync'
import { persistDatabase } from '@/db'

interface PushAllProgress {
  current: number
  total: number
  item: string
}

interface PushAllResult {
  success: boolean
  error?: string
  pushed: { notes: number; labels: number; noteLabels: number; noteHistory: number }
}

interface PullAllResult {
  success: boolean
  error?: string
  pulled: { notes: number; labels: number; noteLabels: number }
}

interface SyncContextType extends SyncContextState {
  syncNow: () => Promise<void>
  queueOperation: (tableName: SyncTable, operation: SyncOperation, recordId: string, data?: Record<string, unknown>) => Promise<void>
  pushAllToSupabase: (onProgress?: (progress: PushAllProgress) => void) => Promise<PushAllResult>
  pullAllFromSupabase: (onProgress?: (progress: PushAllProgress) => void) => Promise<PullAllResult>
  isPushingAll: boolean
  isPullingAll: boolean
}

const SyncContext = createContext<SyncContextType | null>(null)

const SYNC_INTERVAL = 5 * 60 * 1000 // 5 minutes
const SYNC_DEBOUNCE = 2000 // 2 seconds debounce

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { db, isReady } = useDatabase()
  const isOnline = useOnlineStatus()
  const { settings } = useSettings()

  const [connectionStatus, setConnectionStatus] = useState<SyncConnectionStatus>('offline')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [isPushingAll, setIsPushingAll] = useState(false)
  const [isPullingAll, setIsPullingAll] = useState(false)

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
    console.log('[Sync] syncNow called:', { hasSyncService: !!syncServiceRef.current, isOnline, isSyncing: isSyncingRef.current })
    if (!syncServiceRef.current || !isOnline || isSyncingRef.current) {
      console.log('[Sync] syncNow skipped')
      return
    }

    isSyncingRef.current = true
    setSyncState('syncing')
    setError(null)

    try {
      console.log('[Sync] Starting sync...')
      const result = await syncServiceRef.current.sync()
      console.log('[Sync] Sync result:', result)

      if (result.success) {
        setLastSyncedAt(syncServiceRef.current.getLastSyncedAt())
        setPendingCount(syncServiceRef.current.getPendingCount())
        await persistDatabase()
        setSyncState('idle')
        console.log('[Sync] Sync completed successfully')
      } else {
        setError(result.error || 'Sync failed')
        setSyncState('error')
        console.error('[Sync] Sync failed:', result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setSyncState('error')
      console.error('[Sync] Sync error:', err)
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

  // Push all local data to Supabase (one-way sync)
  const pushAllToSupabase = useCallback(async (
    onProgress?: (progress: PushAllProgress) => void
  ): Promise<PushAllResult> => {
    if (!syncServiceRef.current || !isOnline) {
      return { success: false, error: 'Not connected', pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0 } }
    }

    setIsPushingAll(true)
    setError(null)

    try {
      const result = await syncServiceRef.current.pushAllToSupabase((current, total, item) => {
        onProgress?.({ current, total, item })
      })

      if (result.success) {
        setLastSyncedAt(syncServiceRef.current.getLastSyncedAt())
        setPendingCount(syncServiceRef.current.getPendingCount())
        await persistDatabase()
      } else {
        setError(result.error || 'Push failed')
      }

      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      return { success: false, error: errorMsg, pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0 } }
    } finally {
      setIsPushingAll(false)
    }
  }, [isOnline])

  // Pull all data from Supabase (full sync from cloud)
  const pullAllFromSupabase = useCallback(async (
    onProgress?: (progress: PushAllProgress) => void
  ): Promise<PullAllResult> => {
    if (!syncServiceRef.current || !isOnline) {
      return { success: false, error: 'Not connected', pulled: { notes: 0, labels: 0, noteLabels: 0 } }
    }

    setIsPullingAll(true)
    setError(null)

    try {
      const result = await syncServiceRef.current.pullAllFromSupabase((current, total, item) => {
        onProgress?.({ current, total, item })
      })

      if (result.success) {
        setLastSyncedAt(syncServiceRef.current.getLastSyncedAt())
        await persistDatabase()
      } else {
        setError(result.error || 'Pull failed')
      }

      return result
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      return { success: false, error: errorMsg, pulled: { notes: 0, labels: 0, noteLabels: 0 } }
    } finally {
      setIsPullingAll(false)
    }
  }, [isOnline])

  // Queue operation for sync
  const queueOperation = useCallback(async (
    tableName: SyncTable,
    operation: SyncOperation,
    recordId: string,
    data?: Record<string, unknown>
  ) => {
    console.log('[Sync] queueOperation called:', { tableName, operation, recordId, hasUser: !!user, hasSyncService: !!syncServiceRef.current })
    if (!syncServiceRef.current || !user) {
      console.log('[Sync] queueOperation skipped - no syncService or user')
      return
    }

    await syncServiceRef.current.queueOperation(tableName, operation, recordId, data)
    const pendingCount = syncServiceRef.current.getPendingCount()
    console.log('[Sync] Operation queued, pending count:', pendingCount)
    setPendingCount(pendingCount)
    await persistDatabase()

    // Try to sync with debounce if online and auto-sync is enabled
    if (isOnline && settings.autoSync) {
      console.log('[Sync] Triggering debounced sync')
      debouncedSync()
    }
  }, [user, isOnline, debouncedSync, settings.autoSync])

  // Initial sync and periodic sync
  useEffect(() => {
    if (!user || !isOnline || !syncServiceRef.current || !settings.autoSync) {
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
  }, [user, isOnline, syncNow, settings.autoSync])

  // Sync when coming back online with pending changes
  useEffect(() => {
    if (isOnline && pendingCount > 0 && !isSyncingRef.current && initialSyncDoneRef.current && settings.autoSync) {
      debouncedSync()
    }
  }, [isOnline, pendingCount, debouncedSync, settings.autoSync])

  // Set up realtime subscriptions - separate from sync logic
  useEffect(() => {
    if (!supabase || !user || !db || !settings.autoSync) return

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
  }, [user, db, debouncedSync, settings.autoSync])

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
        pushAllToSupabase,
        pullAllFromSupabase,
        isPushingAll,
        isPullingAll,
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
