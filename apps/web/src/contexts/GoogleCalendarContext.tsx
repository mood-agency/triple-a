import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { googleCalendarService } from '@/services/googleCalendarService';
import { generateId, now } from '@/store/schema';
import { toast } from 'sonner';
import { createGoogleCalendarRepository, type IGoogleCalendarRepository } from '@/store/repositories/googleCalendarRepository';
import type {
  GCalCalendarWithAccount,
  GCalConfig,
  GCalEvent,
  GCalSyncStatus,
  GCalSyncResult,
  GCalCreateEventRequest,
  GCalAccount,
  GCalEventMapping,
} from '@/types/googleCalendar';
import type { Project } from '@/types/project';


const OAUTH_REDIRECT_PATH = '/settings/calendar/callback';

// ============================================================================
// Types
// ============================================================================

type ErrorType = 'connection' | 'sync' | 'config' | 'oauth';

interface GCalError {
  type: ErrorType;
  message: string;
  timestamp: number;
}

interface SyncState {
  status: GCalSyncStatus;
  lastResult: GCalSyncResult | null;
}

export interface UseGoogleCalendarReturn {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: GCalError | null;

  // Multi-account support
  accounts: GCalAccount[];
  loadingAccounts: boolean;

  // Calendars (with account info for multi-account)
  calendars: GCalCalendarWithAccount[];
  loadingCalendars: boolean;

  // Config
  config: GCalConfig | null;

  // Sync state
  syncStatus: GCalSyncStatus;
  lastSyncResult: GCalSyncResult | null;

