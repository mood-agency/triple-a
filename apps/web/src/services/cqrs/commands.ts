import type { NoteCategory } from '@/types/note';

/**
 * CQRS Command Types
 *
 * Commands represent intentions to change state.
 * Each command is processed by a handler that performs the actual mutation.
 */

// Base command interface
export interface Command {
  type: string;
  timestamp: number;
  correlationId: string; // For tracking optimistic updates
}

// Command types
export interface UpdateNoteContentCommand extends Command {
  type: 'UPDATE_NOTE_CONTENT';
  noteId: string;
  content: string;
  category?: NoteCategory;
  description?: string | null;
}

export interface CreateNoteCommand extends Command {
  type: 'CREATE_NOTE';
  tempId: string; // Client-side temporary ID
  afterNoteId: string;
  category: NoteCategory;
  deadline?: string | null;
  labelIds?: string[];
  assigneeId?: string | null;
}

export interface DeleteNoteCommand extends Command {
  type: 'DELETE_NOTE';
  noteId: string;
  reason: string;
}

export interface ToggleNoteCompletedCommand extends Command {
  type: 'TOGGLE_NOTE_COMPLETED';
  noteId: string;
  completed: boolean;
}

export interface ToggleNotePinCommand extends Command {
  type: 'TOGGLE_NOTE_PIN';
  noteId: string;
}

export interface ToggleNoteFixInSidebarCommand extends Command {
  type: 'TOGGLE_NOTE_FIX_IN_SIDEBAR';
  noteId: string;
}

export interface AddLabelToNoteCommand extends Command {
  type: 'ADD_LABEL_TO_NOTE';
  noteId: string;
  labelId: string;
}

export interface CreateAndAddLabelCommand extends Command {
  type: 'CREATE_AND_ADD_LABEL';
  noteId: string;
  labelName: string;
}

export interface AddAssigneeToNoteCommand extends Command {
  type: 'ADD_ASSIGNEE_TO_NOTE';
  noteId: string;
  contactId: string;
}

// Union type of all commands
export type NoteCommand =
  | UpdateNoteContentCommand
  | CreateNoteCommand
  | DeleteNoteCommand
  | ToggleNoteCompletedCommand
  | ToggleNotePinCommand
  | ToggleNoteFixInSidebarCommand
  | AddLabelToNoteCommand
  | CreateAndAddLabelCommand
  | AddAssigneeToNoteCommand;

// Command result types
export interface CommandResult {
  success: boolean;
  correlationId: string;
  error?: string;
}

export interface CreateNoteResult extends CommandResult {
  noteId?: string; // The actual ID from Convex
}

// Helper to create commands with timestamp and correlation ID
let correlationCounter = 0;
export function createCommand<T extends Omit<NoteCommand, 'timestamp' | 'correlationId'>>(
  command: T
): T & { timestamp: number; correlationId: string } {
  return {
    ...command,
    timestamp: Date.now(),
    correlationId: `cmd-${Date.now()}-${++correlationCounter}`,
  };
}
