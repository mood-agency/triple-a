import type { NoteCategory } from '@/types/note';

export interface NoteCreationFilters {
  categoryFilter: NoteCategory | 'all';
  labelFilter: string[];
  assigneeFilter: string[];
  dateRangeFilter: { from: Date | undefined; to: Date | undefined };
  defaultContactId?: string | null;
}

export interface NoteCreationDefaults {
  category: NoteCategory;
  labelIds: string[];
  assigneeId: string | null;
  deadline: string | null;
}

/**
 * Computes default properties for a new note based on active filters.
 * When filters are active, new notes inherit filter values so they remain visible.
 * When no filters are active, new notes get clean defaults.
 */
export function getNoteCreationDefaults(filters: NoteCreationFilters): NoteCreationDefaults {
  const category: NoteCategory = filters.categoryFilter !== 'all'
    ? filters.categoryFilter
    : 'todo';

  const labelIds: string[] = [...filters.labelFilter];

  // Assignee priority:
  // 1. If exactly 1 assignee is filtered, use it (filter takes precedence)
  // 2. Otherwise, use default contact if available
  // 3. Otherwise, null
  let assigneeId: string | null = null;
  if (filters.assigneeFilter.length === 1) {
    assigneeId = filters.assigneeFilter[0];
  } else if (filters.defaultContactId) {
    assigneeId = filters.defaultContactId;
  }

  let deadline: string | null = null;
  if (filters.dateRangeFilter.from) {
    deadline = formatLocalDateString(filters.dateRangeFilter.from);
  } else if (filters.dateRangeFilter.to) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const to = new Date(filters.dateRangeFilter.to);
    to.setHours(0, 0, 0, 0);
    deadline = formatLocalDateString(today <= to ? today : filters.dateRangeFilter.to);
  }

  return { category, labelIds, assigneeId, deadline };
}

function formatLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
