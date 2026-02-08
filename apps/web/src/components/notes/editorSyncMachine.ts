import { setup, assign } from 'xstate';

// --- Context ---

export interface PendingSave {
  content: string;
  timestamp: number;
}

export interface EditorSyncContext {
  /** Per-note pending saves: noteId → { expectedContent, timestamp } */
  pendingSaves: Record<string, PendingSave>;
  /** Note IDs created locally (Enter key) awaiting Supabase confirmation */
  pendingCreations: string[];
  /** Note IDs being completed/deleted — guards against save-during-delete */
  pendingCompletions: string[];
}

// --- Events ---

export type EditorSyncEvent =
  | { type: 'SAVE_STARTED'; noteId: string; content: string }
  | { type: 'NOTES_RECEIVED'; noteContents: Record<string, string> }
  | { type: 'NOTE_CREATED'; noteId: string }
  | { type: 'NOTE_CONFIRMED'; noteId: string }
  | { type: 'COMPLETION_STARTED'; noteId: string }
  | { type: 'COMPLETION_DONE'; noteId: string }
  | { type: 'CLEAR_STALE' };

// --- Constants ---

/** Safety timeout: remove pending saves older than this (ms) */
const STALE_THRESHOLD_MS = 5000;

// --- Machine ---

export const editorSyncMachine = setup({
  types: {
    context: {} as EditorSyncContext,
    events: {} as EditorSyncEvent,
  },
}).createMachine({
  id: 'editorSync',
  initial: 'active',
  context: {
    pendingSaves: {},
    pendingCreations: [],
    pendingCompletions: [],
  },
  states: {
    active: {
      on: {
        SAVE_STARTED: {
          actions: assign({
            pendingSaves: ({ context, event }) => ({
              ...context.pendingSaves,
              [event.noteId]: { content: event.content, timestamp: Date.now() },
            }),
          }),
        },

        NOTES_RECEIVED: {
          actions: assign({
            // Clear pending saves whose echo has arrived (content match)
            pendingSaves: ({ context, event }) => {
              const remaining = { ...context.pendingSaves };
              for (const [noteId, pending] of Object.entries(remaining)) {
                const echoedContent = event.noteContents[noteId];
                if (echoedContent !== undefined && echoedContent === pending.content) {
                  delete remaining[noteId];
                }
              }
              return remaining;
            },
            // Clear pending creations that now appear in notes[]
            pendingCreations: ({ context, event }) =>
              context.pendingCreations.filter(id => !(id in event.noteContents)),
          }),
        },

        NOTE_CREATED: {
          actions: assign({
            pendingCreations: ({ context, event }) =>
              [...context.pendingCreations, event.noteId],
          }),
        },

        NOTE_CONFIRMED: {
          actions: assign({
            pendingCreations: ({ context, event }) =>
              context.pendingCreations.filter(id => id !== event.noteId),
          }),
        },

        COMPLETION_STARTED: {
          actions: assign({
            pendingCompletions: ({ context, event }) =>
              [...context.pendingCompletions, event.noteId],
          }),
        },

        COMPLETION_DONE: {
          actions: assign({
            pendingCompletions: ({ context, event }) =>
              context.pendingCompletions.filter(id => id !== event.noteId),
          }),
        },

        CLEAR_STALE: {
          actions: assign({
            pendingSaves: ({ context }) => {
              const remaining = { ...context.pendingSaves };
              const now = Date.now();
              for (const [noteId, entry] of Object.entries(remaining)) {
                if (now - entry.timestamp > STALE_THRESHOLD_MS) {
                  delete remaining[noteId];
                }
              }
              return remaining;
            },
          }),
        },
      },
    },
  },
});

// --- Selector helpers (used with useSelector in React) ---

export function selectPendingSaveNoteIds(snapshot: { context: EditorSyncContext }): string[] {
  return Object.keys(snapshot.context.pendingSaves);
}

export function selectPendingCompletions(snapshot: { context: EditorSyncContext }): string[] {
  return snapshot.context.pendingCompletions;
}

export function selectIsCompleting(noteId: string) {
  return (snapshot: { context: EditorSyncContext }): boolean =>
    snapshot.context.pendingCompletions.includes(noteId);
}

// --- Comparator for useSelector (prevents unnecessary re-renders) ---

/** Shallow array equality — prevents useSelector from re-rendering when
 *  Object.keys() returns a new reference but the actual IDs haven't changed. */
export function shallowArrayEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
