import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { googleCalendarService } from '@/services/googleCalendarService';
import { generateId, now } from '@/store/schema';
import type {
  GCalCalendar,
  GCalConfig,
  GCalEvent,
  GCalSyncStatus,
  GCalSyncResult,
} from '@/types/googleCalendar';
import type { NoteCategory } from '@/types/note';

const OAUTH_REDIRECT_PATH = '/settings/calendar/callback';

export interface UseGoogleCalendarReturn {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Calendars
  calendars: GCalCalendar[];
  loadingCalendars: boolean;

  // Config
  config: GCalConfig | null;

  // Sync state
  syncStatus: GCalSyncStatus;
  lastSyncResult: GCalSyncResult | null;

  // Actions
  connect: () => void;
  disconnect: () => Promise<void>;
  refreshCalendars: () => Promise<void>;
  updateConfig: (config: Partial<GCalConfig>) => Promise<void>;
  syncNow: () => Promise<GCalSyncResult>;
  handleOAuthCallback: (code: string) => Promise<boolean>;
  clearError: () => void;
}

const GoogleCalendarContext = createContext<UseGoogleCalendarReturn | null>(null);

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { store, isReady } = useTinyBase();
  const { user } = useAuth();

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [calendars, setCalendars] = useState<GCalCalendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [config, setConfig] = useState<GCalConfig | null>(null);
  const [syncStatus, setSyncStatus] = useState<GCalSyncStatus>('idle');
  const [lastSyncResult, setLastSyncResult] = useState<GCalSyncResult | null>(null);

  // Refs
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  /**
   * Clear error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Check connection status on mount and when user changes
   */
  useEffect(() => {
    if (!user) {
      setIsConnected(false);
      setIsLoading(false);
      return;
    }

    const checkStatus = async () => {
      setIsLoading(true);
      try {
        const status = await googleCalendarService.getConnectionStatus();
        setIsConnected(status.isConnected && !status.isExpired);

        if (status.isConnected) {
          const configData = await googleCalendarService.getConfig();
          setConfig(configData);
        }
      } catch (err) {
        console.error('Error checking Google Calendar status:', err);
        setError(err instanceof Error ? err.message : 'Failed to check status');
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, [user]);

  /**
   * Refresh calendars list
   */
  const refreshCalendars = useCallback(async () => {
    setLoadingCalendars(true);
    try {
      const result = await googleCalendarService.getCalendars();
      if (result.error) {
        setError(result.error);
        return;
      }
      setCalendars(result.calendars);
    } catch (err) {
      console.error('Error refreshing calendars:', err);
      setError(err instanceof Error ? err.message : 'Failed to load calendars');
    } finally {
      setLoadingCalendars(false);
    }
  }, []);

  /**
   * Load calendars when connected
   */
  useEffect(() => {
    if (isConnected && !loadingCalendars && calendars.length === 0) {
      refreshCalendars();
    }
  }, [isConnected, loadingCalendars, calendars.length, refreshCalendars]);

  /**
   * Sync events from Google Calendar to notes
   */
  const syncNow = useCallback(async (): Promise<GCalSyncResult> => {
    const result: GCalSyncResult = {
      success: false,
      eventsImported: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: [],
    };

    if (!store || !isReady || !isConnected || !config?.enabled) {
      result.errors.push('Not ready to sync');
      return result;
    }

    if (!config.calendars_to_sync || config.calendars_to_sync.length === 0) {
      result.errors.push('No calendars selected to sync');
      return result;
    }

    setSyncStatus('syncing');
    setError(null);
    lastSyncTimeRef.current = Date.now();

    try {
      // Fetch events from selected calendars
      const eventsResult = await googleCalendarService.getEvents({
        calendarIds: config.calendars_to_sync,
      });

      if (eventsResult.error) {
        result.errors.push(eventsResult.error);
        setSyncStatus('error');
        setLastSyncResult(result);
        return result;
      }

      const events = eventsResult.events;

      // Get existing event mappings
      const mappings = await googleCalendarService.getEventMappings();
      const mappingByGCalId = new Map(mappings.map((m) => [m.gcal_event_id, m]));

      // Track which events we've seen
      const seenEventIds = new Set<string>();

      // Process each event
      for (const event of events) {
        seenEventIds.add(event.id);
        const existingMapping = mappingByGCalId.get(event.id);

        try {
          if (existingMapping) {
            // Check if event was updated
            if (existingMapping.etag !== event.etag) {
              await updateNoteFromEvent(store, existingMapping.local_note_id, event, config.default_category);
              await googleCalendarService.saveEventMapping({
                user_id: existingMapping.user_id,
                gcal_event_id: event.id,
                gcal_calendar_id: getCalendarIdFromEvent(event, config.calendars_to_sync),
                local_note_id: existingMapping.local_note_id,
                etag: event.etag,
                event_status: event.status,
                last_synced_at: new Date().toISOString(),
              });
              result.eventsUpdated++;
            }
          } else {
            // Create new note from event
            const noteId = await createNoteFromEvent(store, event, config.default_category);
            await googleCalendarService.saveEventMapping({
              user_id: user!.id,
              gcal_event_id: event.id,
              gcal_calendar_id: getCalendarIdFromEvent(event, config.calendars_to_sync),
              local_note_id: noteId,
              etag: event.etag,
              event_status: event.status,
              last_synced_at: new Date().toISOString(),
            });
            result.eventsImported++;
          }
        } catch (err) {
          console.error(`Error processing event ${event.id}:`, err);
          result.errors.push(`Failed to process event: ${event.summary}`);
        }
      }

      // Handle deleted events
      for (const mapping of mappings) {
        if (!seenEventIds.has(mapping.gcal_event_id)) {
          try {
            const timestamp = now();
            store.setPartialRow('notes', mapping.local_note_id, {
              deleted_at: timestamp,
              updated_at: timestamp,
              sync_status: 'pending',
            });
            await googleCalendarService.deleteEventMapping(mapping.gcal_event_id);
            result.eventsDeleted++;
          } catch (err) {
            console.error(`Error deleting mapping for ${mapping.gcal_event_id}:`, err);
          }
        }
      }

      // Update last sync time
      await googleCalendarService.updateLastSyncTime();

      result.success = true;
      setSyncStatus('success');

      // Reload config
      const newConfig = await googleCalendarService.getConfig();
      setConfig(newConfig);
    } catch (err) {
      console.error('Error during sync:', err);
      result.errors.push(err instanceof Error ? err.message : 'Unknown error');
      setSyncStatus('error');
    }

    setLastSyncResult(result);

    // Reset status after delay
    setTimeout(() => {
      setSyncStatus('idle');
    }, 3000);

    return result;
  }, [store, isReady, isConnected, config, user]);

  /**
   * Setup auto-sync interval
   */
  useEffect(() => {
    if (!isConnected || !config?.enabled || !config.sync_interval_minutes) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    const intervalMs = config.sync_interval_minutes * 60 * 1000;

    // Initial sync on connect (if not synced recently)
    const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
    if (timeSinceLastSync > intervalMs) {
      syncNow();
    }

    syncIntervalRef.current = setInterval(() => {
      syncNow();
    }, intervalMs);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [isConnected, config?.enabled, config?.sync_interval_minutes, syncNow]);

  /**
   * Sync on visibility change (when tab becomes visible)
   */
  useEffect(() => {
    if (!isConnected || !config?.enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Only sync if enough time has passed since last sync
        const minInterval = (config.sync_interval_minutes || 15) * 60 * 1000;
        const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;

        if (timeSinceLastSync > minInterval) {
          syncNow();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isConnected, config?.enabled, config?.sync_interval_minutes, syncNow]);

  /**
   * Initiate OAuth flow
   */
  const connect = useCallback(() => {
    try {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
      const oauthUrl = googleCalendarService.getOAuthUrl(redirectUri);
      window.location.href = oauthUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start OAuth');
    }
  }, []);

  /**
   * Handle OAuth callback
   */
  const handleOAuthCallback = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
      const result = await googleCalendarService.exchangeCodeForTokens(code, redirectUri);

      if (!result.success) {
        setError(result.error || 'Failed to connect');
        return false;
      }

      setIsConnected(true);

      // Load config and calendars
      const configData = await googleCalendarService.getConfig();
      setConfig(configData);
      await refreshCalendars();

      return true;
    } catch (err) {
      console.error('Error handling OAuth callback:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCalendars]);

  /**
   * Disconnect Google Calendar
   */
  const disconnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await googleCalendarService.disconnect();
      if (!result.success) {
        setError(result.error || 'Failed to disconnect');
        return;
      }

      setIsConnected(false);
      setCalendars([]);
      setConfig(null);
    } catch (err) {
      console.error('Error disconnecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update configuration
   */
  const updateConfig = useCallback(async (updates: Partial<GCalConfig>) => {
    try {
      const result = await googleCalendarService.updateConfig(updates);
      if (!result.success) {
        setError(result.error || 'Failed to update config');
        return;
      }

      // Reload config
      const newConfig = await googleCalendarService.getConfig();
      setConfig(newConfig);
    } catch (err) {
      console.error('Error updating config:', err);
      setError(err instanceof Error ? err.message : 'Failed to update config');
    }
  }, []);

  const value: UseGoogleCalendarReturn = {
    isConnected,
    isLoading,
    error,
    calendars,
    loadingCalendars,
    config,
    syncStatus,
    lastSyncResult,
    connect,
    disconnect,
    refreshCalendars,
    updateConfig,
    syncNow,
    handleOAuthCallback,
    clearError,
  };

  return (
    <GoogleCalendarContext.Provider value={value}>
      {children}
    </GoogleCalendarContext.Provider>
  );
}

export function useGoogleCalendarContext() {
  const context = useContext(GoogleCalendarContext);
  if (!context) {
    throw new Error('useGoogleCalendarContext must be used within GoogleCalendarProvider');
  }
  return context;
}

// Helper functions

async function createNoteFromEvent(
  store: ReturnType<typeof useTinyBase>['store'],
  event: GCalEvent,
  defaultCategory: NoteCategory
): Promise<string> {
  if (!store) throw new Error('Store not ready');

  const id = generateId();
  const timestamp = now();

  const isAllDay = !event.start.dateTime;
  const deadline = isAllDay
    ? `${event.start.date}T00:00:00`
    : event.start.dateTime!;

  const date = deadline.split('T')[0];

  store.setRow('notes', id, {
    date,
    content: event.summary || 'Untitled Event',
    description: event.description || null,
    category: defaultCategory,
    completed: false,
    completed_at: null,
    deadline,
    pinned: false,
    sort_order: 0,
    assignee_id: null,
    project_id: null,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    remote_id: null,
    sync_status: 'local',
    last_synced_at: null,
    gcal_event_id: event.id,
  });

  // Save initial history entry
  const historyId = generateId();
  store.setRow('note_history', historyId, {
    note_id: id,
    content: event.summary || 'Untitled Event',
    description: event.description || null,
    category: defaultCategory,
    completed: false,
    changed_at: timestamp,
    action_type: 'created',
    reason: 'Imported from Google Calendar',
    previous_date: null,
  });

  return id;
}

async function updateNoteFromEvent(
  store: ReturnType<typeof useTinyBase>['store'],
  noteId: string,
  event: GCalEvent,
  defaultCategory: NoteCategory
): Promise<void> {
  if (!store) return;

  const existingNote = store.getRow('notes', noteId);
  if (!existingNote) return;

  const timestamp = now();

  const isAllDay = !event.start.dateTime;
  const deadline = isAllDay
    ? `${event.start.date}T00:00:00`
    : event.start.dateTime!;

  store.setPartialRow('notes', noteId, {
    content: event.summary || 'Untitled Event',
    description: event.description || null,
    deadline,
    updated_at: timestamp,
    sync_status: 'pending',
    gcal_event_id: event.id,
  });

  // Save history entry
  const historyId = generateId();
  store.setRow('note_history', historyId, {
    note_id: noteId,
    content: event.summary || 'Untitled Event',
    description: event.description || null,
    category: (existingNote.category as NoteCategory) || defaultCategory,
    completed: existingNote.completed as boolean,
    changed_at: timestamp,
    action_type: 'edit',
    reason: 'Updated from Google Calendar',
    previous_date: null,
  });
}

function getCalendarIdFromEvent(_event: GCalEvent, selectedCalendars: string[]): string {
  return selectedCalendars[0] || 'primary';
}
