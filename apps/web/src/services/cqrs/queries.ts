import type { Note, Label } from '@/types/note';
import type { Contact } from '@/types/contact';

/**
 * CQRS Query Types and Selectors
 *
 * Queries represent requests for data.
 * Selectors transform raw Convex data into the format needed by components.
 */

// Query result with metadata
export interface QueryResult<T> {
  data: T;
  timestamp: number;
  isStale: boolean;
}

// Note with computed/derived data
export interface NoteViewModel {
  id: string;
  content: string;
  description: string | null;
  category: string;
  completed: boolean;
  completedAt: string | null;
  deadline: string | null;
  pinned: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  labels: Label[];
  assignees: Contact[];
  isOverdue: boolean;
  hasTimeComponent: boolean;
}

// Selectors - pure functions that transform data

/**
 * Check if a deadline has a time component (not just a date)
 */
export function hasTimeComponent(deadline: string | null): boolean {
  if (!deadline) return false;
  // Check if the time is not midnight (00:00:00)
  const date = new Date(deadline);
  return date.getHours() !== 0 || date.getMinutes() !== 0;
}

/**
 * Check if a note is overdue
 */
export function isNoteOverdue(note: Note): boolean {
  if (!note.deadline || note.completed) return false;
  const now = new Date();
  const deadline = new Date(note.deadline);
  return deadline < now;
}

/**
 * Transform a Note to a NoteViewModel with computed fields
 */
export function toNoteViewModel(
  note: Note,
  labels: Label[],
  assignees: Contact[]
): NoteViewModel {
  return {
    id: note.id,
    content: note.content,
    description: note.description,
    category: note.category,
    completed: note.completed,
    completedAt: note.completed_at,
    deadline: note.deadline,
    pinned: note.pinned,
    sortOrder: note.sort_order,
    createdAt: note.created_at,
    updatedAt: note.updated_at,
    labels,
    assignees,
    isOverdue: isNoteOverdue(note),
    hasTimeComponent: hasTimeComponent(note.deadline),
  };
}

/**
 * Filter notes by category
 */
export function filterByCategory(notes: Note[], category: string | 'all'): Note[] {
  if (category === 'all') return notes;
  return notes.filter(n => n.category === category);
}

/**
 * Filter active (non-completed, non-deleted) notes
 */
export function filterActiveNotes(notes: Note[]): Note[] {
  return notes.filter(n => !n.completed && !n.deleted_at);
}

/**
 * Filter completed notes
 */
export function filterCompletedNotes(notes: Note[]): Note[] {
  return notes.filter(n => n.completed && !n.deleted_at);
}

/**
 * Sort notes by pinned status first, then by sort order
 */
export function sortNotesByPinnedAndOrder(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    // Pinned notes first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    // Then by sort order
    return a.sort_order - b.sort_order;
  });
}

/**
 * Find differences between local and remote note state
 * Used for conflict detection
 */
export interface NoteDiff {
  field: keyof Note;
  localValue: unknown;
  remoteValue: unknown;
}

export function findNoteDifferences(local: Partial<Note>, remote: Note): NoteDiff[] {
  const diffs: NoteDiff[] = [];
  const fieldsToCompare: (keyof Note)[] = [
    'content',
    'description',
    'category',
    'completed',
    'deadline',
    'pinned',
  ];

  for (const field of fieldsToCompare) {
    if (field in local && local[field] !== remote[field]) {
      diffs.push({
        field,
        localValue: local[field],
        remoteValue: remote[field],
      });
    }
  }

  return diffs;
}

/**
 * Merge strategy for conflicts
 */
export type MergeStrategy = 'local-wins' | 'remote-wins' | 'latest-wins' | 'manual';

export interface ConflictResolution {
  strategy: MergeStrategy;
  resolvedValue: unknown;
}

/**
 * Resolve a conflict between local and remote values
 */
export function resolveConflict(
  diff: NoteDiff,
  localTimestamp: number,
  remoteTimestamp: number,
  strategy: MergeStrategy = 'latest-wins'
): ConflictResolution {
  switch (strategy) {
    case 'local-wins':
      return { strategy, resolvedValue: diff.localValue };
    case 'remote-wins':
      return { strategy, resolvedValue: diff.remoteValue };
    case 'latest-wins':
      return {
        strategy,
        resolvedValue: localTimestamp > remoteTimestamp ? diff.localValue : diff.remoteValue,
      };
    case 'manual':
      // Return remote by default, caller should prompt user
      return { strategy, resolvedValue: diff.remoteValue };
  }
}
