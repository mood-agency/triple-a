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
  AlertTriangle,
} from 'lucide-react';
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
import type { NoteCategory, Label } from '@/types/note';

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

  // Deadline options
  sortByDeadline: boolean;
  onSortByDeadlineChange: (value: boolean) => void;
  showOverdueOnly: boolean;
  onShowOverdueOnlyChange: (value: boolean) => void;

  // Assignee options
  sortByAssignee: boolean;
  onSortByAssigneeChange: (value: boolean) => void;
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
  sortByDeadline,
  onSortByDeadlineChange,
  showOverdueOnly,
  onShowOverdueOnlyChange,
  sortByAssignee,
  onSortByAssigneeChange,
}: NoteFiltersProps) {
  const { t } = useTranslation();

  const toggleCategory = (category: NoteCategory) => {
    onCategoryFilterChange(categoryFilter === category ? 'all' : category);
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

      {/* Category filters */}
      <div className="flex gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={categoryFilter === 'todo' ? 'default' : 'outline'}
              size="sm"
              className="shadow-none"
              onClick={() => toggleCategory('todo')}
              aria-label={t('categoryTodo')}
            >
              <Pickaxe className="h-3.5 w-3.5" />
              <span>{t('categoryTodo')}</span>
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
              variant={categoryFilter === 'followup' ? 'default' : 'outline'}
              size="sm"
              className="shadow-none"
              onClick={() => toggleCategory('followup')}
              aria-label={t('categoryFollowUp')}
            >
              <Forward className="h-3.5 w-3.5" />
              <span>{t('categoryFollowUp')}</span>
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
              variant={categoryFilter === 'meeting' ? 'default' : 'outline'}
              size="sm"
              className="shadow-none"
              onClick={() => toggleCategory('meeting')}
              aria-label={t('categoryMeeting')}
            >
              <Users className="h-3.5 w-3.5" />
              <span>{t('categoryMeeting')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            <p>{t('filterByCategory', { category: t('categoryMeeting') })}</p>
            <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>R</Kbd></span>
          </TooltipContent>
        </Tooltip>
        {viewMode !== 'calendar' && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={categoryFilter === 'notes' ? 'default' : 'outline'}
                size="sm"
                className="shadow-none"
                onClick={() => toggleCategory('notes')}
                aria-label={t('categoryNotes')}
              >
                <StickyNote className="h-3.5 w-3.5" />
                <span>{t('categoryNotes')}</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
              <p>{t('filterByCategory', { category: t('categoryNotes') })}</p>
              <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>E</Kbd></span>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Label filters dropdown */}
      {labels.length > 0 && (
        <div className="flex gap-1 items-center ml-2 pl-2 border-l border-muted-foreground/20">
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
        </div>
      )}

      {/* Deadline and sort options */}
      <div className="flex gap-1 items-center ml-2 pl-2 border-l border-muted-foreground/20">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={sortByDeadline ? 'default' : 'outline'}
              size="icon"
              className="h-8 w-8 shadow-none"
              onClick={() => onSortByDeadlineChange(!sortByDeadline)}
              aria-label={t('sortByDeadline')}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('sortByDeadline')}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={sortByAssignee ? 'default' : 'outline'}
              size="icon"
              className="h-8 w-8 shadow-none"
              onClick={() => onSortByAssigneeChange(!sortByAssignee)}
              aria-label={t('sortByAssignee')}
            >
              <User className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('sortByAssignee')}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showOverdueOnly ? 'destructive' : 'outline'}
              size="sm"
              className="shadow-none"
              onClick={() => onShowOverdueOnlyChange(!showOverdueOnly)}
              aria-label={t('showOverdueOnly')}
            >
              <AlertTriangle className="h-3 w-3" />
              <span>{t('overdue')}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('showOverdueOnly')}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </>
  );
}
