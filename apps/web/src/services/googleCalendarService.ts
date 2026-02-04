import { supabase } from '@/lib/supabase';
import { fetchWithRetry } from '@/lib/fetchWithRetry';
import type {
  GCalCalendar,
  GCalEvent,
  GCalConfig,
  GCalEventMapping,
  GCalCalendarsResponse,
  GCalEventsResponse,
  GCalEventsRequest,
  GCalCreateEventRequest,
  GCalCreateEventResponse,
  GCalAccount,
  GCalCalendarWithAccount,
} from '@/types/googleCalendar';

/**
 * Get the current user from the cached session (no network call).
 * Unlike supabase.auth.getUser() which always hits auth/v1/user,
 * getSession() reads from the local session cache.
 */
async function getCachedUser() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user ?? null;
}

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

/**
 * Get the API base URL (same origin in production, or configurable for dev)
 */
function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Get access token from Supabase session
 */
async function getAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

/**
 * Call an API endpoint with authentication
 */
async function callApi<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}/api/${endpoint}`;
  const token = await getAccessToken();

  const response = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  // Handle non-JSON responses (e.g., 404 from server not having the endpoint)
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`API endpoint not available: ${response.status}`);
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `API call failed: ${response.status}`);
  }

  return data as T;
}

class GoogleCalendarService {
  /**
   * Generate the OAuth URL for connecting Google Calendar
   */
  getOAuthUrl(redirectUri: string): string {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new Error('VITE_GOOGLE_CLIENT_ID is not configured');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_CALENDAR_SCOPES,
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
    });

    return `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      await callApi('gcal-auth', {
        action: 'exchange',
        code,
        redirectUri,
      });

      return { success: true };
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Check if Google Calendar is connected
   */
  async getConnectionStatus(): Promise<{ isConnected: boolean; isExpired: boolean }> {
    if (!supabase) {
      return { isConnected: false, isExpired: false };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { isConnected: false, isExpired: false };
      }

      const result = await callApi<{ isConnected: boolean; isExpired: boolean }>('gcal-auth', {
        action: 'status',
      });

      return result;
    } catch (error) {
      console.error('Error checking connection status:', error);
      return { isConnected: false, isExpired: false };
    }
  }

  /**
   * Disconnect Google Calendar
   */
  async disconnect(): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      await callApi('gcal-auth', { action: 'disconnect' });
      return { success: true };
    } catch (error) {
      console.error('Error disconnecting:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get list of user's Google Calendars
   */
  async getCalendars(): Promise<{ calendars: GCalCalendar[]; error?: string }> {
    if (!supabase) {
      return { calendars: [], error: 'Supabase not configured' };
    }

    try {
      const result = await callApi<GCalCalendarsResponse>('gcal-calendars', {});
      return { calendars: result.calendars || [] };
    } catch (error) {
      console.error('Error fetching calendars:', error);
      return { calendars: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get events from selected calendars
   */
  async getEvents(request: GCalEventsRequest): Promise<{ events: GCalEvent[]; error?: string }> {
    if (!supabase) {
      return { events: [], error: 'Supabase not configured' };
    }

    try {
      const result = await callApi<GCalEventsResponse>('gcal-events', request as unknown as Record<string, unknown>);
      return { events: result.events || [] };
    } catch (error) {
      console.error('Error fetching events:', error);
      return { events: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get user's Google Calendar config
   */
  async getConfig(): Promise<GCalConfig | null> {
    if (!supabase) return null;

    try {
      const user = await getCachedUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('google_calendar_config')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching config:', error);
        return null;
      }

      if (!data) {
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const typedData = data as any;
      return {
        ...typedData,
        calendars_to_sync: typedData.calendars_to_sync || [],
      } as GCalConfig;
    } catch (error) {
      console.error('Error fetching config:', error);
      return null;
    }
  }

  /**
   * Update user's Google Calendar config
   */
  async updateConfig(config: Partial<GCalConfig>): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const user = await getCachedUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('google_calendar_config')
        .upsert({
          user_id: user.id,
          ...config,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating config:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get event mappings for the user
   */
  async getEventMappings(): Promise<GCalEventMapping[]> {
    if (!supabase) return [];

    try {
      const user = await getCachedUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('google_calendar_events')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error('Error fetching event mappings:', error);
        return [];
      }

      return data as GCalEventMapping[];
    } catch (error) {
      console.error('Error fetching event mappings:', error);
      return [];
    }
  }

  /**
   * Save or update an event mapping
   */
  async saveEventMapping(mapping: Omit<GCalEventMapping, 'id' | 'created_at'>): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any)
        .from('google_calendar_events')
        .upsert(mapping, {
          onConflict: 'user_id,gcal_event_id',
        });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error saving event mapping:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Delete an event mapping
   */
  async deleteEventMapping(gcalEventId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const user = await getCachedUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('google_calendar_events')
        .delete()
        .eq('user_id', user.id)
        .eq('gcal_event_id', gcalEventId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting event mapping:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update last sync timestamp
   */
  async updateLastSyncTime(): Promise<void> {
    if (!supabase) return;

    try {
      const user = await getCachedUser();
      if (!user) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('google_calendar_config')
        .update({
          last_sync_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error updating last sync time:', error);
    }
  }

  /**
   * Create a new event in Google Calendar
   */
  async createEvent(request: GCalCreateEventRequest): Promise<GCalCreateEventResponse> {
    if (!supabase) {
      return { error: 'Supabase not configured' };
    }

    try {
      const result = await callApi<{ event: GCalEvent }>('gcal-create-event', request as unknown as Record<string, unknown>);
      return { event: result.event };
    } catch (error) {
      console.error('Error creating event:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Update an existing event in Google Calendar
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    updates: Partial<Omit<GCalCreateEventRequest, 'calendarId'>>
  ): Promise<GCalCreateEventResponse> {
    if (!supabase) {
      return { error: 'Supabase not configured' };
    }

    try {
      const result = await callApi<{ event: GCalEvent }>('gcal-update-event', {
        calendarId,
        eventId,
        ...updates,
      });
      return { event: result.event };
    } catch (error) {
      console.error('Error updating event:', error);
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Delete an event from Google Calendar
   */
  async deleteEvent(calendarId: string, eventId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      await callApi<{ success: boolean }>('gcal-delete-event', {
        calendarId,
        eventId,
      });
      return { success: true };
    } catch (error) {
      console.error('Error deleting event:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Trigger a full calendar sync on the backend.
   * Replaces the previous frontend-side sync logic.
   */
  async triggerSync(): Promise<{ success: boolean; eventsImported: number; eventsUpdated: number; eventsDeleted: number; errors: string[] }> {
    return callApi('gcal-sync', {});
  }

  // ============================================
  // Multi-account support methods
  // ============================================

  /**
   * Get all connected Google Calendar accounts for the user
   */
  async getAccounts(): Promise<GCalAccount[]> {
    if (!supabase) return [];

    try {
      const user = await getCachedUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('google_calendar_accounts')
        .select('id, user_id, email, display_name, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching accounts:', error);
        return [];
      }

      return data as GCalAccount[];
    } catch (error) {
      console.error('Error fetching accounts:', error);
      return [];
    }
  }

  /**
   * Exchange authorization code for tokens and create a new account
   */
  async addAccount(code: string, redirectUri: string): Promise<{ success: boolean; account?: GCalAccount; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        return { success: false, error: 'Not authenticated' };
      }

      const result = await callApi<{ account: GCalAccount }>('gcal-auth', {
        action: 'add_account',
        code,
        redirectUri,
      });

      return { success: true, account: result.account };
    } catch (error) {
      console.error('Error adding account:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Remove a connected Google Calendar account
   */
  async removeAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const user = await getCachedUser();
      if (!user) {
        return { success: false, error: 'Not authenticated' };
      }

      const { error } = await supabase
        .from('google_calendar_accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error removing account:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get calendars for a specific account
   */
  async getCalendarsForAccount(accountId: string): Promise<{ calendars: GCalCalendar[]; error?: string }> {
    if (!supabase) {
      return { calendars: [], error: 'Supabase not configured' };
    }

    try {
      const result = await callApi<GCalCalendarsResponse>('gcal-calendars', { accountId });
      return { calendars: result.calendars || [] };
    } catch (error) {
      console.error('Error fetching calendars for account:', error);
      return { calendars: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get calendars from all connected accounts
   */
  async getAllCalendarsWithAccounts(preloadedAccounts?: GCalAccount[]): Promise<{ calendars: GCalCalendarWithAccount[]; error?: string }> {
    if (!supabase) {
      return { calendars: [], error: 'Supabase not configured' };
    }

    try {
      const accounts = preloadedAccounts ?? await this.getAccounts();
      const allCalendars: GCalCalendarWithAccount[] = [];

      for (const account of accounts) {
        const { calendars, error } = await this.getCalendarsForAccount(account.id);
        if (error) {
          console.warn(`Error fetching calendars for account ${account.email}:`, error);
          continue;
        }

        for (const cal of calendars) {
          allCalendars.push({
            ...cal,
            accountId: account.id,
            accountEmail: account.email,
          });
        }
      }

      return { calendars: allCalendars };
    } catch (error) {
      console.error('Error fetching all calendars:', error);
      return { calendars: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Get events from a calendar using a specific account
   */
  async getEventsForAccount(
    accountId: string,
    request: GCalEventsRequest
  ): Promise<{ events: GCalEvent[]; error?: string }> {
    if (!supabase) {
      return { events: [], error: 'Supabase not configured' };
    }

    try {
      const result = await callApi<GCalEventsResponse>('gcal-events', {
        ...request,
        accountId,
      } as unknown as Record<string, unknown>);
      return { events: result.events || [] };
    } catch (error) {
      console.error('Error fetching events for account:', error);
      return { events: [], error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export const googleCalendarService = new GoogleCalendarService();
