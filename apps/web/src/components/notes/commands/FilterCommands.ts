import type {
  FilterCommand,
  FilterState,
  SerializableFilterCommand,
  SerializableFilterState,
  SortConfigType,
} from './types';
import type { NoteCategory } from '@/types/note';

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * Abstract base class providing common command functionality
 */
abstract class BaseFilterCommand implements FilterCommand {
  abstract readonly type: string;
  abstract readonly description: string;
  readonly timestamp: number;
  protected previousState: Partial<FilterState> = {};

  constructor() {
    this.timestamp = Date.now();
  }

  abstract execute(currentState: FilterState): FilterState;

  undo(currentState: FilterState): FilterState {
    return { ...currentState, ...this.previousState };
  }

  abstract toJSON(): SerializableFilterCommand;

  protected serializeDateRange(range: { from: Date | undefined; to: Date | undefined }) {
    return {
      from: range.from?.toISOString() ?? null,
      to: range.to?.toISOString() ?? null,
    };
  }

  protected serializePreviousState(): Partial<SerializableFilterState> {
    const state = { ...this.previousState };
    if (state.dateRangeFilter) {
      const { dateRangeFilter, ...rest } = state;
      return {
        ...rest,
        dateRangeFilter: this.serializeDateRange(dateRangeFilter),
      } as Partial<SerializableFilterState>;
    }
    return state as Partial<SerializableFilterState>;
  }
}

/**
 * Command to change the category filter
 */
export class SetCategoryFilterCommand extends BaseFilterCommand {
  readonly type = 'SET_CATEGORY_FILTER';
  readonly description: string;
  private readonly newCategory: NoteCategory | 'all';

  constructor(
    newCategory: NoteCategory | 'all',
    t: TranslationFn
  ) {
    super();
    this.newCategory = newCategory;
    this.description =
      newCategory === 'all'
        ? t('commands.clearCategoryFilter')
        : t('commands.setCategoryFilter', { category: t(`category${capitalize(newCategory)}`) });
  }

