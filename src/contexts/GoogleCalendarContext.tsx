import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { googleCalendarService } from '@/services/googleCalendarService';
import { generateId, now } from '@/store/schema';
import { toast } from 'sonner';
import type {
  GCalCalendarWithAccount,
  GCalConfig,
  GCalEvent,
  GCalSyncStatus,
  GCalSyncResult,
  GCalCreateEventRequest,
  GCalAccount,
} from '@/types/googleCalendar';
import type { Project } from '@/types/project';


const OAUTH_REDIRECT_PATH = '/settings/calendar/callback';

export interface UseGoogleCalendarReturn {
  // Connection state
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

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

export function GoogleCalendarProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { store, isReady } = useTinyBase();
  const { user } = useAuth();
  const { syncNow: triggerSupabaseSync } = useSync();

  // State
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<GCalAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [calendars, setCalendars] = useState<GCalCalendarWithAccount[]>([]);
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
   * Load accounts
   */
  const refreshAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const accountsList = await googleCalendarService.getAccounts();
      setAccounts(accountsList);
      // Connected if we have at least one account
      setIsConnected(accountsList.length > 0);
    } catch (err) {
      console.error('Error loading accounts:', err);
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  /**
   * Check connection status on mount and when user changes
   */
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
        // Load accounts (multi-account support)
        const accountsList = await googleCalendarService.getAccounts();
        setAccounts(accountsList);

        // Connected if we have at least one account
        const hasAccounts = accountsList.length > 0;
        setIsConnected(hasAccounts);

        // Also check legacy single-account connection for backwards compatibility
        if (!hasAccounts) {
          const status = await googleCalendarService.getConnectionStatus();
          setIsConnected(status.isConnected && !status.isExpired);
        }

        // Load config
        const configData = await googleCalendarService.getConfig();
        setConfig(configData);
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
   * Refresh calendars list from all accounts
   */
  const refreshCalendars = useCallback(async () => {
    setLoadingCalendars(true);
    try {
      // First try multi-account method
      const result = await googleCalendarService.getAllCalendarsWithAccounts();

      if (result.calendars.length > 0) {
        setCalendars(result.calendars);
      } else if (result.error) {
        setError(result.error);
      } else {
        // Fall back to legacy single-account method if no accounts found
        const legacyResult = await googleCalendarService.getCalendars();
        if (legacyResult.error) {
          setError(legacyResult.error);
        } else {
          // Convert legacy calendars to the new format (without account info)
          setCalendars(legacyResult.calendars as GCalCalendarWithAccount[]);
        }
      }
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
   * Get projects with calendar sync enabled from TinyBase
   */
  const getProjectsWithCalendarSync = useCallback((): Project[] => {
    if (!store || !isReady) return [];

    const projectsTable = store.getTable('projects') || {};
    const projectsWithSync: Project[] = [];

    for (const [id, row] of Object.entries(projectsTable)) {
      const projectRow = row as Record<string, unknown>;
      if (projectRow.gcal_calendar_id && !projectRow.deleted_at) {
        projectsWithSync.push({
          id,
          name: projectRow.name as string,
          description: (projectRow.description as string) || null,
          color: (projectRow.color as string) || '#6b7280',
          icon: (projectRow.icon as string) || null,
          status: (projectRow.status as Project['status']) || 'active',
          sort_order: (projectRow.sort_order as number) || 0,
          created_at: projectRow.created_at as string,
          updated_at: projectRow.updated_at as string,
          deleted_at: null,
          gcal_calendar_id: projectRow.gcal_calendar_id as string,
          gcal_account_id: (projectRow.gcal_account_id as string) || null,
        });
      }
    }

    return projectsWithSync;
  }, [store, isReady]);

  /**
   * Sync events from Google Calendar to notes
   * Now syncs per-project based on each project's gcal_calendar_id
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

    // Get projects with calendar sync enabled
    const projectsWithCalendarSync = getProjectsWithCalendarSync();

    if (projectsWithCalendarSync.length === 0) {
      result.errors.push('No projects configured with calendar sync');
      return result;
    }

    setSyncStatus('syncing');
    setError(null);
    lastSyncTimeRef.current = Date.now();

    try {
      // First, clean up any duplicate notes with the same gcal_event_id
      const allNotes = store.getTable('notes') || {};
      const gcalIdToNoteIds = new Map<string, string[]>();
      for (const [noteId, noteRow] of Object.entries(allNotes)) {
        const row = noteRow as Record<string, unknown>;
        const gcalEventId = row.gcal_event_id as string | null;
        if (gcalEventId) {
          const existing = gcalIdToNoteIds.get(gcalEventId) || [];
          existing.push(noteId);
          gcalIdToNoteIds.set(gcalEventId, existing);
        }
      }
      // Mark duplicates as deleted (keep only the first one)
      for (const noteIds of gcalIdToNoteIds.values()) {
        if (noteIds.length > 1) {
          // Keep the first, delete the rest
          for (let i = 1; i < noteIds.length; i++) {
            const timestamp = now();
            store.setPartialRow('notes', noteIds[i], {
              deleted_at: timestamp,
              updated_at: timestamp,
              sync_status: 'pending',
            });
          }
        }
      }

      // Get existing event mappings from Supabase
      const mappings = await googleCalendarService.getEventMappings();
      const mappingByGCalId = new Map(mappings.map((m) => [m.gcal_event_id, m]));

      // Build a map of existing notes by gcal_event_id from TinyBase (fallback for duplicates)
      const notesTable = store.getTable('notes') || {};
      const noteByGCalId = new Map<string, { id: string; etag?: string }>();
      for (const [noteId, noteRow] of Object.entries(notesTable)) {
        const row = noteRow as Record<string, unknown>;
        const gcalEventId = row.gcal_event_id as string | null;
        if (gcalEventId && !row.deleted_at) {
          noteByGCalId.set(gcalEventId, { id: noteId });
        }
      }

      // Track which events we've seen across all projects
      const seenEventIds = new Set<string>();

      // Sync each project's calendar
      for (const project of projectsWithCalendarSync) {
        const calendarId = project.gcal_calendar_id!;
        const accountId = project.gcal_account_id;

        // Fetch events from this project's calendar
        let eventsResult: { events: GCalEvent[]; error?: string };

        if (accountId) {
          // Use account-specific API for multi-account support
          eventsResult = await googleCalendarService.getEventsForAccount(accountId, {
            calendarIds: [calendarId],
          });
        } else {
          // Fall back to legacy single-account method
          eventsResult = await googleCalendarService.getEvents({
            calendarIds: [calendarId],
          });
        }

        if (eventsResult.error) {
          result.errors.push(`Error syncing calendar for project "${project.name}": ${eventsResult.error}`);
          continue;
        }

        const events = eventsResult.events;

        // Process each event - all Google Calendar events become meetings
        for (const event of events) {
          // Skip events already processed by another project in this sync
          if (seenEventIds.has(event.id)) continue;
          seenEventIds.add(event.id);
          const existingMapping = mappingByGCalId.get(event.id);
          // Fallback: check if note already exists in TinyBase with this gcal_event_id
          const existingNoteInTinyBase = noteByGCalId.get(event.id);

          try {
            if (existingMapping) {
              // Check if event was updated or category needs fixing
              const note = store.getRow('notes', existingMapping.local_note_id);
              const needsUpdate = existingMapping.etag !== event.etag || (note && note.category !== 'meeting');

              if (needsUpdate) {
                await updateNoteFromEvent(store, existingMapping.local_note_id, event, project.id);
                await googleCalendarService.saveEventMapping({
                  user_id: existingMapping.user_id,
                  gcal_event_id: event.id,
                  gcal_calendar_id: calendarId,
                  local_note_id: existingMapping.local_note_id,
                  etag: event.etag,
                  event_status: event.status,
                  last_synced_at: new Date().toISOString(),
                });
                result.eventsUpdated++;
              }
            } else if (existingNoteInTinyBase) {
              // Note exists in TinyBase but mapping was lost - recreate mapping
              await updateNoteFromEvent(store, existingNoteInTinyBase.id, event, project.id);
              await googleCalendarService.saveEventMapping({
                user_id: user!.id,
                gcal_event_id: event.id,
                gcal_calendar_id: calendarId,
                local_note_id: existingNoteInTinyBase.id,
                etag: event.etag,
                event_status: event.status,
                last_synced_at: new Date().toISOString(),
              });
              result.eventsUpdated++;
            } else {
              // Create new meeting from event with project assignment
              const noteId = await createNoteFromEvent(store, event, project.id);
              const mappingData = {
                user_id: user!.id,
                gcal_event_id: event.id,
                gcal_calendar_id: calendarId,
                local_note_id: noteId,
                etag: event.etag,
                event_status: event.status,
                last_synced_at: new Date().toISOString(),
              };
              await googleCalendarService.saveEventMapping(mappingData);
              // Update in-memory maps to prevent duplicates within this sync
              noteByGCalId.set(event.id, { id: noteId });
              mappingByGCalId.set(event.id, mappingData as typeof mappings[0]);
              result.eventsImported++;
            }
          } catch (err) {
            console.error(`Error processing event ${event.id}:`, err);
            result.errors.push(`Failed to process event: ${event.summary}`);
          }
        }
      }

      // Handle deleted events (events that are no longer in any synced calendar)
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

      // Trigger Supabase sync to push the new meetings to the cloud
      const hasChanges = result.eventsImported > 0 || result.eventsUpdated > 0 || result.eventsDeleted > 0;
      if (hasChanges) {
        triggerSupabaseSync().catch(err => {
          console.error('Error syncing to Supabase:', err);
        });
      }
    } catch (err) {
      console.error('Error during sync:', err);
      result.errors.push(err instanceof Error ? err.message : 'Unknown error');
      setSyncStatus('error');
    }

    setLastSyncResult(result);

    // Show toast notification with sync result
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

    // Reset status after delay
    setTimeout(() => {
      setSyncStatus('idle');
    }, 3000);

    return result;
  }, [store, isReady, isConnected, config, user, t, triggerSupabaseSync, getProjectsWithCalendarSync]);

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
   * Initiate OAuth flow (connect first account or legacy single account)
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
   * Add a new Google account (multi-account support)
   */
  const addAccount = useCallback(() => {
    try {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;
      // Use the same OAuth URL but the callback will handle adding as a new account
      const oauthUrl = googleCalendarService.getOAuthUrl(redirectUri);
      // Store a flag in sessionStorage to indicate we're adding an account
      sessionStorage.setItem('gcal_adding_account', 'true');
      window.location.href = oauthUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start OAuth');
    }
  }, []);

  /**
   * Remove a Google account
   */
  const removeAccount = useCallback(async (accountId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await googleCalendarService.removeAccount(accountId);
      if (!result.success) {
        setError(result.error || 'Failed to remove account');
        return;
      }

      // Refresh accounts and calendars
      await refreshAccounts();
      await refreshCalendars();

      toast.success(t('gcal.accountRemoved', 'Google account removed'));
    } catch (err) {
      console.error('Error removing account:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove account');
    } finally {
      setIsLoading(false);
    }
  }, [refreshAccounts, refreshCalendars, t]);

  /**
   * Handle OAuth callback
   */
  const handleOAuthCallback = useCallback(async (code: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    // Check if we're adding a new account
    const isAddingAccount = sessionStorage.getItem('gcal_adding_account') === 'true';
    sessionStorage.removeItem('gcal_adding_account');

    try {
      const redirectUri = `${window.location.origin}${OAUTH_REDIRECT_PATH}`;

      if (isAddingAccount || accounts.length > 0) {
        // Multi-account: add as a new account
        const result = await googleCalendarService.addAccount(code, redirectUri);

        if (!result.success) {
          setError(result.error || 'Failed to add account');
          return false;
        }

        toast.success(t('gcal.accountAdded', 'Google account connected: {{email}}', { email: result.account?.email }));
      } else {
        // Legacy: first connection or single account mode
        const result = await googleCalendarService.exchangeCodeForTokens(code, redirectUri);

        if (!result.success) {
          setError(result.error || 'Failed to connect');
          return false;
        }
      }

      setIsConnected(true);

      // Load accounts, config and calendars
      await refreshAccounts();
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
  }, [refreshCalendars, refreshAccounts, accounts.length, t]);

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

  /**
   * Create a calendar event from a meeting note
   */
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

    // Parse deadline or use current date for all-day event
    let start: GCalCreateEventRequest['start'];
    let end: GCalCreateEventRequest['end'];

    if (deadline) {
      // Check if it's a full datetime or just a date
      if (deadline.includes('T') && !deadline.endsWith('T00:00:00')) {
        // Timed event
        const startDate = new Date(deadline);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour duration
        start = { dateTime: startDate.toISOString() };
        end = { dateTime: endDate.toISOString() };
      } else {
        // All-day event
        const dateOnly = deadline.split('T')[0];
        start = { date: dateOnly };
        end = { date: dateOnly };
      }
    } else {
      // No deadline, create all-day event for today
      const today = new Date().toISOString().split('T')[0];
      start = { date: today };
      end = { date: today };
    }

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

      // Save the mapping and update the note with gcal_event_id
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

      // Trigger Supabase sync to push the updated note to the cloud
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

  /**
   * Update an existing calendar event
   */
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

    // Parse deadline
    let start: GCalCreateEventRequest['start'] | undefined;
    let end: GCalCreateEventRequest['end'] | undefined;

    if (deadline) {
      if (deadline.includes('T') && !deadline.endsWith('T00:00:00')) {
        const startDate = new Date(deadline);
        const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
        start = { dateTime: startDate.toISOString() };
        end = { dateTime: endDate.toISOString() };
      } else {
        const dateOnly = deadline.split('T')[0];
        start = { date: dateOnly };
        end = { date: dateOnly };
      }
    }

    try {
      const result = await googleCalendarService.updateEvent(calendarId, gcalEventId, {
        summary,
        description: description || undefined,
        start,
        end,
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

  /**
   * Delete a calendar event
   */
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

      // Delete the mapping
      await googleCalendarService.deleteEventMapping(gcalEventId);

      return { success: true };
    } catch (err) {
      console.error('Error deleting calendar event:', err);
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
    syncStatus,
    lastSyncResult,
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

// Helper functions

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

  // All events from Google Calendar are created as meetings
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

  // Save initial history entry
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

  // Update project_id if provided
  if (projectId !== null) {
    updates.project_id = projectId;
  }

  store.setPartialRow('notes', noteId, updates as Record<string, string | number | boolean | null>);

  // Save history entry
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

