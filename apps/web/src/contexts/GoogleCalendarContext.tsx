import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { googleCalendarService } from '@/services/googleCalendarService';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import type {
  GCalCalendarWithAccount,
  GCalConfig,
  GCalSyncStatus,
  GCalSyncResult,
  GCalCreateEventRequest,
  GCalAccount,
} from '@/types/googleCalendar';

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
  isConnected: boolean;
  isLoading: boolean;
  error: GCalError | null;
  accounts: GCalAccount[];
  loadingAccounts: boolean;
  calendars: GCalCalendarWithAccount[];
  loadingCalendars: boolean;
  config: GCalConfig | null;
  syncStatus: GCalSyncStatus;
  lastSyncResult: GCalSyncResult | null;
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
// Helper Functions
// ============================================================================

function parseDeadlineToEventTimes(deadline: string | null): {
  start: GCalCreateEventRequest['start'];
  end: GCalCreateEventRequest['end'];
} {
  if (deadline) {
    if (deadline.includes('T') && !deadline.endsWith('T00:00:00')) {
      const startDate = new Date(deadline);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      return {
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() },
      };
    } else {
      const dateOnly = deadline.split('T')[0];
      return {
        start: { date: dateOnly },
        end: { date: dateOnly },
      };
    }
  }

  const today = new Date().toISOString().split('T')[0];
  return {
    start: { date: today },
    end: { date: today },
  };
}

// Note: createNoteFromEvent, updateNoteFromEvent, getProjectsWithCalendarSync,
// getNoteByGCalEventId, and markNoteAsDeleted have been moved to the backend
// (apps/api/src/lib/gcal-sync.js). The frontend now calls POST /api/gcal-sync.

