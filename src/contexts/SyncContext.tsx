import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSettings } from '@/hooks/useSettings'
import { SyncService } from '@/services/SyncService'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { SyncContextState, SyncConnectionStatus, SyncState, SyncTable, SyncOperation } from '@/types/sync'
import { persistDatabase, getDatabase } from '@/db'
import { getFlag } from '@/config/featureFlags'
import { useTinyBase } from './TinyBaseContext'
import { SupabaseDataSync } from '@/store/persisters/supabaseSync'

interface PushAllProgress {
  current: number
  total: number
  item: string
}

interface PushAllResult {
  success: boolean
  error?: string
  pushed: { notes: number; labels: number; noteLabels: number; noteHistory: number; contacts: number }
}

interface PullAllResult {
  success: boolean
  error?: string
  pulled: { notes: number; labels: number; noteLabels: number; contacts: number }
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
  const isOnline = useOnlineStatus()
  const { settings } = useSettings()
  const { store: tinybaseStore } = useTinyBase()

  // Check if TinyBase mode is enabled
  const useTinyBaseEnabled = getFlag('useTinyBase')

  const [connectionStatus, setConnectionStatus] = useState<SyncConnectionStatus>('offline')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [isPushingAll, setIsPushingAll] = useState(false)
  const [isPullingAll, setIsPullingAll] = useState(false)
  const [isSyncServiceReady, setIsSyncServiceReady] = useState(false)

  const syncServiceRef = useRef<SyncService | null>(null)
  const tinybaseSyncRef = useRef<SupabaseDataSync | null>(null)
  const syncDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSyncingRef = useRef(false)
  const initialSyncDoneRef = useRef(false)