  // Actions
  connect: () => void;
  addAccount: () => void;
  removeAccount: (accountId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  refreshCalendars: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  updateConfig: (config: Partial<GCalConfig>) => Promise<void>;
  syncNow: () => Promise<GCalSyncResult>;
  handleOAuthCallback: (code: string) => Promise<boolean>;
  clearError: () => void;
  createCalendarEvent: (noteId: string, summary: string, description: string | null, deadline: string | null) => Promise<{ success: boolean; gcalEventId?: string; error?: string }>;
  updateCalendarEvent: (gcalEventId: string, summary: string, description: string | null, deadline: string | null) => Promise<{ success: boolean; error?: string }>;
  deleteCalendarEvent: (gcalEventId: string) => Promise<{ success: boolean; error?: string }>;
}

const GoogleCalendarContext = createContext<UseGoogleCalendarReturn | null>(null);

// ============================================================================
// Sync Helper Functions
// ============================================================================

interface SyncContext {
  store: ReturnType<typeof useTinyBase>['store'];
  user: { id: string } | null;
  repository: IGoogleCalendarRepository;
}

/**
 * Clean up duplicate notes with the same gcal_event_id
 * Returns number of duplicates removed
 */
function cleanupDuplicateNotes(repository: IGoogleCalendarRepository): number {
  const duplicates = repository.findDuplicateNotesByGCalEventId();
  let cleaned = 0;

  for (const noteIds of duplicates.values()) {
    // Keep the first, delete the rest
    const toDelete = noteIds.slice(1);
    cleaned += repository.markNotesAsDeleted(toDelete);
  }

  return cleaned;
}

/**
 * Fetch events for a project from Google Calendar
 */
async function fetchEventsForProject(
  project: Project
): Promise<{ events: GCalEvent[]; error?: string }> {
  const calendarId = project.gcal_calendar_id!;
  const accountId = project.gcal_account_id;

  if (accountId) {
    // Use account-specific API for multi-account support
    return googleCalendarService.getEventsForAccount(accountId, {
      calendarIds: [calendarId],
    });
  } else {
    // Fall back to legacy single-account method
    return googleCalendarService.getEvents({
      calendarIds: [calendarId],
    });
  }
}

interface ProcessEventParams {
  event: GCalEvent;
  project: Project;
  existingMapping: GCalEventMapping | undefined;
  existingNoteInTinyBase: { id: string } | null;
  ctx: SyncContext;
  mappingByGCalId: Map<string, GCalEventMapping>;
  noteByGCalId: Map<string, { id: string }>;
}

/**
 * Process a single event - creates, updates, or skips based on state
 */
async function processSingleEvent(params: ProcessEventParams): Promise<{
  action: 'imported' | 'updated' | 'skipped';
  error?: string;
}> {
  const { event, project, existingMapping, existingNoteInTinyBase, ctx, mappingByGCalId, noteByGCalId } = params;
  const calendarId = project.gcal_calendar_id!;

  if (existingMapping) {
    // Check if event was updated or category needs fixing
    const noteCategory = ctx.repository.getNoteCategory(existingMapping.local_note_id);
    const needsUpdate = existingMapping.etag !== event.etag || noteCategory !== 'meeting';

    if (needsUpdate) {
      await updateNoteFromEvent(ctx.store, existingMapping.local_note_id, event, project.id);
      await googleCalendarService.saveEventMapping({
        user_id: existingMapping.user_id,
        gcal_event_id: event.id,
        gcal_calendar_id: calendarId,
        local_note_id: existingMapping.local_note_id,
        etag: event.etag,
        event_status: event.status,
        last_synced_at: new Date().toISOString(),
      });
      return { action: 'updated' };
    }
    return { action: 'skipped' };
  }

  if (existingNoteInTinyBase) {
    // Note exists in TinyBase but mapping was lost - recreate mapping
    await updateNoteFromEvent(ctx.store, existingNoteInTinyBase.id, event, project.id);
    await googleCalendarService.saveEventMapping({
      user_id: ctx.user!.id,
      gcal_event_id: event.id,
      gcal_calendar_id: calendarId,
      local_note_id: existingNoteInTinyBase.id,
      etag: event.etag,
      event_status: event.status,
      last_synced_at: new Date().toISOString(),
    });
    return { action: 'updated' };
  }

  // Create new meeting from event with project assignment
  const noteId = await createNoteFromEvent(ctx.store, event, project.id);
  const mappingData: GCalEventMapping = {
    id: '',
    user_id: ctx.user!.id,
    gcal_event_id: event.id,
    gcal_calendar_id: calendarId,
    local_note_id: noteId,
    etag: event.etag,
    event_status: event.status,
    last_synced_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
  await googleCalendarService.saveEventMapping(mappingData);

  // Update in-memory maps to prevent duplicates within this sync
  noteByGCalId.set(event.id, { id: noteId });
  mappingByGCalId.set(event.id, mappingData);

  return { action: 'imported' };
}

/**
 * Handle deleted events (events that are no longer in any synced calendar)
 */
async function handleDeletedEvents(
  mappings: GCalEventMapping[],
  seenEventIds: Set<string>,
  repository: IGoogleCalendarRepository
): Promise<number> {
  let deleted = 0;

  for (const mapping of mappings) {
    if (!seenEventIds.has(mapping.gcal_event_id)) {
      try {
        repository.markNotesAsDeleted([mapping.local_note_id]);
        await googleCalendarService.deleteEventMapping(mapping.gcal_event_id);
        deleted++;
      } catch (err) {
        console.error(`Error deleting mapping for ${mapping.gcal_event_id}:`, err);
      }
    }
  }

  return deleted;
}

/**
 * Show toast notification with sync result
 */
function showSyncResultToast(
  result: GCalSyncResult,
  t: ReturnType<typeof useTranslation>['t']
): void {
  if (result.success) {
    const hasChanges = result.eventsImported > 0 || result.eventsUpdated > 0 || result.eventsDeleted > 0;
    if (hasChanges) {
      toast.success(t('gcal.syncSuccess', {
        imported: result.eventsImported,
        updated: result.eventsUpdated,
        deleted: result.eventsDeleted,
      }));
    }
  } else if (result.errors.length > 0) {
    toast.error(t('gcal.syncError'), {
      description: result.errors.join(', '),
    });
  }
}

// ============================================================================
// Provider Component
// ============================================================================

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { store, isReady } = useTinyBase();
  const { user } = useAuth();
  const { syncNow: triggerSupabaseSync } = useSync();

  // Connection state
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<GCalError | null>(null);

  // Accounts & Calendars
  const [accounts, setAccounts] = useState<GCalAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [calendars, setCalendars] = useState<GCalCalendarWithAccount[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  // Config
  const [config, setConfig] = useState<GCalConfig | null>(null);

  // Sync state (grouped)
  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastResult: null,
  });

  // Refs
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  // Repository (memoized)
  const repository = useMemo(
    () => createGoogleCalendarRepository(store),
    [store]
  );