// ============================================================================
// Provider Component
// ============================================================================

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;

  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<GCalError | null>(null);

  const [accounts, setAccounts] = useState<GCalAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [calendars, setCalendars] = useState<GCalCalendarWithAccount[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  const [config, setConfig] = useState<GCalConfig | null>(null);

  const [syncState, setSyncState] = useState<SyncState>({
    status: 'idle',
    lastResult: null,
  });

  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  const reportError = useCallback((type: ErrorType, message: string, options?: { showToast?: boolean }) => {
    setError({ type, message, timestamp: Date.now() });
    if (options?.showToast) toast.error(message);
  }, []);

  const clearError = useCallback(() => setError(null), []);

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
      reportError('connection', err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }, [reportError]);

  useEffect(() => {
    if (!userId) {
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
        const connected = accountsList.length > 0;
        setIsConnected(connected);

        // Only fetch config if user has Google Calendar accounts connected.
        // This avoids unnecessary queries to google_calendar_config on every page load.
        if (connected) {
          const configData = await googleCalendarService.getConfig();
          setConfig(configData);
        }
      } catch (err) {
        reportError('connection', err instanceof Error ? err.message : 'Failed to check status');
      } finally {
        setIsLoading(false);
      }
    };

    checkStatus();
  }, [userId, reportError]);

  // ============================================================================
  // Calendar Management
  // ============================================================================

  const refreshCalendars = useCallback(async (preloadedAccounts?: GCalAccount[]) => {
    setLoadingCalendars(true);
    try {
      const result = await googleCalendarService.getAllCalendarsWithAccounts(preloadedAccounts);
      if (result.calendars.length > 0) {
        setCalendars(result.calendars);
      } else if (result.error) {
        reportError('connection', result.error);
      }
    } catch (err) {
      reportError('connection', err instanceof Error ? err.message : 'Failed to load calendars');
    } finally {
      setLoadingCalendars(false);
    }
  }, [reportError]);

  // Fetch calendars once when connected — uses accounts from state to avoid re-fetching.
  const accountsRef = useRef(accounts);
  accountsRef.current = accounts;

  useEffect(() => {
    if (isConnected && !loadingCalendars && calendars.length === 0) {
      refreshCalendars(accountsRef.current);
    }
  }, [isConnected, loadingCalendars, calendars.length, refreshCalendars]);

  // ============================================================================
  // Sync Operations
  // ============================================================================

  const syncNow = useCallback(async (): Promise<GCalSyncResult> => {
    const emptyResult: GCalSyncResult = {
      success: false,
      eventsImported: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
      errors: [],
    };

    if (!userId || !isConnected || !config?.enabled) {
      emptyResult.errors.push('Not ready to sync');
      return emptyResult;
    }

    setSyncState(prev => ({ ...prev, status: 'syncing' }));
    setError(null);
    lastSyncTimeRef.current = Date.now();

    try {
      const result = await googleCalendarService.triggerSync();
      setSyncState({ status: 'success', lastResult: result });

      // Refresh config to get updated last_sync_at
      const newConfig = await googleCalendarService.getConfig();
      setConfig(newConfig);

      if (result.eventsImported > 0 || result.eventsUpdated > 0 || result.eventsDeleted > 0) {
        toast.success(t('gcal.syncSuccess', {
          imported: result.eventsImported,
          updated: result.eventsUpdated,
          deleted: result.eventsDeleted,
        }));
      }

      return result;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      emptyResult.errors.push(errorMsg);
      setSyncState(prev => ({ ...prev, status: 'error' }));
      return emptyResult;
    } finally {
      setTimeout(() => setSyncState(prev => ({ ...prev, status: 'idle' })), 3000);
    }
  }, [userId, isConnected, config, t]);

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
    syncIntervalRef.current = setInterval(() => syncNow(), intervalMs);

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [isConnected, config?.enabled, config?.sync_interval_minutes, syncNow]);

  // ============================================================================
  // OAuth & Connection
  // ============================================================================

  const connect = useCallback(() => {
    try {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
      window.location.href = googleCalendarService.getOAuthUrl(redirectUri);
    } catch (err) {
      reportError('oauth', err instanceof Error ? err.message : 'Failed to start OAuth', { showToast: true });
    }
  }, [reportError]);

  const addAccount = useCallback(() => {
    try {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
      sessionStorage.setItem('gcal_adding_account', 'true');
      window.location.href = googleCalendarService.getOAuthUrl(redirectUri);
    } catch (err) {
      reportError('oauth', err instanceof Error ? err.message : 'Failed to start OAuth', { showToast: true });
    }
  }, [reportError]);

  const removeAccount = useCallback(async (accountId: string) => {
    setIsLoading(true);
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
      reportError('connection', err instanceof Error ? err.message : 'Failed to remove account', { showToast: true });
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccounts, refreshCalendars, t, reportError]);

  const handleOAuthCallback = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true);
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
        toast.success(t('gcal.accountAdded', 'Google account connected'));
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
      reportError('oauth', err instanceof Error ? err.message : 'Failed to connect');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [refreshCalendars, refreshAccounts, accounts.length, t, reportError]);

  const disconnect = useCallback(async () => {
    setIsLoading(true);
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
      reportError('connection', err instanceof Error ? err.message : 'Failed to disconnect', { showToast: true });
    } finally {
      setIsLoading(false);
    }
  }, [reportError]);

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
    if (!isConnected || !config?.enabled || !userId) {
      return { success: false, error: 'Google Calendar not connected' };
    }

    if (!config.calendars_to_sync?.length) {
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

      if (supabase) {
        await supabase.from('notes').update({ gcal_event_id: result.event.id }).eq('id', noteId);

        await googleCalendarService.saveEventMapping({
          user_id: userId,
          gcal_event_id: result.event.id,
          gcal_calendar_id: calendarId,
          local_note_id: noteId,
          etag: result.event.etag,
          event_status: result.event.status,
          last_synced_at: new Date().toISOString(),
        });
      }

      toast.success(t('gcal.eventCreated'));
      return { success: true, gcalEventId: result.event.id };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(t('gcal.eventCreateError'), { description: errorMsg });
      return { success: false, error: errorMsg };
    }
  }, [isConnected, config, userId, t]);

  const updateCalendarEvent = useCallback(async (
    gcalEventId: string,
    summary: string,
    description: string | null,
    deadline: string | null
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isConnected || !config?.enabled) {
      return { success: false, error: 'Google Calendar not connected' };
    }

    if (!config.calendars_to_sync?.length) {
      return { success: false, error: 'No calendars selected' };
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

      return result.error ? { success: false, error: result.error } : { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [isConnected, config]);

  const deleteCalendarEvent = useCallback(async (gcalEventId: string): Promise<{ success: boolean; error?: string }> => {
    if (!isConnected || !config?.enabled) {
      return { success: false, error: 'Google Calendar not connected' };
    }

    if (!config.calendars_to_sync?.length) {
      return { success: false, error: 'No calendars selected' };
    }

    const calendarId = config.calendars_to_sync[0];

    try {
      const result = await googleCalendarService.deleteEvent(calendarId, gcalEventId);
      if (!result.success) return { success: false, error: result.error };

      await googleCalendarService.deleteEventMapping(gcalEventId);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }, [isConnected, config]);

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