  execute(currentState: FilterState): FilterState {
    this.previousState = { categoryFilter: currentState.categoryFilter };
    return { ...currentState, categoryFilter: this.newCategory };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: { newCategory: this.newCategory },
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Command to toggle a label in the filter (add if not present, remove if present)
 */
export class ToggleLabelFilterCommand extends BaseFilterCommand {
  readonly type = 'TOGGLE_LABEL_FILTER';
  readonly description: string;
  private readonly labelId: string;
  private readonly labelName: string;

  constructor(
    labelId: string,
    labelName: string,
    t: TranslationFn
  ) {
    super();
    this.labelId = labelId;
    this.labelName = labelName;
    this.description = t('commands.toggleLabelFilter', { label: labelName });
  }

  execute(currentState: FilterState): FilterState {
    this.previousState = { labelFilter: [...currentState.labelFilter] };
    const exists = currentState.labelFilter.includes(this.labelId);
    return {
      ...currentState,
      labelFilter: exists
        ? currentState.labelFilter.filter((id) => id !== this.labelId)
        : [...currentState.labelFilter, this.labelId],
    };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: { labelId: this.labelId, labelName: this.labelName },
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Command to remove a label from the filter
 */
export class RemoveLabelFilterCommand extends BaseFilterCommand {
  readonly type = 'REMOVE_LABEL_FILTER';
  readonly description: string;
  private readonly labelId: string;
  private readonly labelName: string;

  constructor(
    labelId: string,
    labelName: string,
    t: TranslationFn
  ) {
    super();
    this.labelId = labelId;
    this.labelName = labelName;
    this.description = t('commands.removeLabelFilter', { label: labelName });
  }

  execute(currentState: FilterState): FilterState {
    this.previousState = { labelFilter: [...currentState.labelFilter] };
    return {
      ...currentState,
      labelFilter: currentState.labelFilter.filter((id) => id !== this.labelId),
    };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: { labelId: this.labelId, labelName: this.labelName },
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Command to add an assignee to the filter
 */
export class AddAssigneeFilterCommand extends BaseFilterCommand {
  readonly type = 'ADD_ASSIGNEE_FILTER';
  readonly description: string;
  private readonly assigneeId: string;
  private readonly assigneeName: string;

  constructor(
    assigneeId: string,
    assigneeName: string,
    t: TranslationFn
  ) {
    super();
    this.assigneeId = assigneeId;
    this.assigneeName = assigneeName;
    this.description = t('commands.addAssigneeFilter', { assignee: assigneeName });
  }

  execute(currentState: FilterState): FilterState {
    this.previousState = { assigneeFilter: [...currentState.assigneeFilter] };
    if (currentState.assigneeFilter.includes(this.assigneeId)) {
      return currentState; // Already present, no-op
    }
    return {
      ...currentState,
      assigneeFilter: [...currentState.assigneeFilter, this.assigneeId],
    };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: { assigneeId: this.assigneeId, assigneeName: this.assigneeName },
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Command to remove an assignee from the filter
 */
export class RemoveAssigneeFilterCommand extends BaseFilterCommand {
  readonly type = 'REMOVE_ASSIGNEE_FILTER';
  readonly description: string;
  private readonly assigneeId: string;
  private readonly assigneeName: string;

  constructor(
    assigneeId: string,
    assigneeName: string,
    t: TranslationFn
  ) {
    super();
    this.assigneeId = assigneeId;
    this.assigneeName = assigneeName;
    this.description = t('commands.removeAssigneeFilter', { assignee: assigneeName });
  }

  execute(currentState: FilterState): FilterState {
    this.previousState = { assigneeFilter: [...currentState.assigneeFilter] };
    return {
      ...currentState,
      assigneeFilter: currentState.assigneeFilter.filter((id) => id !== this.assigneeId),
    };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: { assigneeId: this.assigneeId, assigneeName: this.assigneeName },
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Command to set the search query
 */
export class SetSearchQueryCommand extends BaseFilterCommand {
  readonly type = 'SET_SEARCH_QUERY';
  readonly description: string;
  private readonly newQuery: string;

  constructor(
    newQuery: string,
    prevQuery: string,
    t: TranslationFn
  ) {
    super();
    this.newQuery = newQuery;
    this.description = newQuery ? t('commands.setSearchQuery') : t('commands.clearSearchQuery');
    // Store previous state immediately since we know it
    this.previousState = { searchQuery: prevQuery };
  }

  execute(currentState: FilterState): FilterState {
    return { ...currentState, searchQuery: this.newQuery };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: { newQuery: this.newQuery },
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Command to set the sort configuration
 */
export class SetSortConfigCommand extends BaseFilterCommand {
  readonly type = 'SET_SORT_CONFIG';
  readonly description: string;
  private readonly newConfig: SortConfigType;

  constructor(
    newConfig: SortConfigType,
    t: TranslationFn
  ) {
    super();
    this.newConfig = newConfig;
    const activeSort = Object.entries(newConfig).find(([, v]) => v !== null);
    this.description = activeSort
      ? t(`commands.setSortBy${capitalize(activeSort[0])}`)
      : t('commands.clearSort');
  }

  execute(currentState: FilterState): FilterState {
    this.previousState = { sortConfig: { ...currentState.sortConfig } };
    return { ...currentState, sortConfig: this.newConfig };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: { newConfig: this.newConfig },
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Command to set the date range filter
 */
export class SetDateRangeFilterCommand extends BaseFilterCommand {
  readonly type = 'SET_DATE_RANGE_FILTER';
  readonly description: string;
  private readonly newRange: { from: Date | undefined; to: Date | undefined };

  constructor(
    newRange: { from: Date | undefined; to: Date | undefined },
    t: TranslationFn
  ) {
    super();
    this.newRange = newRange;
    this.description =
      newRange.from || newRange.to
        ? t('commands.setDateRangeFilter')
        : t('commands.clearDateRangeFilter');
  }

  execute(currentState: FilterState): FilterState {
    this.previousState = { dateRangeFilter: { ...currentState.dateRangeFilter } };
    return { ...currentState, dateRangeFilter: this.newRange };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: this.serializeDateRange(this.newRange),
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Command to set the task status filter
 */
export class SetTaskStatusFilterCommand extends BaseFilterCommand {
  readonly type = 'SET_TASK_STATUS_FILTER';
  readonly description: string;
  private readonly newStatus: 'active' | 'completed' | 'deleted';

  constructor(
    newStatus: 'active' | 'completed' | 'deleted',
    t: TranslationFn
  ) {
    super();
    this.newStatus = newStatus;
    this.description = t(`commands.setTaskStatus${capitalize(newStatus)}`);
  }

  execute(currentState: FilterState): FilterState {
    this.previousState = { taskStatusFilter: currentState.taskStatusFilter, showOverdueOnly: currentState.showOverdueOnly };
    return { ...currentState, taskStatusFilter: this.newStatus, showOverdueOnly: false };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: { newStatus: this.newStatus },
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Command to toggle the overdue-only filter
 */
export class ToggleOverdueOnlyCommand extends BaseFilterCommand {
  readonly type = 'TOGGLE_OVERDUE_ONLY';
  readonly description: string;

  constructor(t: TranslationFn) {
    super();
    this.description = t('commands.toggleOverdueOnly');
  }

  execute(currentState: FilterState): FilterState {
    const newOverdue = !currentState.showOverdueOnly;
    this.previousState = { showOverdueOnly: currentState.showOverdueOnly, taskStatusFilter: currentState.taskStatusFilter };
    return { ...currentState, showOverdueOnly: newOverdue, ...(newOverdue ? { taskStatusFilter: 'active' as const } : {}) };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: {},
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Command to set overdue-only filter to a specific value
 */
export class SetOverdueOnlyCommand extends BaseFilterCommand {
  readonly type = 'SET_OVERDUE_ONLY';
  readonly description: string;
  private readonly newValue: boolean;

  constructor(
    newValue: boolean,
    t: TranslationFn
  ) {
    super();
    this.newValue = newValue;
    this.description = newValue
      ? t('commands.showOverdueOnly')
      : t('commands.clearOverdueOnly');
  }

  execute(currentState: FilterState): FilterState {
    this.previousState = { showOverdueOnly: currentState.showOverdueOnly, taskStatusFilter: currentState.taskStatusFilter };
    return { ...currentState, showOverdueOnly: this.newValue, ...(this.newValue ? { taskStatusFilter: 'active' as const } : {}) };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: { newValue: this.newValue },
      previousState: this.serializePreviousState(),
    };
  }
}

/**
 * Composite command to clear all filters at once
 */
export class ClearAllFiltersCommand extends BaseFilterCommand {
  readonly type = 'CLEAR_ALL_FILTERS';
  readonly description: string;

  constructor(t: TranslationFn) {
    super();
    this.description = t('commands.clearAllFilters');
  }

  execute(currentState: FilterState): FilterState {
    // Store complete previous state for proper undo
    this.previousState = { ...currentState };

    return {
      categoryFilter: 'all',
      labelFilter: [],
      assigneeFilter: [],
      searchQuery: '',
      sortConfig: { deadline: null, assignee: null, category: null },
      dateRangeFilter: { from: undefined, to: undefined },
      taskStatusFilter: 'active',
      showOverdueOnly: false,
    };
  }

  toJSON(): SerializableFilterCommand {
    return {
      type: this.type,
      description: this.description,
      timestamp: this.timestamp,
      payload: {},
      previousState: this.serializePreviousState(),
    };
  }
}

// Helper function
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
