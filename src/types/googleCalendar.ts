import type { NoteCategory } from './note';

/**
 * Google Calendar Event from API
 */
export interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string; // ISO datetime for timed events
    date?: string; // YYYY-MM-DD for all-day events
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  status: 'confirmed' | 'tentative' | 'cancelled';
  etag: string;
  htmlLink?: string;
  created?: string;
  updated?: string;
  creator?: {
    email: string;
    displayName?: string;
  };
  organizer?: {
    email: string;
    displayName?: string;
  };
  recurrence?: string[];
  recurringEventId?: string;
}

/**
 * Google Calendar from API
 */
export interface GCalCalendar {
  id: string;
  summary: string;
  description?: string;
  primary: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  selected?: boolean;
}

/**
 * Google Calendar sync configuration stored in Supabase
 */
export interface GCalConfig {
  id: string;
  user_id: string;
  enabled: boolean;
  calendars_to_sync: string[];
  default_category: NoteCategory;
  sync_interval_minutes: number;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Google Calendar event mapping (for tracking imported events)
 */
export interface GCalEventMapping {
  id: string;
  user_id: string;
  gcal_event_id: string;
  gcal_calendar_id: string;
  local_note_id: string;
  etag: string | null;
  event_status: string;
  last_synced_at: string;
  created_at: string;
}

/**
 * Sync status for Google Calendar operations
 */
export type GCalSyncStatus = 'idle' | 'syncing' | 'error' | 'success';

/**
 * Google Calendar connection status
 */
export interface GCalConnectionStatus {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Response from gcal-calendars Edge Function
 */
export interface GCalCalendarsResponse {
  calendars: GCalCalendar[];
}

/**
 * Response from gcal-events Edge Function
 */
export interface GCalEventsResponse {
  events: GCalEvent[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

/**
 * Request body for gcal-events Edge Function
 */
export interface GCalEventsRequest {
  calendarIds: string[];
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
}

/**
 * Sync result after importing events
 */
export interface GCalSyncResult {
  success: boolean;
  eventsImported: number;
  eventsUpdated: number;
  eventsDeleted: number;
  errors: string[];
}
