import { setup, assign } from 'xstate';
import type { Note } from '@/types/note';

// --- Context ---

export type FocusTarget = 'title' | 'description-start' | 'description-end' | null;

export interface SelectionContext {
    noteId: string | null;
    note: Note | null;
    focusTarget: FocusTarget;
    desiredColumn: number;
    showDescriptionPanel: boolean;
}

// --- Events ---

export type SelectionEvent =
    | { type: 'NOTE_SELECTED'; note: Note }
    | { type: 'NOTE_DESELECTED' }
    | { type: 'NOTE_CHANGED'; note: Note }
    | { type: 'TAB_PRESSED'; desiredColumn: number }
    | { type: 'DESCRIPTION_PANEL_READY' }
    | { type: 'DESCRIPTION_FOCUSED' }
    | { type: 'DESCRIPTION_BLURRED' }
    | { type: 'ESCAPE_PRESSED' }
    | { type: 'FOCUS_TITLE'; column?: number }
    | { type: 'TITLE_FOCUSED' }
    | { type: 'SET_DESIRED_COLUMN'; column: number }
    | { type: 'CLEAR_FOCUS_TARGET' };

// --- Machine ---

export const selectionMachine = setup({
    types: {
        context: {} as SelectionContext,
        events: {} as SelectionEvent,
        input: {} as { note: Note | null },
    },
    guards: {
        isNoteChanged: ({ context, event }) => {
            if (event.type !== 'NOTE_SELECTED') return false;
            return context.noteId !== event.note.id;
        },
        isSameNote: ({ context, event }) => {
            if (event.type !== 'NOTE_SELECTED') return false;
            return context.noteId === event.note.id;
        },
    },
    actions: {
        // Side-effect stubs — overridden via .provide() in the hook
        syncStoreOnNoteChange: () => { },
        clearUnfocusedSaveTimer: () => { },
    },
}).createMachine({
    id: 'noteSelection',
    initial: 'idle',
    context: ({ input }) => ({
        noteId: input.note?.id ?? null,
        note: input.note ?? null,
        focusTarget: null as FocusTarget,
        desiredColumn: 0,
        showDescriptionPanel: false,
    }),
    // Global events — handled in ALL states (state-specific handlers take precedence)
    on: {
        SET_DESIRED_COLUMN: {
            actions: assign({
                desiredColumn: ({ event }) => event.column,
            }),
        },
        CLEAR_FOCUS_TARGET: {
            actions: assign({
                focusTarget: null,
            }),
        },
    },
    states: {
        idle: {
            on: {
                NOTE_SELECTED: {
                    target: 'browsing',
                    actions: [
                        assign({
                            noteId: ({ event }) => event.note.id,
                            note: ({ event }) => event.note,
                            showDescriptionPanel: false,
                            focusTarget: null,
                        }),
                        'syncStoreOnNoteChange',
                    ],
                },
            },
        },

        browsing: {
            on: {
                NOTE_SELECTED: [
                    {
                        // Different note — reset panel
                        guard: 'isNoteChanged',
                        target: 'browsing',
                        actions: [
                            'clearUnfocusedSaveTimer',
                            assign({
                                noteId: ({ event }) => event.note.id,
                                note: ({ event }) => event.note,
                                showDescriptionPanel: false,
                                focusTarget: null,
                            }),
                            'syncStoreOnNoteChange',
                        ],
                    },
                    {
                        // Same note — just update the reference
                        guard: 'isSameNote',
                        actions: assign({
                            note: ({ event }) => event.note,
                        }),
                    },
                ],
                NOTE_DESELECTED: {
                    target: 'idle',
                    actions: [
                        'clearUnfocusedSaveTimer',
                        assign({
                            noteId: null,
                            note: null,
                            focusTarget: null,
                            showDescriptionPanel: false,
                        }),
                        'syncStoreOnNoteChange',
                    ],
                },
                NOTE_CHANGED: {
                    actions: assign({
                        note: ({ event }) => event.note,
                    }),
                },
                TAB_PRESSED: {
                    target: 'navigatingToDescription',
                    actions: assign({
                        desiredColumn: ({ event }) => event.desiredColumn,
                        focusTarget: 'description-start' as FocusTarget,
                        showDescriptionPanel: true,
                    }),
                },
                FOCUS_TITLE: {
                    actions: assign({
                        focusTarget: 'title' as FocusTarget,
                        desiredColumn: ({ event }) => event.column ?? 0,
                    }),
                },
                TITLE_FOCUSED: {
                    actions: assign({
                        focusTarget: ({ context }) =>
                            context.focusTarget === 'title' ? null : context.focusTarget,
                    }),
                },
            },
        },

        navigatingToDescription: {
            // KEY: NOTE_CHANGED is NOT handled here — this structurally prevents
            // the URL sync effect (RC-7) and one-shot flag race (RC-5) from
            // closing the description panel during Tab navigation.
            on: {
                NOTE_SELECTED: [
                    {
                        // Note changed while navigating — update context but STAY in this state
                        guard: 'isNoteChanged',
                        actions: [
                            assign({
                                noteId: ({ event }) => event.note.id,
                                note: ({ event }) => event.note,
                            }),
                            'syncStoreOnNoteChange',
                        ],
                    },
                    {
                        guard: 'isSameNote',
                        actions: assign({
                            note: ({ event }) => event.note,
                        }),
                    },
                ],
                NOTE_DESELECTED: {
                    target: 'idle',
                    actions: [
                        'clearUnfocusedSaveTimer',
                        assign({
                            noteId: null,
                            note: null,
                            focusTarget: null,
                            showDescriptionPanel: false,
                        }),
                        'syncStoreOnNoteChange',
                    ],
                },
                DESCRIPTION_PANEL_READY: {
                    target: 'viewingDescription',
                },
                DESCRIPTION_FOCUSED: {
                    target: 'editingDescription',
                },
                // Allow repeated Tab presses — just update the column
                TAB_PRESSED: {
                    actions: assign({
                        desiredColumn: ({ event }) => event.desiredColumn,
                        focusTarget: 'description-start' as FocusTarget,
                    }),
                },
            },
        },

        viewingDescription: {
            on: {
                NOTE_SELECTED: [
                    {
                        guard: 'isNoteChanged',
                        target: 'browsing',
                        actions: [
                            'clearUnfocusedSaveTimer',
                            assign({
                                noteId: ({ event }) => event.note.id,
                                note: ({ event }) => event.note,
                                showDescriptionPanel: false,
                                focusTarget: null,
                            }),
                            'syncStoreOnNoteChange',
                        ],
                    },
                    {
                        guard: 'isSameNote',
                        actions: assign({
                            note: ({ event }) => event.note,
                        }),
                    },
                ],
                NOTE_DESELECTED: {
                    target: 'idle',
                    actions: [
                        'clearUnfocusedSaveTimer',
                        assign({
                            noteId: null,
                            note: null,
                            focusTarget: null,
                            showDescriptionPanel: false,
                        }),
                        'syncStoreOnNoteChange',
                    ],
                },
                NOTE_CHANGED: {
                    actions: assign({
                        note: ({ event }) => event.note,
                    }),
                },
                DESCRIPTION_FOCUSED: {
                    target: 'editingDescription',
                },
                ESCAPE_PRESSED: {
                    target: 'browsing',
                    actions: assign({
                        showDescriptionPanel: false,
                    }),
                },
                TAB_PRESSED: {
                    actions: assign({
                        desiredColumn: ({ event }) => event.desiredColumn,
                        focusTarget: 'description-start' as FocusTarget,
                    }),
                },
                FOCUS_TITLE: {
                    target: 'browsing',
                    actions: assign({
                        focusTarget: 'title' as FocusTarget,
                        desiredColumn: ({ event }) => event.column ?? 0,
                        showDescriptionPanel: false,
                    }),
                },
            },
        },

        editingDescription: {
            on: {
                NOTE_SELECTED: [
                    {
                        guard: 'isNoteChanged',
                        target: 'browsing',
                        actions: [
                            'clearUnfocusedSaveTimer',
                            assign({
                                noteId: ({ event }) => event.note.id,
                                note: ({ event }) => event.note,
                                showDescriptionPanel: false,
                                focusTarget: null,
                            }),
                            'syncStoreOnNoteChange',
                        ],
                    },
                    {
                        guard: 'isSameNote',
                        actions: assign({
                            note: ({ event }) => event.note,
                        }),
                    },
                ],
                NOTE_DESELECTED: {
                    target: 'idle',
                    actions: [
                        'clearUnfocusedSaveTimer',
                        assign({
                            noteId: null,
                            note: null,
                            focusTarget: null,
                            showDescriptionPanel: false,
                        }),
                        'syncStoreOnNoteChange',
                    ],
                },
                NOTE_CHANGED: {
                    actions: assign({
                        note: ({ event }) => event.note,
                    }),
                },
                DESCRIPTION_BLURRED: {
                    target: 'viewingDescription',
                },
                ESCAPE_PRESSED: {
                    target: 'browsing',
                    actions: assign({
                        showDescriptionPanel: false,
                    }),
                },
                FOCUS_TITLE: {
                    target: 'browsing',
                    actions: assign({
                        focusTarget: 'title' as FocusTarget,
                        desiredColumn: ({ event }) => event.column ?? 0,
                        showDescriptionPanel: false,
                    }),
                },
            },
        },
    },
});
