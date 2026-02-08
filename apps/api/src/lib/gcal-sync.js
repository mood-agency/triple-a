/**
 * Google Calendar Sync Logic
 *
 * Ported from apps/web/src/contexts/GoogleCalendarContext.tsx (syncNow function)
 * to run server-side. This module contains all the logic for syncing Google
 * Calendar events with local notes.
 */

import { getGoogleAccessToken, getAccessTokenForAccount } from './gcal-auth.js';

const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

// ============================================================================
// Database Helper Functions (ported from frontend)
// ============================================================================

async function getProjectsWithCalendarSync(supabase, userId) {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .not('gcal_calendar_id', 'is', null);

  if (error) {
    console.error('[gcal-sync] Error fetching projects:', error);
    return [];
  }
  return data || [];
}

async function getEventMappings(supabase, userId) {
  const { data, error } = await supabase
    .from('google_calendar_events')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('[gcal-sync] Error fetching event mappings:', error);
    return [];
  }
  return data || [];
}

async function getNoteByGCalEventId(supabase, gcalEventId) {
  const { data } = await supabase
    .from('notes')
    .select('id')
    .eq('gcal_event_id', gcalEventId)
    .is('deleted_at', null)
    .maybeSingle();

  return data;
}

function extractMeetingLink(event) {
  if (event.conferenceData?.entryPoints) {
    const video = event.conferenceData.entryPoints.find(ep => ep.entryPointType === 'video');
    if (video?.uri) return video.uri;
  }
  return event.hangoutLink || null;
}

function extractAttendees(event) {
  if (!Array.isArray(event.attendees)) return null;
  return event.attendees
    .filter(a => !a.resource)
    .map(a => ({
      email: a.email,
      displayName: a.displayName || null,
      responseStatus: a.responseStatus || 'needsAction',
    }));
}

async function createNoteFromEvent(supabase, userId, event, projectId) {
  const isAllDay = !event.start.dateTime;
  const deadline = isAllDay
    ? `${event.start.date}T00:00:00`
    : event.start.dateTime;

  const date = deadline.split('T')[0];

  const { data, error } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      date,
      content: event.summary || 'Untitled Event',
      description: event.description || null,
      category: 'meeting',
      completed: false,
      deadline,
      pinned: false,
      sort_order: 0,
      project_id: projectId,
      gcal_event_id: event.id,
      is_all_day: isAllDay,
      meeting_link: extractMeetingLink(event),
      location: event.location || null,
      meeting_attendees: extractAttendees(event),
      gcal_html_link: event.htmlLink || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
}

async function updateNoteFromEvent(supabase, noteId, event, projectId) {
  const isAllDay = !event.start.dateTime;
  const deadline = isAllDay
    ? `${event.start.date}T00:00:00`
    : event.start.dateTime;

  const updates = {
    content: event.summary || 'Untitled Event',
    description: event.description || null,
    deadline,
    category: 'meeting',
    gcal_event_id: event.id,
    is_all_day: isAllDay,
    meeting_link: extractMeetingLink(event),
    location: event.location || null,
    meeting_attendees: extractAttendees(event),
    gcal_html_link: event.htmlLink || null,
  };

  if (projectId !== null) {
    updates.project_id = projectId;
  }

  await supabase.from('notes').update(updates).eq('id', noteId);
}

async function markNoteAsDeleted(supabase, noteId) {
  await supabase
    .from('notes')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', noteId);
}

async function saveEventMapping(supabase, mapping) {
  const { error } = await supabase
    .from('google_calendar_events')
    .upsert(mapping, { onConflict: 'user_id,gcal_event_id' });

  if (error) {
    console.error('[gcal-sync] Error saving event mapping:', error);
  }
}

async function deleteEventMapping(supabase, userId, gcalEventId) {
  await supabase
    .from('google_calendar_events')
    .delete()
    .eq('user_id', userId)
    .eq('gcal_event_id', gcalEventId);
}

// ============================================================================
// Google Calendar API Fetching
// ============================================================================

async function fetchGoogleCalendarEvents(accessToken, calendarId, maxResults = 100) {
  const defaultTimeMin = new Date();
  defaultTimeMin.setDate(defaultTimeMin.getDate() - 7);

  const defaultTimeMax = new Date();
  defaultTimeMax.setDate(defaultTimeMax.getDate() + 30);

  const allEvents = [];
  let pageToken;

  do {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(Math.min(maxResults, 250)),
      timeMin: defaultTimeMin.toISOString(),
      timeMax: defaultTimeMax.toISOString(),
    });
    if (pageToken) params.set('pageToken', pageToken);

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      console.error(`[gcal-sync] Error fetching events from ${calendarId}: ${response.status}`);
      return { events: [], error: `Google API error: ${response.status}` };
    }

    const data = await response.json();
    allEvents.push(...(data.items || []));
    pageToken = data.nextPageToken;

    if (allEvents.length >= maxResults) break;
  } while (pageToken);

  const filteredEvents = allEvents.filter(
    (event) => event.status !== 'cancelled' && event.summary
  );

  return { events: filteredEvents };
}

// ============================================================================
// Main Sync Function
// ============================================================================

/**
 * Synchronize Google Calendar events for a specific user.
 * This is the server-side equivalent of syncNow() from GoogleCalendarContext.tsx.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin - Supabase admin client
 * @param {string} userId - The user ID to sync for
 * @returns {Promise<{success: boolean, eventsImported: number, eventsUpdated: number, eventsDeleted: number, errors: string[]}>}
 */
