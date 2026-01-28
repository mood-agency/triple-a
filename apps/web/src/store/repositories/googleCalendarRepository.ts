import type { MergeableStore } from 'tinybase/mergeable-store';
import type { Project } from '@/types/project';
import { now } from '@/store/schema';

type Store = MergeableStore | null | undefined;

export interface NoteReference {
  id: string;
  gcalEventId: string;
}

export interface IGoogleCalendarRepository {
  getProjectsWithCalendarSync(): Project[];
  findDuplicateNotesByGCalEventId(): Map<string, string[]>;
  getNoteByGCalEventId(eventId: string): { id: string } | null;
  getAllNotesByGCalEventId(): Map<string, { id: string }>;
  markNotesAsDeleted(noteIds: string[]): number;
  getNoteCategory(noteId: string): string | null;
}

export function createGoogleCalendarRepository(store: Store): IGoogleCalendarRepository {
  return {
    getProjectsWithCalendarSync(): Project[] {
      if (!store) return [];

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
    },

    findDuplicateNotesByGCalEventId(): Map<string, string[]> {
      if (!store) return new Map();

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

      // Filter to only return entries with duplicates
      const duplicates = new Map<string, string[]>();
      for (const [gcalId, noteIds] of gcalIdToNoteIds) {
        if (noteIds.length > 1) {
          duplicates.set(gcalId, noteIds);
        }
      }

      return duplicates;
    },

    getNoteByGCalEventId(eventId: string): { id: string } | null {
      if (!store) return null;

      const notesTable = store.getTable('notes') || {};
      for (const [noteId, noteRow] of Object.entries(notesTable)) {
        const row = noteRow as Record<string, unknown>;
        if (row.gcal_event_id === eventId && !row.deleted_at) {
          return { id: noteId };
        }
      }

      return null;
    },

    getAllNotesByGCalEventId(): Map<string, { id: string }> {
      if (!store) return new Map();

      const notesTable = store.getTable('notes') || {};
      const noteByGCalId = new Map<string, { id: string }>();

      for (const [noteId, noteRow] of Object.entries(notesTable)) {
        const row = noteRow as Record<string, unknown>;
        const gcalEventId = row.gcal_event_id as string | null;
        if (gcalEventId && !row.deleted_at) {
          noteByGCalId.set(gcalEventId, { id: noteId });
        }
      }

      return noteByGCalId;
    },

    markNotesAsDeleted(noteIds: string[]): number {
      if (!store || noteIds.length === 0) return 0;

      const timestamp = now();
      let count = 0;

      for (const noteId of noteIds) {
        store.setPartialRow('notes', noteId, {
          deleted_at: timestamp,
          updated_at: timestamp,
          sync_status: 'pending',
        });
        count++;
      }

      return count;
    },

    getNoteCategory(noteId: string): string | null {
      if (!store) return null;

      const note = store.getRow('notes', noteId);
      return note ? (note.category as string) : null;
    },
  };
}
