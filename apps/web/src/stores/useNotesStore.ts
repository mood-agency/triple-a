import { create } from 'zustand';
import type { Note } from '@/types/note';

interface NotesState {
  // State
  notes: Note[];
  loading: boolean;
  pendingNoteIds: Set<string>;
  currentDate: string | undefined;
  currentProjectId: string | null | undefined;

  // State setters (called by the hook's side effects)
  setLoading: (loading: boolean) => void;
  setScope: (date: string | undefined, projectId: string | null | undefined) => void;

  // Optimistic actions
  addNote: (note: Note) => void;
  removeNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  mergeFetchedNotes: (dbNotes: Note[]) => void;
  clearNotes: () => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notes: [],
  loading: true,
  pendingNoteIds: new Set(),
  currentDate: undefined,
  currentProjectId: undefined,

  setLoading: (loading) => set({ loading }),

  setScope: (date, projectId) => set({
    currentDate: date,
    currentProjectId: projectId,
  }),

  addNote: (note) => {
    const { notes, pendingNoteIds } = get();
    const newPending = new Set(pendingNoteIds);
    newPending.add(note.id);
    set({
      notes: [...notes, note],
      pendingNoteIds: newPending,
    });
  },

  removeNote: (id) => {
    const { notes, pendingNoteIds } = get();
    const newPending = new Set(pendingNoteIds);
    newPending.delete(id);
    set({
      notes: notes.filter(n => n.id !== id),
      pendingNoteIds: newPending,
    });
  },

  updateNote: (id, updates) => {
    const { notes } = get();
    set({
      notes: notes.map(n => n.id === id ? { ...n, ...updates } : n),
    });
  },

  mergeFetchedNotes: (dbNotes) => {
    const { pendingNoteIds, notes } = get();

    if (pendingNoteIds.size === 0) {
      set({ notes: dbNotes });
      return;
    }

    const dbIds = new Set(dbNotes.map(n => n.id));

    // Remove confirmed pending IDs (now in DB)
    const newPending = new Set<string>();
    for (const id of pendingNoteIds) {
      if (!dbIds.has(id)) newPending.add(id);
    }

    // Keep locally-created notes not yet in DB
    const stillPending = notes.filter(n => newPending.has(n.id));

    set({
      notes: stillPending.length > 0 ? [...dbNotes, ...stillPending] : dbNotes,
      pendingNoteIds: newPending,
    });
  },

  clearNotes: () => set({
    notes: [],
    pendingNoteIds: new Set(),
  }),
}));
