import { useCallback } from 'react';
import { useNotes } from './useNotes';
import { useGoogleCalendar } from './useGoogleCalendar';
import type { Note, NoteCategory } from '@/types/note';

interface UseNotesWithCalendarSyncOptions {
  date?: string;
}

/**
 * Enhanced notes hook that automatically syncs meetings with Google Calendar
 * When a meeting is created or updated, it will be synced to Google Calendar
 * if the integration is enabled.
 */
export function useNotesWithCalendarSync(options: UseNotesWithCalendarSyncOptions = {}) {
  const notesHook = useNotes(options);
  const {
    isConnected,
    config,
    createCalendarEvent,
    updateCalendarEvent,
  } = useGoogleCalendar();

  const isSyncEnabled = isConnected && config?.enabled && (config?.calendars_to_sync?.length ?? 0) > 0;

  /**
   * Create a note and sync to Google Calendar if it's a meeting
   */
  const createNoteWithSync = useCallback(async (
    content: string,
    category: NoteCategory = 'todo',
    description?: string | null,
    labelIds?: string[]
  ): Promise<Note> => {
    const note = await notesHook.createNote(content, category, description, labelIds);

    // If it's a meeting and sync is enabled, create calendar event
    if (category === 'meeting' && isSyncEnabled && content.trim()) {
      // Run sync in background - don't block the UI
      createCalendarEvent(note.id, content, description || null, null).catch(err => {
        console.error('Failed to sync meeting to Google Calendar:', err);
      });
    }

    return note;
  }, [notesHook, isSyncEnabled, createCalendarEvent]);

  /**
   * Update a note and sync to Google Calendar if it's a meeting
   */
  const updateNoteWithSync = useCallback((
    id: string,
    content: string,
    category?: NoteCategory,
    description?: string | null
  ): void => {
    notesHook.updateNote(id, content, category, description);

    // Find the note to check if it's a meeting
    const note = notesHook.notes.find(n => n.id === id);
    const finalCategory = category ?? note?.category;

    if (finalCategory === 'meeting' && isSyncEnabled && content.trim()) {
      // Get gcal_event_id from the note if it exists
      const gcalEventId = (note as Note & { gcal_event_id?: string })?.gcal_event_id;

      if (gcalEventId) {
        // Update existing calendar event
        updateCalendarEvent(
          gcalEventId,
          content,
          description ?? note?.description ?? null,
          note?.deadline ?? null
        ).catch(err => {
          console.error('Failed to update meeting in Google Calendar:', err);
        });
      } else {
        // Create new calendar event (category changed to meeting)
        createCalendarEvent(
          id,
          content,
          description ?? note?.description ?? null,
          note?.deadline ?? null
        ).catch(err => {
          console.error('Failed to create meeting in Google Calendar:', err);
        });
      }
    }
  }, [notesHook, isSyncEnabled, createCalendarEvent, updateCalendarEvent]);

  /**
   * Update deadline and sync to Google Calendar if it's a meeting
   */
  const updateDeadlineWithSync = useCallback((
    id: string,
    deadline: string | null
  ): void => {
    notesHook.updateDeadline(id, deadline);

    const note = notesHook.notes.find(n => n.id === id);
    if (note?.category === 'meeting' && isSyncEnabled) {
      const gcalEventId = (note as Note & { gcal_event_id?: string })?.gcal_event_id;

      if (gcalEventId) {
        updateCalendarEvent(
          gcalEventId,
          note.content,
          note.description,
          deadline
        ).catch(err => {
          console.error('Failed to update meeting deadline in Google Calendar:', err);
        });
      }
    }
  }, [notesHook, isSyncEnabled, updateCalendarEvent]);

  return {
    ...notesHook,
    // Override with sync-enabled versions
    createNote: createNoteWithSync,
    updateNote: updateNoteWithSync,
    updateDeadline: updateDeadlineWithSync,
    // Expose sync status
    isCalendarSyncEnabled: isSyncEnabled,
  };
}
