import type { NoteCategory } from '@/types/note';

export type SortConfigType = {
  deadline: 'asc' | 'desc' | null;
  assignee: 'asc' | 'desc' | null;
  category: 'asc' | 'desc' | null;
};

/**
 * Represents the complete filter state that can be captured and restored
 */
export interface FilterState {
  categoryFilter: NoteCategory | 'all';
  labelFilter: string[];
  assigneeFilter: string[];
  searchQuery: string;
  sortConfig: SortConfigType;
  dateRangeFilter: { from: Date | undefined; to: Date | undefined };
  taskStatusFilter: 'active' | 'completed' | 'deleted';
  showOverdueOnly: boolean;
  showPublicOnly: boolean;
}

/**
 * Serializable version of FilterState for persistence
 */
export interface SerializableFilterState {
  categoryFilter: NoteCategory | 'all';
  labelFilter: string[];
  assigneeFilter: string[];
  searchQuery: string;
  sortConfig: SortConfigType;
  dateRangeFilter: { from: string | null; to: string | null };
  taskStatusFilter: 'active' | 'completed' | 'deleted';
  showOverdueOnly: boolean;
  showPublicOnly: boolean;
}

/**
 * Serializable command representation for persistence
 */
export interface SerializableFilterCommand {
  type: string;
  description: string;
  timestamp: number;
  payload: Record<string, unknown>;
  previousState: Partial<SerializableFilterState>;
}

/**
 * Base interface for all filter commands following the Command Pattern.
 *
 * Benefits:
 * - Testability: Commands can be unit tested in isolation
 * - Extensibility: New commands can be added without modifying existing code
 * - Undo/Redo: Full support for reversible operations
 * - Reusability: Commands can be reused across different contexts
 */
export interface FilterCommand {
  /** Unique identifier for the command type */
  readonly type: string;

  /** Human-readable description for undo toast/history */
  readonly description: string;

  /** Timestamp when command was created */
  readonly timestamp: number;

  /** Execute the command, returning the new state */
  execute(currentState: FilterState): FilterState;

  /** Undo the command, returning the previous state */
  undo(currentState: FilterState): FilterState;

  /** Convert command to serializable format */
  toJSON(): SerializableFilterCommand;
}

/**
 * Command history management
 */
export interface CommandHistory {
  /** Stack of executed commands (for undo) */
  undoStack: FilterCommand[];

  /** Stack of undone commands (for redo) */
  redoStack: FilterCommand[];

  /** Maximum number of commands to keep in history */
  maxSize: number;
}
