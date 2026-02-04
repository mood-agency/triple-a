import { create } from 'zustand';
import type { Label } from '@/types/note';
import type { Contact } from '@/types/contact';

/**
 * Fields for a single note. Any panel (task list, center editor, right sidebar)
 * connects to the same entry by note ID — if two panels show the same task,
 * they share one container automatically.
 */
export interface NoteFields {
    titleValue: string;
    descriptionValue: string;
    deadlineValue: string | null;
    labelsValue: Label[];
    assigneesValue: Contact[];
}

interface NoteFieldsState {
    // Which note is active in each panel
    selectedNoteId: string | null;
    fixedNoteId: string | null;

    // Note fields keyed by note ID
    notes: Record<string, NoteFields>;

    // Lifecycle: select/deselect manages the map automatically
    selectNote: (note: { id: string; content: string; description: string | null; deadline: string | null } | null) => void;
    selectFixedNote: (note: { id: string; content: string; description: string | null; deadline: string | null } | null) => void;

    // Field setters — all keyed by noteId
    setTitleValue: (noteId: string, value: string) => void;
    setDescriptionValue: (noteId: string, value: string) => void;
    setDeadlineValue: (noteId: string, value: string | null) => void;
    setLabelsValue: (noteId: string, value: Label[] | ((prev: Label[]) => Label[])) => void;
    setAssigneesValue: (noteId: string, value: Contact[] | ((prev: Contact[]) => Contact[])) => void;
}

export const useNoteFieldsStore = create<NoteFieldsState>((set) => ({
    selectedNoteId: null,
    fixedNoteId: null,
    notes: {},

    selectNote: (note) => set((state) => {
        const oldId = state.selectedNoteId;
        const newId = note?.id ?? null;
        const newNotes = { ...state.notes };

        // Remove old note from map if it's not also the fixed note
        if (oldId && oldId !== newId && oldId !== state.fixedNoteId) {
            delete newNotes[oldId];
        }

        // Initialize new note only if not already in the map
        if (newId && !newNotes[newId]) {
            newNotes[newId] = {
                titleValue: note!.content,
                descriptionValue: note!.description ?? '',
                deadlineValue: note!.deadline,
                labelsValue: [],
                assigneesValue: [],
            };
        }

        return { selectedNoteId: newId, notes: newNotes };
    }),

    selectFixedNote: (note) => set((state) => {
        const oldId = state.fixedNoteId;
        const newId = note?.id ?? null;
        const newNotes = { ...state.notes };

        // Remove old fixed note from map if it's not also the selected note
        if (oldId && oldId !== newId && oldId !== state.selectedNoteId) {
            delete newNotes[oldId];
        }

        // Initialize new note only if not already in the map
        if (newId && !newNotes[newId]) {
            newNotes[newId] = {
                titleValue: note!.content,
                descriptionValue: note!.description ?? '',
                deadlineValue: note!.deadline,
                labelsValue: [],
                assigneesValue: [],
            };
        }

        return { fixedNoteId: newId, notes: newNotes };
    }),

    setTitleValue: (noteId, value) => set((state) => {
        const note = state.notes[noteId];
        if (!note) return state;
        return { notes: { ...state.notes, [noteId]: { ...note, titleValue: value } } };
    }),

    setDescriptionValue: (noteId, value) => set((state) => {
        const note = state.notes[noteId];
        if (!note) return state;
        return { notes: { ...state.notes, [noteId]: { ...note, descriptionValue: value } } };
    }),

    setDeadlineValue: (noteId, value) => set((state) => {
        const note = state.notes[noteId];
        if (!note) return state;
        return { notes: { ...state.notes, [noteId]: { ...note, deadlineValue: value } } };
    }),

    setLabelsValue: (noteId, value) => set((state) => {
        const note = state.notes[noteId];
        if (!note) return state;
        return {
            notes: {
                ...state.notes,
                [noteId]: {
                    ...note,
                    labelsValue: typeof value === 'function' ? value(note.labelsValue) : value,
                },
            },
        };
    }),

    setAssigneesValue: (noteId, value) => set((state) => {
        const note = state.notes[noteId];
        if (!note) return state;
        return {
            notes: {
                ...state.notes,
                [noteId]: {
                    ...note,
                    assigneesValue: typeof value === 'function' ? value(note.assigneesValue) : value,
                },
            },
        };
    }),
}));
