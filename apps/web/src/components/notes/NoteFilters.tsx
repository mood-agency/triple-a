import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  deadline: SortDirection | null;
  assignee: SortDirection | null;
  category: SortDirection | null;
  createdAt: SortDirection | null;
}

interface NoteFiltersProps {
  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;

  // Category filter
  categoryFilter: NoteCategory | 'all';
  onCategoryFilterChange: (category: NoteCategory | 'all') => void;
  viewMode?: 'list' | 'calendar';

  // Label filter
  labels: Label[];
  labelFilter: string[];
  onLabelFilterChange: (labels: string[] | ((prev: string[]) => string[])) => void;

  // Sort configuration
  sortConfig: SortConfig;
  onSortConfigChange: (config: SortConfig) => void;

  // Legacy props for backwards compatibility
  sortByDeadline: boolean;
  onSortByDeadlineChange: (value: boolean) => void;
  showOverdueOnly: boolean;
  onShowOverdueOnlyChange: (value: boolean) => void;

  // Date range filter
  dateRangeFilter: DateRange;
  onDateRangeFilterChange: (range: DateRange) => void;

  // Assignee options
  sortByAssignee: boolean;
  onSortByAssigneeChange: (value: boolean) => void;

  // Category options
  sortByCategory: boolean;
  onSortByCategoryChange: (value: boolean) => void;

  // Assignee filter
  contacts: Contact[];
  assigneeFilter: string[];
  onAssigneeFilterChange: (assignees: string[] | ((prev: string[]) => string[])) => void;
  assigneePopoverOpen?: boolean;
  onAssigneePopoverOpenChange?: (open: boolean) => void;

  // Task status filter
  taskStatusFilter: 'active' | 'completed' | 'deleted';
  onTaskStatusFilterChange: (status: 'active' | 'completed' | 'deleted') => void;
  hasCompletedTasks?: boolean;
}

export const NoteFilters = memo(function NoteFilters({
  searchQuery,
  onSearchChange,
  onSearchKeyDown,
  searchInputRef,
  categoryFilter,
  onCategoryFilterChange,
  viewMode = 'list',
  labels: _labels,
  labelFilter: _labelFilter,
  onLabelFilterChange: _onLabelFilterChange,
  sortConfig,
  onSortConfigChange,
  sortByDeadline,
  onSortByDeadlineChange,
  showOverdueOnly,
  onShowOverdueOnlyChange,
  dateRangeFilter,
  onDateRangeFilterChange,
  sortByAssignee,
  onSortByAssigneeChange,
  sortByCategory,
  onSortByCategoryChange,
  contacts: _contacts,
  assigneeFilter: _assigneeFilter,
  onAssigneeFilterChange: _onAssigneeFilterChange,
  assigneePopoverOpen: _assigneePopoverOpen,
  onAssigneePopoverOpenChange: _onAssigneePopoverOpenChange,
  taskStatusFilter,
  onTaskStatusFilterChange,
  hasCompletedTasks = false,
}: NoteFiltersProps) {
  const { t } = useTranslation();

  // Suppress unused variable warnings for props now handled by toolbar dropdown
  void categoryFilter;
  void onCategoryFilterChange;
  void viewMode;
  void dateRangeFilter;
  void onDateRangeFilterChange;

  // Suppress unused variable warnings for legacy props (kept for interface compatibility)
  void sortByDeadline;
  void sortByAssignee;
  void sortByCategory;
  void onSortByDeadlineChange;
  void onSortByAssigneeChange;
  void onSortByCategoryChange;
  void _labels;
  void _labelFilter;
  void _onLabelFilterChange;
  void _contacts;
  void _assigneeFilter;
  void _onAssigneeFilterChange;
  void _assigneePopoverOpen;
  void _onAssigneePopoverOpenChange;

  // Suppress unused variable warnings for sort-related props (now handled by CommandPalette)
  void sortConfig;
  void onSortConfigChange;

  // Suppress unused variable warnings for task status props (now handled by CommandPalette)
  void showOverdueOnly;
  void onShowOverdueOnlyChange;
  void taskStatusFilter;
  void onTaskStatusFilterChange;
  void hasCompletedTasks;

  return (
    <>
      {/* Search input */}
      <div className="flex items-stretch">
        <Input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder={t('searchNotes')}
          className="h-8 w-40 rounded-r-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <Button variant="outline" size="icon" className="h-8 w-8 rounded-l-none -ml-px shadow-none" aria-label={t('searchNotes')}>
          <Search className="h-4 w-4" />
        </Button>
      </div>

    </>
  );
});
