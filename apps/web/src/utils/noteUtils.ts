import type { Note, NoteCategory, Label } from '@/types/note';
import { CATEGORY_ORDER, DEFAULT_CATEGORY_ORDER } from '@/constants/notes';
import { parseLocalDate, getEffectiveDeadline } from '@/utils/dateUtils';

/**
 * Sort direction type
 */
export type SortDirection = 'asc' | 'desc' | false;

/**
 * Sort configuration for notes
 */
export interface NoteSortConfig {
  category?: SortDirection;
  assignee?: SortDirection;
  deadline?: SortDirection;
  createdAt?: SortDirection;
}

/**
 * Filter configuration for notes
 */
export interface NoteFilterConfig {
  categoryFilter?: NoteCategory | 'all';
  labelFilter?: string[];
  assigneeFilter?: string[];
  searchQuery?: string;
  showOverdueOnly?: boolean;
  dateRangeFilter?: { start: Date; end: Date } | null;
  showCompleted?: boolean;
  showDeleted?: boolean;
}

/**
 * Sorts notes by pinned status first, then by category order.
 * This is the simplest sort - pinned first, then by category.
 */
export function sortNotesByCategory(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    // Pinned notes always come first
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // Then by category
    const aOrder = CATEGORY_ORDER[a.category] ?? DEFAULT_CATEGORY_ORDER;
    const bOrder = CATEGORY_ORDER[b.category] ?? DEFAULT_CATEGORY_ORDER;
    return aOrder - bOrder;
  });
}

/**
 * Sorts notes with full sort configuration support.
 * Supports sorting by category, assignee, and deadline with asc/desc direction.
 */
export function sortNotes(
  notes: Note[],
  sortConfig: NoteSortConfig,
  assigneeNamesCache?: Map<string, string | null>
): Note[] {
  // Check if any explicit sort is active
  const hasActiveSort = sortConfig.category || sortConfig.assignee || sortConfig.deadline || sortConfig.createdAt;

  return [...notes].sort((a, b) => {
    // Pinned notes come first only when no explicit sort is active
    if (!hasActiveSort) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Default: sort by created_at descending (newest first)
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return bTime - aTime;
    }

    // Sort by category if enabled
    if (sortConfig.category) {
      const aOrder = CATEGORY_ORDER[a.category] ?? DEFAULT_CATEGORY_ORDER;
      const bOrder = CATEGORY_ORDER[b.category] ?? DEFAULT_CATEGORY_ORDER;
      if (aOrder !== bOrder) {
        const result = aOrder - bOrder;
        return sortConfig.category === 'desc' ? -result : result;
      }
    }

    // Sort by assignee if enabled
    if (sortConfig.assignee && assigneeNamesCache) {
      const aName = assigneeNamesCache.get(a.id) ?? '';
      const bName = assigneeNamesCache.get(b.id) ?? '';
      // Tasks with assignee come first, then sort alphabetically
      if (aName && !bName) return -1;
      if (!aName && bName) return 1;
      if (aName && bName) {
        const nameCompare = aName.localeCompare(bName);
        if (nameCompare !== 0) {
          return sortConfig.assignee === 'desc' ? -nameCompare : nameCompare;
        }
      }
    }

    // Sort by deadline if enabled
    if (sortConfig.deadline) {
      // Notes without deadline go to the end
      if (!a.deadline && !b.deadline) return 0;
      if (!a.deadline) return 1;
      if (!b.deadline) return -1;
      // Sort by deadline (all-day tasks use end-of-day for fair comparison)
      const aTime = getEffectiveDeadline(a.deadline, a.is_all_day).getTime();
      const bTime = getEffectiveDeadline(b.deadline, b.is_all_day).getTime();
      const result = aTime - bTime;
      const finalResult = sortConfig.deadline === 'desc' ? -result : result;
      return finalResult;
    }

    // Sort by creation date if enabled
    if (sortConfig.createdAt) {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      const result = aTime - bTime;
      return sortConfig.createdAt === 'desc' ? -result : result;
    }

    return 0; // Maintain original order
  });
}

/**
 * Sorts completed notes by completion date (most recent first).
 */
export function sortCompletedNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    // Pinned notes always come first, even in completed section
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;

    // Sort by completed_at descending (most recent first)
    const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
    const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
    return bTime - aTime;
  });
}

/**
 * Filters notes based on filter configuration.
 */
export function filterNotes(
  notes: Note[],
  config: NoteFilterConfig,
  noteLabelsCache?: Map<string, Label[]>,
  noteAssigneesCache?: Map<string, string[]>
): Note[] {
  const {
    categoryFilter = 'all',
    labelFilter = [],
    assigneeFilter = [],
    searchQuery = '',
    showOverdueOnly = false,
    dateRangeFilter = null,
    showCompleted,
    showDeleted,
  } = config;

  const now = new Date();
  const query = searchQuery.trim().toLowerCase();

  return notes.filter((note) => {
    // Filter by completed status if specified
    if (showCompleted !== undefined) {
      if (showCompleted && !note.completed) return false;
      if (!showCompleted && note.completed) return false;
    }

    // Filter by deleted status if specified
    if (showDeleted !== undefined) {
      const isDeleted = note.deleted_at !== null;
      if (showDeleted && !isDeleted) return false;
      if (!showDeleted && isDeleted) return false;
    }

    // Filter by category
    if (categoryFilter !== 'all' && note.category !== categoryFilter) {
      return false;
    }

    // Filter by labels
    if (labelFilter.length > 0 && noteLabelsCache) {
      const noteLabels = noteLabelsCache.get(note.id) ?? [];
      const noteLabelIds = noteLabels.map((l) => l.id);
      if (!labelFilter.some((labelId) => noteLabelIds.includes(labelId))) {
        return false;
      }
    }

    // Filter by assignee
    if (assigneeFilter.length > 0 && noteAssigneesCache) {
      const noteAssigneeIds = noteAssigneesCache.get(note.id) ?? [];
      if (!assigneeFilter.some((contactId) => noteAssigneeIds.includes(contactId))) {
        return false;
      }
    }

    // Filter by overdue only
    if (showOverdueOnly) {
      if (!note.deadline || note.completed) return false;
      const deadlineDate = parseLocalDate(note.deadline);
      if (deadlineDate >= now) return false;
    }

    // Filter by date range
    if (dateRangeFilter) {
      if (!note.deadline) return false;
      const deadlineDate = parseLocalDate(note.deadline);
      if (deadlineDate < dateRangeFilter.start || deadlineDate > dateRangeFilter.end) {
        return false;
      }
    }

    // Filter by search query
    if (query) {
      const titleMatch = note.content.toLowerCase().includes(query);
      const descriptionMatch = note.description?.toLowerCase().includes(query) ?? false;
      if (!titleMatch && !descriptionMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Checks if a note matches the task categories (todo, followup, meeting).
 * Notes with category 'notes' are excluded.
 */
export function isTaskCategory(category: NoteCategory): boolean {
  return category === 'todo' || category === 'followup' || category === 'meeting';
}

/**
 * Separates notes into active (not completed) and completed arrays.
 */
export function separateNotesByStatus(notes: Note[]): {
  active: Note[];
  completed: Note[];
} {
  const active: Note[] = [];
  const completed: Note[] = [];

  for (const note of notes) {
    if (note.completed) {
      completed.push(note);
    } else {
      active.push(note);
    }
  }

  return { active, completed };
}