export async function syncUserCalendar(supabaseAdmin, userId) {
  const result = {
    success: false,
    eventsImported: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    errors: [],
  };

  // 1. Check if sync is enabled and get calendars_to_sync
  const { data: config } = await supabaseAdmin
    .from('google_calendar_config')
    .select('enabled, calendars_to_sync')
    .eq('user_id', userId)
    .single();

  if (!config?.enabled) {
    result.errors.push('Sync not enabled');
    return result;
  }

  // 2. Build the list of calendars to sync.
  //    Sources: project-level links (gcal_calendar_id) + config-level (calendars_to_sync).
  const projects = await getProjectsWithCalendarSync(supabaseAdmin, userId);
  const configCalendars = config.calendars_to_sync || [];

  // Collect all calendar entries: { calendarId, accountId, projectId }
  const calendarEntries = [];
  const seenCalendarIds = new Set();

  // From project links
  for (const project of projects) {
    calendarEntries.push({
      calendarId: project.gcal_calendar_id,
      accountId: project.gcal_account_id || null,
      projectId: project.id,
    });
    seenCalendarIds.add(project.gcal_calendar_id);
  }

  // From config.calendars_to_sync (calendars selected in UI but not linked to any project)
  for (const calId of configCalendars) {
    if (!seenCalendarIds.has(calId)) {
      calendarEntries.push({
        calendarId: calId,
        accountId: null,
        projectId: null,
      });
      seenCalendarIds.add(calId);
    }
  }

  if (calendarEntries.length === 0) {
    result.errors.push('No calendars configured for sync');
    return result;
  }

  // 3. Get user's connected accounts (for token resolution)
  const { data: accounts } = await supabaseAdmin
    .from('google_calendar_accounts')
    .select('id, access_token, token_expires_at, refresh_token')
    .eq('user_id', userId);

  // 4. Get existing event mappings
  const mappings = await getEventMappings(supabaseAdmin, userId);
  const mappingByGCalId = new Map(mappings.map((m) => [m.gcal_event_id, m]));
  const seenEventIds = new Set();

  // 5. For each calendar, fetch and process events
  for (const entry of calendarEntries) {
    const { calendarId, accountId, projectId } = entry;

    // Get access token: specific account > first available account > legacy tokens
    let tokenResult;
    if (accountId) {
      tokenResult = await getAccessTokenForAccount(supabaseAdmin, accountId, userId);
    } else if (accounts && accounts.length > 0) {
      tokenResult = await getAccessTokenForAccount(supabaseAdmin, accounts[0].id, userId);
    } else {
      tokenResult = await getGoogleAccessToken(supabaseAdmin, userId);
    }

    if (tokenResult.error) {
      result.errors.push(`Token error for calendar "${calendarId}": ${tokenResult.error}`);
      continue;
    }

    // Fetch events from Google Calendar
    const { events, error: fetchError } = await fetchGoogleCalendarEvents(
      tokenResult.accessToken,
      calendarId
    );

    if (fetchError) {
      result.errors.push(`Error syncing calendar "${calendarId}": ${fetchError}`);
      continue;
    }

    // 6. Process each event
    for (const event of events) {
      if (seenEventIds.has(event.id)) continue;
      seenEventIds.add(event.id);

      const existingMapping = mappingByGCalId.get(event.id);
      const existingNote = await getNoteByGCalEventId(supabaseAdmin, event.id);

      try {
        if (existingMapping) {
          // Mapping exists — check if etag changed
          if (existingMapping.etag !== event.etag) {
            await updateNoteFromEvent(supabaseAdmin, existingMapping.local_note_id, event, projectId);
            await saveEventMapping(supabaseAdmin, {
              ...existingMapping,
              etag: event.etag,
              event_status: event.status,
              last_synced_at: new Date().toISOString(),
            });
            result.eventsUpdated++;
          }
        } else if (existingNote) {
          // Note exists but no mapping — create mapping
          await updateNoteFromEvent(supabaseAdmin, existingNote.id, event, projectId);
          await saveEventMapping(supabaseAdmin, {
            user_id: userId,
            gcal_event_id: event.id,
            gcal_calendar_id: calendarId,
            local_note_id: existingNote.id,
            etag: event.etag,
            event_status: event.status,
            last_synced_at: new Date().toISOString(),
          });
          result.eventsUpdated++;
        } else {
          // New event — create note and mapping
          const noteId = await createNoteFromEvent(supabaseAdmin, userId, event, projectId);
          await saveEventMapping(supabaseAdmin, {
            user_id: userId,
            gcal_event_id: event.id,
            gcal_calendar_id: calendarId,
            local_note_id: noteId,
            etag: event.etag,
            event_status: event.status,
            last_synced_at: new Date().toISOString(),
          });
          result.eventsImported++;
        }
      } catch (_err) {
        result.errors.push(`Failed to process event: ${event.summary}`);
      }
    }
  }

  // 7. Handle deleted events — mappings not seen in fetched events
  for (const mapping of mappings) {
    if (!seenEventIds.has(mapping.gcal_event_id)) {
      try {
        await markNoteAsDeleted(supabaseAdmin, mapping.local_note_id);
        await deleteEventMapping(supabaseAdmin, userId, mapping.gcal_event_id);
        result.eventsDeleted++;
      } catch (err) {
        console.error('[gcal-sync] Error deleting mapping:', err);
      }
    }
  }

  // 8. Update last_sync_at
  await supabaseAdmin
    .from('google_calendar_config')
    .update({
      last_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  result.success = true;
  console.log(
    `[gcal-sync] User ${userId}: imported=${result.eventsImported}, updated=${result.eventsUpdated}, deleted=${result.eventsDeleted}, errors=${result.errors.length}`
  );

  return result;
}
