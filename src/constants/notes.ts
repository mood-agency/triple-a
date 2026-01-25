import type { NoteCategory } from '@/types/note';

/**
 * Category order for sorting notes.
 * Lower number = higher priority in the list.
 */
export const CATEGORY_ORDER: Record<NoteCategory, number> = {
  todo: 0,
  followup: 1,
  meeting: 2,
  notes: 3,
};

/**
 * Default category order value for unknown categories.
 */
export const DEFAULT_CATEGORY_ORDER = 99;

/**
 * Empty array constant to avoid creating new array references.
 * Use this when you need an empty labels array to maintain referential equality.
 */
export const EMPTY_LABELS: never[] = [];
