import { useCallback } from 'react';
import { useGoogleCalendar } from './useGoogleCalendar';
import type { Note } from '@/types/note';

/**
 * Hook for syncing meetings with Google Calendar
 * Provides functions to create, update, and delete calendar events
 */
export function useGoogleCalendarSync() {
  const {
    isConnected,
    config,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent
  } = useGoogleCalendar();

  /**
   * Check if Google Calendar sync is available
   */
  const isSyncEnabled = isConnected && config?.enabled && (config?.calendars_to_sync?.length ?? 0) > 0;

  /**
   * Sync a meeting note to Google Calendar
   * Creates a new event if the note doesn't have a gcal_event_id,
   * or updates the existing event if it does
   */
  const syncMeetingToCalendar = useCallback(async (
    note: Note
  ): Promise<{ success: boolean; gcalEventId?: string; error?: string }> => {
    if (!isSyncEnabled) {
      return { success: false, error: 'Google Calendar sync not enabled' };
    }

    if (note.category !== 'meeting') {
      return { success: false, error: 'Note is not a meeting' };
    }

    // Get gcal_event_id from the note (might need to read from store)
    const gcalEventId = (note as Note & { gcal_event_id?: string }).gcal_event_id;

    if (gcalEventId) {
      // Update existing event
      const result = await updateCalendarEvent(
        gcalEventId,
        note.content,
        note.description,
        note.deadline
      );
      return result.success
        ? { success: true, gcalEventId }
        : { success: false, error: result.error };
    } else {
      // Create new event
      return await createCalendarEvent(
        note.id,
        note.content,
        note.description,
        note.deadline
      );
    }
  }, [isSyncEnabled, createCalendarEvent, updateCalendarEvent]);

  /**
   * Delete a meeting's associated calendar event
   */
  const deleteMeetingFromCalendar = useCallback(async (
    gcalEventId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!isSyncEnabled) {
      return { success: false, error: 'Google Calendar sync not enabled' };
    }

    return await deleteCalendarEvent(gcalEventId);
  }, [isSyncEnabled, deleteCalendarEvent]);

  return {
    isSyncEnabled,
    syncMeetingToCalendar,
    deleteMeetingFromCalendar,
  };
}