  // ============================================================================
  // Error Handling
  // ============================================================================

  const reportError = useCallback((
    type: ErrorType,
    message: string,
    options?: { showToast?: boolean }
  ) => {
    const newError: GCalError = {
      type,
      message,
      timestamp: Date.now(),
    };
    setError(newError);

    if (options?.showToast) {
      toast.error(message);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ============================================================================
  // Account Management
  // ============================================================================

  const refreshAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const accountsList = await googleCalendarService.getAccounts();
      setAccounts(accountsList);
      setIsConnected(accountsList.length > 0);
    } catch (err) {
      console.error('Error loading accounts:', err);
      reportError('connection', err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }, [reportError]);

  useEffect(() => {
    if (!user) {
      setIsConnected(false);
      setAccounts([]);
      setIsLoading(false);
      return;
    }

    const checkStatus = async () => {
      setIsLoading(true);
      try {
        const accountsList = await googleCalendarService.getAccounts();
        setAccounts(accountsList);

        const hasAccounts = accountsList.length > 0;
        setIsConnected(hasAccounts);

        // Legacy single-account fallback
        if (!hasAccounts) {
          const status = await googleCalendarService.getConnectionStatus();
          setIsConnected(status.isConnected && !status.isExpired);
        }

        const configData = await googleCalendarService.getConfig();
        setConfig(configData);
      } catch (err) {
        console.error('Error checking Google Calendar status:', err);
        reportError('connection', err instanceof Error ? err.message : 'Failed to check status');
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, [user, reportError]);

  // ============================================================================
  // Calendar Management
  // ============================================================================

  const refreshCalendars = useCallback(async () => {
    setLoadingCalendars(true);
    try {
      const result = await googleCalendarService.getAllCalendarsWithAccounts();

      if (result.calendars.length > 0) {
        setCalendars(result.calendars);
      } else if (result.error) {
        reportError('connection', result.error);
      } else {
        // Legacy fallback
        const legacyResult = await googleCalendarService.getCalendars();
        if (legacyResult.error) {
          reportError('connection', legacyResult.error);
        } else {
          setCalendars(legacyResult.calendars as GCalCalendarWithAccount[]);
        }
      }
    } catch (err) {
      console.error('Error refreshing calendars:', err);
      reportError('connection', err instanceof Error ? err.message : 'Failed to load calendars');
    } finally {
      setLoadingCalendars(false);
    }
  }, [reportError]);

  useEffect(() => {
    if (isConnected && !loadingCalendars && calendars.length === 0) {
      refreshCalendars();
    }
  }, [isConnected, loadingCalendars, calendars.length, refreshCalendars]);

  // ============================================================================
  // Sync Operations
  // ============================================================================

  const syncNow = useCallback(async (): Promise<GCalSyncResult> => {
    const result: GCalSyncResult = {
      success: false,
      eventsImported: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: [],
    };

    // Validate preconditions
    if (!store || !isReady || !isConnected || !config?.enabled) {
      result.errors.push('Not ready to sync');
      return result;
    }

    const projectsWithCalendarSync = repository.getProjectsWithCalendarSync();
    if (projectsWithCalendarSync.length === 0) {
      result.errors.push('No projects configured with calendar sync');
      return result;
    }

    setSyncState(prev => ({ ...prev, status: 'syncing' }));
    setError(null);
    lastSyncTimeRef.current = Date.now();

    const ctx: SyncContext = { store, user, repository };

    try {
      // Phase 1: Cleanup duplicates
      cleanupDuplicateNotes(repository);

      // Phase 2: Load sync data
      const mappings = await googleCalendarService.getEventMappings();
      const mappingByGCalId = new Map(mappings.map((m) => [m.gcal_event_id, m]));
      const noteByGCalId = repository.getAllNotesByGCalEventId();

      // Phase 3: Sync each project's calendar
      const seenEventIds = new Set<string>();

      for (const project of projectsWithCalendarSync) {
        const eventsResult = await fetchEventsForProject(project);

        if (eventsResult.error) {
          result.errors.push(`Error syncing calendar for project "${project.name}": ${eventsResult.error}`);
          continue;
        }

        for (const event of eventsResult.events) {
          if (seenEventIds.has(event.id)) continue;
          seenEventIds.add(event.id);

          const existingMapping = mappingByGCalId.get(event.id);
          const existingNoteInTinyBase = noteByGCalId.get(event.id) || null;

          try {
            const processResult = await processSingleEvent({
              event,
              project,
              existingMapping,
              existingNoteInTinyBase,
              ctx,
              mappingByGCalId,
              noteByGCalId,
            });

            if (processResult.action === 'imported') {
              result.eventsImported++;
            } else if (processResult.action === 'updated') {
              result.eventsUpdated++;
            }
          } catch (err) {
            console.error(`Error processing event ${event.id}:`, err);
            result.errors.push(`Failed to process event: ${event.summary}`);
          }
        }
      }

      // Phase 4: Handle deleted events
      result.eventsDeleted = await handleDeletedEvents(mappings, seenEventIds, repository);

      // Phase 5: Finalize
      await googleCalendarService.updateLastSyncTime();
      result.success = true;
      setSyncState({ status: 'success', lastResult: result });

      const newConfig = await googleCalendarService.getConfig();
      setConfig(newConfig);

      // Trigger Supabase sync if changes
      const hasChanges = result.eventsImported > 0 || result.eventsUpdated > 0 || result.eventsDeleted > 0;
      if (hasChanges) {
        triggerSupabaseSync().catch(err => {
          console.error('Error syncing to Supabase:', err);
        });
      }
    } catch (err) {
      console.error('Error during sync:', err);
      result.errors.push(err instanceof Error ? err.message : 'Unknown error');
      setSyncState(prev => ({ ...prev, status: 'error' }));
    }

    // Show toast and reset status
    showSyncResultToast(result, t);
    setSyncState(prev => ({ ...prev, lastResult: result }));

    setTimeout(() => {
      setSyncState(prev => ({ ...prev, status: 'idle' }));
    }, 3000);

    return result;
  }, [store, isReady, isConnected, config, user, t, triggerSupabaseSync, repository]);

  // Auto-sync interval
  useEffect(() => {
    if (!isConnected || !config?.enabled || !config.sync_interval_minutes) {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
      return;
    }

    const intervalMs = config.sync_interval_minutes * 60 * 1000;
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

  // Sync on visibility change
  useEffect(() => {
    if (!isConnected || !config?.enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
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

  // ============================================================================
  // OAuth & Connection
  // ============================================================================

  const connect = useCallback(() => {
    try {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
      const oauthUrl = googleCalendarService.getOAuthUrl(redirectUri);
      window.location.href = oauthUrl;
    } catch (err) {
      reportError('oauth', err instanceof Error ? err.message : 'Failed to start OAuth', { showToast: true });
    }
  }, [reportError]);

  const addAccount = useCallback(() => {
    try {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
      const oauthUrl = googleCalendarService.getOAuthUrl(redirectUri);
      sessionStorage.setItem('gcal_adding_account', 'true');
      window.location.href = oauthUrl;
    } catch (err) {
      reportError('oauth', err instanceof Error ? err.message : 'Failed to start OAuth', { showToast: true });
    }
  }, [reportError]);

  const removeAccount = useCallback(async (accountId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await googleCalendarService.removeAccount(accountId);
      if (!result.success) {
        reportError('connection', result.error || 'Failed to remove account', { showToast: true });
        return;
      }

      await refreshAccounts();
      await refreshCalendars();
      toast.success(t('gcal.accountRemoved', 'Google account removed'));
    } catch (err) {
      console.error('Error removing account:', err);
      reportError('connection', err instanceof Error ? err.message : 'Failed to remove account', { showToast: true });
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccounts, refreshCalendars, t, reportError]);

  const handleOAuthCallback = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    const isAddingAccount = sessionStorage.getItem('gcal_adding_account') === 'true';
    sessionStorage.removeItem('gcal_adding_account');

    try {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;

      if (isAddingAccount || accounts.length > 0) {
        const result = await googleCalendarService.addAccount(code, redirectUri);
        if (!result.success) {
          reportError('oauth', result.error || 'Failed to add account');
          return false;
        }
        toast.success(t('gcal.accountAdded', 'Google account connected: {{email}}', { email: result.account?.email }));
      } else {
        const result = await googleCalendarService.exchangeCodeForTokens(code, redirectUri);
        if (!result.success) {
          reportError('oauth', result.error || 'Failed to connect');
          return false;
        }
      }

      setIsConnected(true);
      await refreshAccounts();
      const configData = await googleCalendarService.getConfig();
      setConfig(configData);
      await refreshCalendars();

      return true;
    } catch (err) {
      console.error('Error handling OAuth callback:', err);
      reportError('oauth', err instanceof Error ? err.message : 'Failed to connect');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCalendars, refreshAccounts, accounts.length, t, reportError]);

  const disconnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await googleCalendarService.disconnect();
      if (!result.success) {
        reportError('connection', result.error || 'Failed to disconnect', { showToast: true });
        return;
      }

      setIsConnected(false);
      setCalendars([]);
      setConfig(null);
    } catch (err) {
      console.error('Error disconnecting:', err);
      reportError('connection', err instanceof Error ? err.message : 'Failed to disconnect', { showToast: true });
    } finally {
      setIsLoading(false);
    }
  }, [reportError]);

  // ============================================================================
  // Config Management
  // ============================================================================

  const updateConfig = useCallback(async (updates: Partial<GCalConfig>) => {
    try {
      const result = await googleCalendarService.updateConfig(updates);
      if (!result.success) {
        reportError('config', result.error || 'Failed to update config');
        return;
      }

      const newConfig = await googleCalendarService.getConfig();
      setConfig(newConfig);
    } catch (err) {
      console.error('Error updating config:', err);
      reportError('config', err instanceof Error ? err.message : 'Failed to update config');
    }
  }, [reportError]);

  // ============================================================================
  // Calendar Event Operations
  // ============================================================================

  const createCalendarEvent = useCallback(async (
    noteId: string,
    summary: string,
    description: string | null,
    deadline: string | null
  ): Promise<{ success: boolean; gcalEventId?: string; error?: string }> => {
    if (!isConnected || !config?.enabled) {
      return { success: false, error: 'Google Calendar not connected or sync not enabled' };
    }

    if (!config.calendars_to_sync || config.calendars_to_sync.length === 0) {
      return { success: false, error: 'No calendars selected for sync' };
    }

    const calendarId = config.calendars_to_sync[0];
    const { start, end } = parseDeadlineToEventTimes(deadline);

    try {
      const result = await googleCalendarService.createEvent({
        calendarId,
        summary,
        description: description || undefined,
        start,
        end,
      });

      if (result.error || !result.event) {
        return { success: false, error: result.error || 'Failed to create event' };
      }

      if (store && user) {
        const timestamp = now();
        store.setPartialRow('notes', noteId, {
          gcal_event_id: result.event.id,
          updated_at: timestamp,
        });

        await googleCalendarService.saveEventMapping({
          user_id: user.id,
          gcal_event_id: result.event.id,
          gcal_calendar_id: calendarId,
          local_note_id: noteId,
          etag: result.event.etag,
          event_status: result.event.status,
          last_synced_at: new Date().toISOString(),
        });
      }

      toast.success(t('gcal.eventCreated'));
      triggerSupabaseSync().catch(err => {
        console.error('Error syncing to Supabase after creating event:', err);
      });

      return { success: true, gcalEventId: result.event.id };
    } catch (err) {
      console.error('Error creating calendar event:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(t('gcal.eventCreateError'), { description: errorMsg });
      return { success: false, error: errorMsg };
    }
  }, [isConnected, config, store, user, t, triggerSupabaseSync]);

  const updateCalendarEvent = useCallback(async (
    gcalEventId: string,
    summary: string,
    description: string | null,
    deadline: string | null
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isConnected || !config?.enabled) {
      return { success: false, error: 'Google Calendar not connected or sync not enabled' };
    }

    if (!config.calendars_to_sync || config.calendars_to_sync.length === 0) {
      return { success: false, error: 'No calendars selected for sync' };
    }

    const calendarId = config.calendars_to_sync[0];
    const times = deadline ? parseDeadlineToEventTimes(deadline) : { start: undefined, end: undefined };

    try {
      const result = await googleCalendarService.updateEvent(calendarId, gcalEventId, {
        summary,
        description: description || undefined,
        start: times.start,
        end: times.end,
      });

      if (result.error) {
        return { success: false, error: result.error };
      }

      return { success: true };
    } catch (err) {
      console.error('Error updating calendar event:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [isConnected, config]);

  const deleteCalendarEvent = useCallback(async (
    gcalEventId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isConnected || !config?.enabled) {
      return { success: false, error: 'Google Calendar not connected or sync not enabled' };
    }

    if (!config.calendars_to_sync || config.calendars_to_sync.length === 0) {
      return { success: false, error: 'No calendars selected for sync' };
    }

    const calendarId = config.calendars_to_sync[0];

    try {
      const result = await googleCalendarService.deleteEvent(calendarId, gcalEventId);

      if (!result.success) {
        return { success: false, error: result.error };
      }

      await googleCalendarService.deleteEventMapping(gcalEventId);
      return { success: true };
    } catch (err) {
      console.error('Error deleting calendar event:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [isConnected, config]);

  // ============================================================================
  // Context Value
  // ============================================================================

  const value: UseGoogleCalendarReturn = {
    isConnected,
    isLoading,
    error,
    accounts,
    loadingAccounts,
    calendars,
    loadingCalendars,
    config,
    syncStatus: syncState.status,
    lastSyncResult: syncState.lastResult,
    connect,
    addAccount,
    removeAccount,
    disconnect,
    refreshCalendars,
    refreshAccounts,
    updateConfig,
    syncNow,
    handleOAuthCallback,
    clearError,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
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

// ============================================================================
// Helper Functions
// ============================================================================

function parseDeadlineToEventTimes(deadline: string | null): {
  start: GCalCreateEventRequest['start'];
  end: GCalCreateEventRequest['end'];
} {
  if (deadline) {
    if (deadline.includes('T') && !deadline.endsWith('T00:00:00')) {
      // Timed event
      const startDate = new Date(deadline);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      return {
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
      };
    } else {
      // All-day event
      const dateOnly = deadline.split('T')[0];
      return {
        start: { date: dateOnly },
        end: { date: dateOnly },
      };
    }
  }

  // No deadline, create all-day event for today
  const today = new Date().toISOString().split('T')[0];
  return {
    start: { date: today },
    end: { date: today },
  };
}

async function createNoteFromEvent(
  store: ReturnType<typeof useTinyBase>['store'],
  event: GCalEvent,
  projectId: string | null = null
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
    category: 'meeting',
    completed: false,
    completed_at: null,
    deadline,
    pinned: false,
    sort_order: 0,
    assignee_id: null,
    project_id: projectId,
    created_at: timestamp,
    updated_at: timestamp,
    deleted_at: null,
    remote_id: null,
    sync_status: 'pending',
    last_synced_at: null,
    gcal_event_id: event.id,
  });

  const historyId = generateId();
  store.setRow('note_history', historyId, {
    note_id: id,
    content: event.summary || 'Untitled Event',
    description: event.description || null,
    category: 'meeting',
    completed: false,
    changed_at: timestamp,
    action_type: 'created',
    reason: 'Imported from Google Calendar',
    previous_date: null,
    created_at: timestamp,
    remote_id: null,
    sync_status: 'local',
    last_synced_at: null,
  });

  return id;
}

async function updateNoteFromEvent(
  store: ReturnType<typeof useTinyBase>['store'],
  noteId: string,
  event: GCalEvent,
  projectId: string | null = null
): Promise<void> {
  if (!store) return;

  const existingNote = store.getRow('notes', noteId);
  if (!existingNote) return;

  const timestamp = now();

  const isAllDay = !event.start.dateTime;
  const deadline = isAllDay
    ? `${event.start.date}T00:00:00`
    : event.start.dateTime!;

  const updates: Record<string, unknown> = {
    content: event.summary || 'Untitled Event',
    description: event.description || null,
    deadline,
    category: 'meeting',
    updated_at: timestamp,
    sync_status: 'pending',
    gcal_event_id: event.id,
  };

  if (projectId !== null) {
    updates.project_id = projectId;
  }

  store.setPartialRow('notes', noteId, updates as Record<string, string | number | boolean | null>);

  const historyId = generateId();
  store.setRow('note_history', historyId, {
    note_id: noteId,
    content: event.summary || 'Untitled Event',
    description: event.description || null,
    category: 'meeting',
    completed: existingNote.completed as boolean,
    changed_at: timestamp,
    action_type: 'edit',
    reason: 'Updated from Google Calendar',
    previous_date: null,
    created_at: timestamp,
    remote_id: null,
    sync_status: 'local',
    last_synced_at: null,
  });
}
