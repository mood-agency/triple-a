import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from './AuthContext'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useSettings } from '@/hooks/useSettings'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { SyncContextState, SyncConnectionStatus, SyncState, SyncTable, SyncOperation } from '@/types/sync'
import { useTinyBase } from './TinyBaseContext'
import { SupabaseDataSync } from '@/store/persisters/supabaseSync'
import i18n from '@/i18n'

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

const SYNC_INTERVAL = Number(import.meta.env.VITE_SYNC_INTERVAL_MS) || 5 * 60 * 1000
const SYNC_DEBOUNCE = Number(import.meta.env.VITE_SYNC_DEBOUNCE_MS) || 2000

export function SyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const isOnline = useOnlineStatus()
  const { settings } = useSettings()
  const { store: tinybaseStore } = useTinyBase()

  const [connectionStatus, setConnectionStatus] = useState<SyncConnectionStatus>('offline')
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const prevOnlineRef = useRef<boolean | null>(null)

  const [isPushingAll, setIsPushingAll] = useState(false)
  const [isPullingAll, setIsPullingAll] = useState(false)
  const [isSyncServiceReady, setIsSyncServiceReady] = useState(false)

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
      tinybaseSyncRef.current = null
      initialSyncDoneRef.current = false
      setIsSyncServiceReady(false)
      return
    }

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
  }, [user, tinybaseStore])

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

  // Show toast notifications for online/offline transitions
  useEffect(() => {
    // Skip the initial render
    if (prevOnlineRef.current === null) {
      prevOnlineRef.current = isOnline
      return
    }

    // Only show toast if status actually changed
    if (prevOnlineRef.current !== isOnline) {
      if (isOnline) {
        toast.success(i18n.t('sync.backOnline'))
      } else {
        toast.warning(i18n.t('sync.nowOffline'))
      }
      prevOnlineRef.current = isOnline
    }
  }, [isOnline])

  // Sync function
  const syncNow = useCallback(async () => {
    if (!isOnline || isSyncingRef.current) return
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
  }, [isOnline])

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
      if (!tinybaseSyncRef.current) {
        return { success: false, error: 'TinyBase sync not ready', pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0, contacts: 0 } }
      }

      await tinybaseSyncRef.current.pushAll((progress) => {
        onProgress?.({ current: progress.current, total: progress.total, item: progress.table })
      })

      const status = tinybaseSyncRef.current.getSyncStatus()
      setLastSyncedAt(status.lastSyncedAt)
      return { success: true, pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0, contacts: 0 } }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      return { success: false, error: errorMsg, pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0, contacts: 0 } }
    } finally {
      setIsPushingAll(false)
    }
  }, [isOnline])

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
      if (!tinybaseSyncRef.current) {
        return { success: false, error: 'TinyBase sync not ready', pulled: { notes: 0, labels: 0, noteLabels: 0, contacts: 0 } }
      }

      await tinybaseSyncRef.current.pullAll((progress) => {
        onProgress?.({ current: progress.current, total: progress.total, item: progress.table })
      })

      const status = tinybaseSyncRef.current.getSyncStatus()
      setLastSyncedAt(status.lastSyncedAt)
      return { success: true, pulled: { notes: 0, labels: 0, noteLabels: 0, contacts: 0 } }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMsg)
      return { success: false, error: errorMsg, pulled: { notes: 0, labels: 0, noteLabels: 0, contacts: 0 } }
    } finally {
      setIsPullingAll(false)
    }
  }, [isOnline])

  // Queue operation for sync (no-op in TinyBase mode, handled by hooks)
  const queueOperation = useCallback(async (
    _tableName: SyncTable,
    _operation: SyncOperation,
    _recordId: string,
    _data?: Record<string, unknown>
  ) => {
    // In TinyBase mode, sync is handled directly by the hooks
    console.log('[Sync] TinyBase mode - queueOperation skipped, handled by hooks')
  }, [])

  // Initial sync and periodic sync
  useEffect(() => {
    if (!user || !isOnline || !settings.autoSync || !isSyncServiceReady) {
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
  }, [user?.id, isOnline, settings.autoSync, isSyncServiceReady])

  // Ref for syncNow to avoid stale closures in realtime callbacks
  const syncNowRef = useRef(syncNow)
  useEffect(() => {
    syncNowRef.current = syncNow
  }, [syncNow])

  // Calculate pending changes count
  const calculatePendingCount = useCallback(() => {
    if (!tinybaseStore) return 0
    const tables = ['notes', 'labels', 'contacts', 'note_labels'] as const
    let count = 0
    tables.forEach((tableName) => {
      const table = tinybaseStore.getTable(tableName) || {}
      count += Object.values(table).filter(
        (row) => (row as Record<string, unknown>).sync_status === 'pending'
      ).length
    })
    return count
  }, [tinybaseStore])

  // Listen for local TinyBase changes and trigger sync + broadcast
  useEffect(() => {
    if (!tinybaseStore || !settings.autoSync || !isSyncServiceReady) return

    // Helper to check for pending changes and trigger sync
    const checkAndSync = () => {
      const tables = ['notes', 'labels', 'contacts', 'note_labels', 'note_history'] as const
      const hasPending = tables.some((tableName) => {
        const table = tinybaseStore.getTable(tableName) || {}
        return Object.values(table).some(
          (row) => (row as Record<string, unknown>).sync_status === 'pending'
        )
      })

      // Update pending count
      setPendingCount(calculatePendingCount())

      if (hasPending && !isSyncingRef.current) {
        // Debounced sync that also broadcasts to other clients after completion
        if (syncDebounceRef.current) {
          clearTimeout(syncDebounceRef.current)
        }
        syncDebounceRef.current = setTimeout(async () => {
          if (isSyncingRef.current) return
          await syncNowRef.current()
          // Update pending count after sync
          setPendingCount(calculatePendingCount())
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

    // Initial count calculation
    setPendingCount(calculatePendingCount())

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
  }, [tinybaseStore, settings.autoSync, isSyncServiceReady, calculatePendingCount])

  // Set up realtime subscriptions using broadcast for cross-client sync
  useEffect(() => {
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
      .on('broadcast', { event: 'api-mutation' }, (payload) => {
        // API mutation event received - trigger sync to pull changes
        console.log('[SyncContext] API mutation received:', payload.payload)
        syncNowRef.current()
      })
      .subscribe()

    broadcastChannelRef.current = broadcastChannel

    return () => {
      supabase?.removeChannel(broadcastChannel)
      broadcastChannelRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, settings.autoSync])

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
