import { useTranslation } from 'react-i18next';
import {
  Search,
  Pickaxe,
  Forward,
  StickyNote,
  Users,
  ChevronDown,
  X,
  CalendarRange,
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  hasDeletedTasks?: boolean;
}

export function NoteFilters({
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
  hasDeletedTasks = false,
}: NoteFiltersProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? es : enUS;

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
  void hasDeletedTasks;

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

      {/* Category filters - only action types (To Do, Follow Up, Meeting) */}
      <div className="flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={`h-8 w-8 rounded-r-none border-r-0 shadow-none ${categoryFilter === 'todo' ? 'bg-accent text-accent-foreground' : ''}`}
              onClick={() => onCategoryFilterChange(categoryFilter === 'todo' ? 'all' : 'todo')}
              aria-label={t('categoryTodo')}
            >
              <Pickaxe className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            <p>{t('filterByCategory', { category: t('categoryTodo') })}</p>
            <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>Q</Kbd></span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={`h-8 w-8 rounded-none border-r-0 shadow-none ${categoryFilter === 'followup' ? 'bg-accent text-accent-foreground' : ''}`}
              onClick={() => onCategoryFilterChange(categoryFilter === 'followup' ? 'all' : 'followup')}
              aria-label={t('categoryFollowUp')}
            >
              <Forward className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            <p>{t('filterByCategory', { category: t('categoryFollowUp') })}</p>
            <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>W</Kbd></span>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={`h-8 w-8 rounded-l-none shadow-none ${categoryFilter === 'meeting' ? 'bg-accent text-accent-foreground' : ''}`}
              onClick={() => onCategoryFilterChange(categoryFilter === 'meeting' ? 'all' : 'meeting')}
              aria-label={t('categoryMeeting')}
            >
              <Users className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            <p>{t('filterByCategory', { category: t('categoryMeeting') })}</p>
            <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>E</Kbd></span>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Notes toggle button - separate from action types */}
      {viewMode !== 'calendar' && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className={`h-8 w-8 shadow-none ${categoryFilter === 'notes' ? 'bg-accent text-accent-foreground' : ''}`}
              onClick={() => onCategoryFilterChange(categoryFilter === 'notes' ? 'all' : 'notes')}
              aria-label={t('categoryNotes')}
            >
              <StickyNote className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            <p>{t('filterByCategory', { category: t('categoryNotes') })}</p>
            <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>R</Kbd></span>
          </TooltipContent>
        </Tooltip>
      )}


      {/* Date range filter */}
      <div className="flex gap-1 items-center ml-2 pl-2 border-l border-muted-foreground/20">
        {/* Date range filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={`h-8 shadow-none ${dateRangeFilter.from || dateRangeFilter.to ? 'bg-accent text-accent-foreground' : ''}`}
              aria-label={t('dateRange.filter')}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              {dateRangeFilter.from || dateRangeFilter.to ? (
                <span className="ml-1 text-xs">
                  {dateRangeFilter.from && dateRangeFilter.to
                    ? `${format(dateRangeFilter.from, 'dd/MM', { locale })} - ${format(dateRangeFilter.to, 'dd/MM', { locale })}`
                    : dateRangeFilter.from
                      ? `${t('dateRange.from')} ${format(dateRangeFilter.from, 'dd/MM', { locale })}`
                      : `${t('dateRange.to')} ${format(dateRangeFilter.to!, 'dd/MM', { locale })}`}
                </span>
              ) : (
                <ChevronDown className="h-3 w-3 ml-0.5" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <div className="p-3 border-b">
              <p className="text-sm font-medium">{t('dateRange.filter')}</p>
              <p className="text-xs text-muted-foreground">{t('dateRange.filterDescription')}</p>
            </div>
            <Calendar
              mode="range"
              selected={{ from: dateRangeFilter.from, to: dateRangeFilter.to }}
              onSelect={(range) => {
                onDateRangeFilterChange({
                  from: range?.from,
                  to: range?.to,
                });
              }}
              locale={locale}
              weekStartsOn={1}
              numberOfMonths={1}
            />
            {(dateRangeFilter.from || dateRangeFilter.to) && (
              <div className="p-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => onDateRangeFilterChange({ from: undefined, to: undefined })}
                >
                  <X className="h-3 w-3 mr-1" />
                  {t('dateRange.clear')}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
    </>
  );
}
