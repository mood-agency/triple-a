import { useTranslation } from 'react-i18next';
import {
  Search,
  Pickaxe,
  Forward,
  StickyNote,
  Users,
  User,
  Tag,
  ChevronDown,
  Check,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  CircleDot,
  CheckCircle2,
  Trash2,
  CalendarRange,
  Layers,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  labels,
  labelFilter,
  onLabelFilterChange,
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
  contacts,
  assigneeFilter,
  onAssigneeFilterChange,
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

  // Helper to check if any sort is active
  const hasActiveSort = sortConfig.deadline !== null || sortConfig.assignee !== null || sortConfig.category !== null;

  // Helper to set specific sort direction
  const setSort = (field: keyof SortConfig, direction: SortDirection | null) => {
    onSortConfigChange({ ...sortConfig, [field]: direction });

    // Also update legacy props for backwards compatibility
    if (field === 'deadline') {
      onSortByDeadlineChange(direction !== null);
    } else if (field === 'assignee') {
      onSortByAssigneeChange(direction !== null);
    } else if (field === 'category') {
      onSortByCategoryChange(direction !== null);
    }
  };

  // Get sort icon for a field
  const getSortIcon = (field: keyof SortConfig) => {
    const direction = sortConfig[field];
    if (direction === 'asc') return <ArrowUp className="h-3 w-3" />;
    if (direction === 'desc') return <ArrowDown className="h-3 w-3" />;
    return null;
  };

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

      {/* Label and Assignee filters dropdown */}
      {(labels.length > 0 || contacts.length > 0) && (
        <div className="flex gap-1 items-center ml-2 pl-2 border-l border-muted-foreground/20">
          {/* Labels dropdown */}
          {labels.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="shadow-none" aria-label={t('labels')}>
                  <Tag className="h-3.5 w-3.5" />
                  <span>{t('labels')}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('searchLabels')} className="h-9" />
                  <CommandList>
                    <CommandEmpty>{t('noLabelsFound')}</CommandEmpty>
                    <CommandGroup>
                      {labels.map((label) => {
                        const isSelected = labelFilter.includes(label.id);
                        return (
                          <CommandItem
                            key={label.id}
                            value={label.name}
                            onSelect={() => {
                              onLabelFilterChange((prev) =>
                                prev.includes(label.id)
                                  ? prev.filter((id) => id !== label.id)
                                  : [...prev, label.id]
                              );
                            }}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center">
                              <span
                                className="w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: label.color }}
                              />
                              {label.name}
                            </div>
                            {isSelected && <Check className="h-4 w-4" />}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          {/* Assignee dropdown */}
          {contacts.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="shadow-none" aria-label={t('filterByAssignee')}>
                  <User className="h-3.5 w-3.5" />
                  <span>{t('assignee.placeholder')}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-52 p-0" align="start">
                <Command>
                  <CommandInput placeholder={t('searchContacts')} className="h-9" />
                  <CommandList>
                    <CommandEmpty>{t('noContactsFound')}</CommandEmpty>
                    <CommandGroup>
                      {contacts.map((contact) => {
                        const isSelected = assigneeFilter.includes(contact.id);
                        const fullName = `${contact.name} ${contact.lastname}`.trim();
                        return (
                          <CommandItem
                            key={contact.id}
                            value={fullName}
                            onSelect={() => {
                              onAssigneeFilterChange((prev) =>
                                prev.includes(contact.id)
                                  ? prev.filter((id) => id !== contact.id)
                                  : [...prev, contact.id]
                              );
                            }}
                            className="flex items-center justify-between"
                          >
                            <span>{fullName}</span>
                            {isSelected && <Check className="h-4 w-4" />}
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
          {/* Selected label chips */}
          {labelFilter.length > 0 && (
            <div className="flex gap-1 items-center">
              {labelFilter.map((labelId) => {
                const label = labels.find((l) => l.id === labelId);
                if (!label) return null;
                return (
                  <span
                    key={label.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                    <button
                      type="button"
                      onClick={() =>
                        onLabelFilterChange((prev) => prev.filter((id) => id !== label.id))
                      }
                      className="hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
          {/* Selected assignee chips */}
          {assigneeFilter.length > 0 && (
            <div className="flex gap-1 items-center">
              {assigneeFilter.map((contactId) => {
                const contact = contacts.find((c) => c.id === contactId);
                if (!contact) return null;
                const fullName = `${contact.name} ${contact.lastname}`.trim();
                return (
                  <span
                    key={contact.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-input bg-background text-foreground"
                  >
                    {fullName}
                    <button
                      type="button"
                      onClick={() =>
                        onAssigneeFilterChange((prev) => prev.filter((id) => id !== contact.id))
                      }
                      className="hover:bg-muted rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Sort menu and other options */}
      <div className="flex gap-1 items-center ml-2 pl-2 border-l border-muted-foreground/20">
        {/* Sort dropdown menu */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 shadow-none gap-1 ${hasActiveSort ? 'bg-accent text-accent-foreground' : ''}`}
                  aria-label={t('sort.title')}
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {hasActiveSort && (
                    <span className="text-xs">
                      {sortConfig.deadline && (
                        <span className="flex items-center gap-0.5">
                          <CalendarIcon className="h-3 w-3" />
                          {getSortIcon('deadline')}
                        </span>
                      )}
                      {sortConfig.assignee && (
                        <span className="flex items-center gap-0.5">
                          <User className="h-3 w-3" />
                          {getSortIcon('assignee')}
                        </span>
                      )}
                      {sortConfig.category && (
                        <span className="flex items-center gap-0.5">
                          <Layers className="h-3 w-3" />
                          {getSortIcon('category')}
                        </span>
                      )}
                    </span>
                  )}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('sort.title')}</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>{t('sort.title')}</DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Deadline sort options */}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              {t('sort.deadline')}
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setSort('deadline', 'asc')}
              className="pl-6"
            >
              <ArrowUp className="h-4 w-4 mr-2" />
              {t('sort.deadlineAsc')}
              {sortConfig.deadline === 'asc' && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSort('deadline', 'desc')}
              className="pl-6"
            >
              <ArrowDown className="h-4 w-4 mr-2" />
              {t('sort.deadlineDesc')}
              {sortConfig.deadline === 'desc' && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Assignee sort options */}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              {t('sort.assignee')}
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setSort('assignee', 'asc')}
              className="pl-6"
            >
              <ArrowUp className="h-4 w-4 mr-2" />
              {t('sort.assigneeAsc')}
              {sortConfig.assignee === 'asc' && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSort('assignee', 'desc')}
              className="pl-6"
            >
              <ArrowDown className="h-4 w-4 mr-2" />
              {t('sort.assigneeDesc')}
              {sortConfig.assignee === 'desc' && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {/* Category sort options */}
            <DropdownMenuLabel className="text-xs font-normal text-muted-foreground flex items-center gap-2">
              <Layers className="h-3.5 w-3.5" />
              {t('sort.category')}
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => setSort('category', 'asc')}
              className="pl-6"
            >
              <ArrowUp className="h-4 w-4 mr-2" />
              {t('sort.categoryAsc')}
              {sortConfig.category === 'asc' && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSort('category', 'desc')}
              className="pl-6"
            >
              <ArrowDown className="h-4 w-4 mr-2" />
              {t('sort.categoryDesc')}
              {sortConfig.category === 'desc' && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>

            {/* Clear all sorts */}
            {hasActiveSort && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onSortConfigChange({ deadline: null, assignee: null, category: null })}
                  className="text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  {t('sort.none')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Task status filter dropdown */}
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-8 shadow-none gap-1 ${showOverdueOnly ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}`}
                  aria-label={t('taskStatus.title')}
                >
                  {taskStatusFilter === 'active' && <CircleDot className="h-4 w-4" />}
                  {taskStatusFilter === 'completed' && <CheckCircle2 className="h-4 w-4" />}
                  {taskStatusFilter === 'deleted' && <Trash2 className="h-4 w-4" />}
                  {showOverdueOnly && <AlertTriangle className="h-3 w-3" />}
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('taskStatus.title')}</p>
            </TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel>{t('taskStatus.title')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onTaskStatusFilterChange('active')}>
              <CircleDot className="h-4 w-4 mr-2" />
              {t('taskStatus.active')}
              {taskStatusFilter === 'active' && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
            {hasCompletedTasks && (
              <DropdownMenuItem onClick={() => onTaskStatusFilterChange('completed')}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {t('taskStatus.completed')}
                {taskStatusFilter === 'completed' && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
            )}
            {hasDeletedTasks && (
              <DropdownMenuItem onClick={() => onTaskStatusFilterChange('deleted')}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t('taskStatus.deleted')}
                {taskStatusFilter === 'deleted' && <Check className="h-4 w-4 ml-auto" />}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onShowOverdueOnlyChange(!showOverdueOnly)}>
              <AlertTriangle className="h-4 w-4 mr-2" />
              {t('taskStatus.overdue')}
              {showOverdueOnly && <Check className="h-4 w-4 ml-auto" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

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
