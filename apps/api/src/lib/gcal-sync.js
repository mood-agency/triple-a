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

  // 1. Check if sync is enabled for this user
  const { data: config } = await supabaseAdmin
    .from('google_calendar_config')
    .select('enabled')
    .eq('user_id', userId)
    .single();

  if (!config?.enabled) {
    result.errors.push('Sync not enabled');
    return result;
  }

  // 2. Get projects with calendar sync configured
  const projects = await getProjectsWithCalendarSync(supabaseAdmin, userId);
  if (projects.length === 0) {
    result.errors.push('No projects configured with calendar sync');
    return result;
  }

  // 3. Get existing event mappings
  const mappings = await getEventMappings(supabaseAdmin, userId);
  const mappingByGCalId = new Map(mappings.map((m) => [m.gcal_event_id, m]));
  const seenEventIds = new Set();

  // 4. For each project, fetch and process events
  for (const project of projects) {
    const calendarId = project.gcal_calendar_id;
    const accountId = project.gcal_account_id;

    // Get access token (multi-account or legacy)
    let tokenResult;
    if (accountId) {
      tokenResult = await getAccessTokenForAccount(supabaseAdmin, accountId, userId);
    } else {
      tokenResult = await getGoogleAccessToken(supabaseAdmin, userId);
    }

    if (tokenResult.error) {
      result.errors.push(`Token error for project "${project.name}": ${tokenResult.error}`);
      continue;
    }

    // Fetch events from Google Calendar
    const { events, error: fetchError } = await fetchGoogleCalendarEvents(
      tokenResult.accessToken,
      calendarId
    );

    if (fetchError) {
      result.errors.push(`Error syncing calendar for project "${project.name}": ${fetchError}`);
      continue;
    }

    // 5. Process each event
    for (const event of events) {
      if (seenEventIds.has(event.id)) continue;
      seenEventIds.add(event.id);

      const existingMapping = mappingByGCalId.get(event.id);
      const existingNote = await getNoteByGCalEventId(supabaseAdmin, event.id);

      try {
        if (existingMapping) {
          // Mapping exists — check if etag changed
          if (existingMapping.etag !== event.etag) {
            await updateNoteFromEvent(supabaseAdmin, existingMapping.local_note_id, event, project.id);
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
          await updateNoteFromEvent(supabaseAdmin, existingNote.id, event, project.id);
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
          const noteId = await createNoteFromEvent(supabaseAdmin, userId, event, project.id);
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

  // 6. Handle deleted events — mappings not seen in fetched events
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

  // 7. Update last_sync_at
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
