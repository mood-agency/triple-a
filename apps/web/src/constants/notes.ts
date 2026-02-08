import type { NoteCategory, Label } from '@/types/note';

export interface CategoryBehavior {
  allowsCheckbox: boolean;
  showsDeadline: boolean;
  showsAssignees: boolean;
  showsOverdueRed: boolean;
  visibleInDefaultList: boolean;
  visibleInCalendar: boolean;
  hidePastItems: boolean;
  excludeFromOverdueFilter: boolean;
  showCategoryInAISummary: boolean;
}

export const CATEGORY_CONFIG: Record<NoteCategory, CategoryBehavior> = {
  todo:     { allowsCheckbox: true,  showsDeadline: true,  showsAssignees: true,  showsOverdueRed: true,  visibleInDefaultList: true,  visibleInCalendar: true,  hidePastItems: false, excludeFromOverdueFilter: false, showCategoryInAISummary: true  },
  followup: { allowsCheckbox: true,  showsDeadline: true,  showsAssignees: true,  showsOverdueRed: true,  visibleInDefaultList: true,  visibleInCalendar: true,  hidePastItems: false, excludeFromOverdueFilter: false, showCategoryInAISummary: true  },
  meeting:  { allowsCheckbox: false, showsDeadline: true,  showsAssignees: true,  showsOverdueRed: false, visibleInDefaultList: true,  visibleInCalendar: true,  hidePastItems: true,  excludeFromOverdueFilter: true,  showCategoryInAISummary: true  },
  notes:    { allowsCheckbox: false, showsDeadline: false, showsAssignees: false, showsOverdueRed: false, visibleInDefaultList: false, visibleInCalendar: false, hidePastItems: false, excludeFromOverdueFilter: true,  showCategoryInAISummary: false },
};

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
export const EMPTY_LABELS: Label[] = [];