  // Unique client ID to identify this browser instance
  const clientIdRef = useRef<string>(`client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
  // Broadcast channel ref for sending sync notifications
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null)
  // Track when we're the source of a change to avoid self-triggering
  const lastSyncTimeRef = useRef<number>(0)

  // Initialize sync service when user is ready
  useEffect(() => {
    if (!user) {
      syncServiceRef.current = null
      tinybaseSyncRef.current = null
      initialSyncDoneRef.current = false
      setIsSyncServiceReady(false)
      return
    }

    if (useTinyBaseEnabled) {
      // TinyBase mode - use SupabaseDataSync
      if (tinybaseStore) {
        tinybaseSyncRef.current = new SupabaseDataSync(tinybaseStore, {
          userId: user.id,
          onError: (error, table) => {
            console.error(`[TinyBaseSync] Error in ${table}:`, error)
            setError(error.message)
          },
        })
        initialSyncDoneRef.current = false
        setIsSyncServiceReady(true)
      } else {
        setIsSyncServiceReady(false)
      }
    } else {
      // Legacy mode - use SyncService
      try {
        const db = getDatabase()
        if (db) {
          syncServiceRef.current = new SyncService(db, user.id)
          setLastSyncedAt(syncServiceRef.current.getLastSyncedAt())
          setPendingCount(syncServiceRef.current.getPendingCount())
          initialSyncDoneRef.current = false
          setIsSyncServiceReady(true)
        } else {
          syncServiceRef.current = null
          initialSyncDoneRef.current = false
          setIsSyncServiceReady(false)
        }
      } catch {
        // Database not initialized yet (can happen during startup)
        syncServiceRef.current = null
        initialSyncDoneRef.current = false
        setIsSyncServiceReady(false)
      }
    }
  }, [user, useTinyBaseEnabled, tinybaseStore])

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
    if (!isOnline || isSyncingRef.current) return

    // TinyBase mode
    if (useTinyBaseEnabled) {
      if (!tinybaseSyncRef.current) return

      isSyncingRef.current = true
      setSyncState('syncing')
      setError(null)

      try {
        lastSyncTimeRef.current = Date.now()
        await tinybaseSyncRef.current.sync()
        lastSyncTimeRef.current = Date.now()
        const status = tinybaseSyncRef.current.getSyncStatus()
        setLastSyncedAt(status.lastSyncedAt)
        setSyncState('idle')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
        setSyncState('error')
        console.error('[Sync] TinyBase sync error:', err)
      } finally {
        isSyncingRef.current = false
      }
      return
    }

    // Legacy mode
    console.log('[Sync] syncNow called:', { hasSyncService: !!syncServiceRef.current, isOnline, isSyncing: isSyncingRef.current })
    if (!syncServiceRef.current) {
      console.log('[Sync] syncNow skipped - no sync service')
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
  }, [isOnline, useTinyBaseEnabled])

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
    if (!isOnline) {
      return { success: false, error: 'Not connected', pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0, contacts: 0 } }
    }

    setIsPushingAll(true)
    setError(null)

    try {
      if (useTinyBaseEnabled) {
        // TinyBase mode
        if (!tinybaseSyncRef.current) {
          return { success: false, error: 'TinyBase sync not ready', pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0, contacts: 0 } }
        }

        await tinybaseSyncRef.current.pushAll((progress) => {
          onProgress?.({ current: progress.current, total: progress.total, item: progress.table })
        })

        const status = tinybaseSyncRef.current.getSyncStatus()
        setLastSyncedAt(status.lastSyncedAt)
        return { success: true, pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0, contacts: 0 } }
      }

      // Legacy mode
      if (!syncServiceRef.current) {
        return { success: false, error: 'Sync service not ready', pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0, contacts: 0 } }
      }

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
      return { success: false, error: errorMsg, pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0, contacts: 0 } }
    } finally {
      setIsPushingAll(false)
    }
  }, [isOnline, useTinyBaseEnabled])

  // Pull all data from Supabase (full sync from cloud)
  const pullAllFromSupabase = useCallback(async (
    onProgress?: (progress: PushAllProgress) => void
  ): Promise<PullAllResult> => {
    if (!isOnline) {
      return { success: false, error: 'Not connected', pulled: { notes: 0, labels: 0, noteLabels: 0, contacts: 0 } }
    }

    setIsPullingAll(true)
    setError(null)

    try {
      if (useTinyBaseEnabled) {
        // TinyBase mode
        if (!tinybaseSyncRef.current) {
          return { success: false, error: 'TinyBase sync not ready', pulled: { notes: 0, labels: 0, noteLabels: 0, contacts: 0 } }
        }

        await tinybaseSyncRef.current.pullAll((progress) => {
          onProgress?.({ current: progress.current, total: progress.total, item: progress.table })
        })

        const status = tinybaseSyncRef.current.getSyncStatus()
        setLastSyncedAt(status.lastSyncedAt)
        return { success: true, pulled: { notes: 0, labels: 0, noteLabels: 0, contacts: 0 } }
      }

      // Legacy mode
      if (!syncServiceRef.current) {
        return { success: false, error: 'Sync service not ready', pulled: { notes: 0, labels: 0, noteLabels: 0, contacts: 0 } }
      }

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
      return { success: false, error: errorMsg, pulled: { notes: 0, labels: 0, noteLabels: 0, contacts: 0 } }
    } finally {
      setIsPullingAll(false)
    }
  }, [isOnline, useTinyBaseEnabled])

  // Queue operation for sync
  const queueOperation = useCallback(async (
    tableName: SyncTable,
    operation: SyncOperation,
    recordId: string,
    data?: Record<string, unknown>
  ) => {
    // In TinyBase mode, sync is handled directly by the hooks
    if (useTinyBaseEnabled) {
      console.log('[Sync] TinyBase mode - queueOperation skipped, handled by hooks')
      return
    }

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
  }, [user, isOnline, debouncedSync, settings.autoSync, useTinyBaseEnabled])

  // Initial sync and periodic sync for TinyBase mode
  useEffect(() => {
    if (!useTinyBaseEnabled || !user || !isOnline || !settings.autoSync || !isSyncServiceReady) {
      return
    }

    // Initial sync only once per session
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true
      syncNow()
    }

    // Set up periodic sync
    const intervalId = setInterval(() => {
      if (!isSyncingRef.current) {
        syncNow()
      }
    }, SYNC_INTERVAL)

    return () => {
      clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOnline, settings.autoSync, useTinyBaseEnabled, isSyncServiceReady])

  // Initial sync and periodic sync for legacy mode
  useEffect(() => {
    if (useTinyBaseEnabled || !user || !isOnline || !settings.autoSync || !isSyncServiceReady) {
      return
    }

    // Initial sync only once per session
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true
      syncNow()
    }

    // Set up periodic sync
    const intervalId = setInterval(() => {
      if (!isSyncingRef.current) {
        syncNow()
      }
    }, SYNC_INTERVAL)

    return () => {
      clearInterval(intervalId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOnline, settings.autoSync, useTinyBaseEnabled, isSyncServiceReady])

  // Sync when coming back online with pending changes (only for legacy mode)
  useEffect(() => {
    if (useTinyBaseEnabled) return
    if (isOnline && pendingCount > 0 && !isSyncingRef.current && initialSyncDoneRef.current && settings.autoSync) {
      debouncedSync()
    }
  }, [isOnline, pendingCount, debouncedSync, settings.autoSync, useTinyBaseEnabled])

  // Listen for local TinyBase changes and trigger sync + broadcast
  useEffect(() => {
    if (!useTinyBaseEnabled || !tinybaseStore || !settings.autoSync || !isSyncServiceReady) return

    // Helper to check for pending changes and trigger sync
    const checkAndSync = () => {
      const tables = ['notes', 'labels', 'contacts', 'note_labels', 'note_history'] as const
      const hasPending = tables.some((tableName) => {
        const table = tinybaseStore.getTable(tableName) || {}
        return Object.values(table).some(
          (row) => (row as Record<string, unknown>).sync_status === 'pending'
        )
      })

      if (hasPending && !isSyncingRef.current) {
        // Debounced sync that also broadcasts to other clients after completion
        if (syncDebounceRef.current) {
          clearTimeout(syncDebounceRef.current)
        }
        syncDebounceRef.current = setTimeout(async () => {
          if (isSyncingRef.current) return
          await syncNowRef.current()
          // Only broadcast after syncing LOCAL changes (not pulls from other clients)
          if (broadcastChannelRef.current && supabase) {
            broadcastChannelRef.current.send({
              type: 'broadcast',
              event: 'sync-needed',
              payload: { clientId: clientIdRef.current, timestamp: Date.now() },
            })
          }
        }, SYNC_DEBOUNCE)
      }
    }

    // Listen for changes to all sync-relevant tables
    const listenerIds = [
      tinybaseStore.addTableListener('notes', checkAndSync),
      tinybaseStore.addTableListener('labels', checkAndSync),
      tinybaseStore.addTableListener('contacts', checkAndSync),
      tinybaseStore.addTableListener('note_labels', checkAndSync),
      tinybaseStore.addTableListener('note_history', checkAndSync),
    ]

    return () => {
      listenerIds.forEach((id) => tinybaseStore.delListener(id))
    }
  }, [useTinyBaseEnabled, tinybaseStore, settings.autoSync, isSyncServiceReady])

  // Ref for syncNow to avoid stale closures in realtime callbacks
  const syncNowRef = useRef(syncNow)
  useEffect(() => {
    syncNowRef.current = syncNow
  }, [syncNow])

  // Set up realtime subscriptions for TinyBase mode using broadcast for cross-client sync
  useEffect(() => {
    if (!useTinyBaseEnabled) return
    if (!supabase || !user?.id || !settings.autoSync) return

    // Create a user-specific channel for broadcast messages
    const broadcastChannel = supabase
      .channel(`sync-broadcast-${user.id}`)
      .on('broadcast', { event: 'sync-needed' }, (payload) => {
        const { clientId } = payload.payload as { clientId: string; timestamp: number }
        // Only sync if the notification came from a different client
        if (clientId !== clientIdRef.current) {
          syncNowRef.current()
        }
      })
      .subscribe()

    broadcastChannelRef.current = broadcastChannel

    return () => {
      supabase?.removeChannel(broadcastChannel)
      broadcastChannelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, settings.autoSync, useTinyBaseEnabled])

  // Set up realtime subscriptions for legacy mode
  useEffect(() => {
    if (useTinyBaseEnabled) return
    if (!supabase || !user?.id || !settings.autoSync) return

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
          syncNow()
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
          syncNow()
        }
      )
      .subscribe()

    return () => {
      supabase?.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, settings.autoSync, useTinyBaseEnabled])

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
