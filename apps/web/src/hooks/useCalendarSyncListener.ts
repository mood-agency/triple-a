import { useEffect, useRef } from 'react';
import { useGoogleCalendar } from './useGoogleCalendar';
import { useEventSubscription } from '@/events';
import { useNotesStore } from '@/stores/useNotesStore';

/**
 * Event-driven Google Calendar sync listener.
 * Subscribes to note domain events and syncs meetings to Google Calendar
 * when the integration is enabled. Mount once at the app level.
 */
export function useCalendarSyncListener() {
  const {
    isConnected,
    config,
    createCalendarEvent,
    updateCalendarEvent,
  } = useGoogleCalendar();

  const isSyncEnabled = isConnected && config?.enabled && (config?.calendars_to_sync?.length ?? 0) > 0;

  // Use refs to keep callbacks stable in event handlers
  const isSyncEnabledRef = useRef(isSyncEnabled);
  useEffect(() => { isSyncEnabledRef.current = isSyncEnabled; }, [isSyncEnabled]);
  const createCalendarEventRef = useRef(createCalendarEvent);
  useEffect(() => { createCalendarEventRef.current = createCalendarEvent; }, [createCalendarEvent]);
  const updateCalendarEventRef = useRef(updateCalendarEvent);
  useEffect(() => { updateCalendarEventRef.current = updateCalendarEvent; }, [updateCalendarEvent]);

  useEventSubscription('note:created', (event) => {
    if (!isSyncEnabledRef.current) return;
    if (event.source === 'command') return; // Only sync UI-initiated creates
    const { noteId, content, category } = event.payload;
    if (category !== 'meeting' || !content?.trim()) return;

    createCalendarEventRef.current(noteId, content, null, null).catch(err => {
      console.error('[CalendarSync] Failed to sync meeting creation:', err);
    });
  });

  useEventSubscription('note:updated', (event) => {
    if (!isSyncEnabledRef.current) return;
    if (event.source === 'command') return;
    const { noteId, content, category, description } = event.payload;

    // Look up note from store for gcal_event_id and current state
    const notes = useNotesStore.getState().notes;
    const note = notes.find(n => n.id === noteId);
    const finalCategory = category ?? note?.category;

    if (finalCategory !== 'meeting' || !content?.trim()) return;

    const gcalEventId = (note as any)?.gcal_event_id;
    if (gcalEventId) {
      updateCalendarEventRef.current(
        gcalEventId,
        content,
        description ?? note?.description ?? null,
        note?.deadline ?? null
      ).catch(err => {
        console.error('[CalendarSync] Failed to update meeting:', err);
      });
    } else {
      createCalendarEventRef.current(
        noteId,
        content,
        description ?? note?.description ?? null,
        note?.deadline ?? null
      ).catch(err => {
        console.error('[CalendarSync] Failed to create meeting:', err);
      });
    }
  });

  useEventSubscription('note:deadlineUpdated', (event) => {
    if (!isSyncEnabledRef.current) return;
    const { noteId, deadline } = event.payload;

    const notes = useNotesStore.getState().notes;
    const note = notes.find(n => n.id === noteId);
    if (note?.category !== 'meeting') return;

    const gcalEventId = (note as any)?.gcal_event_id;
    if (gcalEventId) {
      updateCalendarEventRef.current(
        gcalEventId,
        note.content,
        note.description,
        deadline
      ).catch(err => {
        console.error('[CalendarSync] Failed to update meeting deadline:', err);
      });
    }
  });
}
