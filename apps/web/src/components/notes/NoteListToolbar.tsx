import { useState, useCallback, useRef, memo } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { List, Calendar as CalendarIcon, AlignJustify, Copy, Check, Sparkles, Ellipsis, Pickaxe, Forward, Users, StickyNote, CalendarRange, X } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { NoteFilters } from './NoteFilters';
import { AISummaryDialog } from './AISummaryDialog';
import type { AIProviderConfig } from '@/hooks/useSettings';
import { Logo } from '@/components/Logo';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { es, enUS, ptBR } from 'date-fns/locale';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { formatLocalDate, parseLocalDate } from '@/utils/dateUtils';

interface NoteListToolbarProps {
    isMobile: boolean;
    selectedNote: Note | null;
    sidebarTrigger?: React.ReactNode;
    viewMode: 'list' | 'calendar';
    setViewMode: (mode: 'list' | 'calendar') => void;
    compactTaskView: boolean;
    setCompactTaskView: (compact: boolean) => void;
    // Active notes for copy functionality
    activeNotes: Note[];
    // Labels cache for copy functionality
    noteLabelsCache: Map<string, Label[]>;
    // AI provider for summary feature
    aiProvider?: AIProviderConfig | null;

    // NoteFilters props
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    categoryFilter: NoteCategory | 'all';
    setCategoryFilter: (category: NoteCategory | 'all') => void;
    labels: Label[];
    labelFilter: string[];
    setLabelFilter: (labels: string[] | ((prev: string[]) => string[])) => void;
    sortConfig: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null; createdAt: 'asc' | 'desc' | null };
    onSortConfigChange: (config: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null; createdAt: 'asc' | 'desc' | null }) => void;
    sortByDeadline: boolean;
    setSortByDeadline: (sort: boolean) => void;
    showOverdueOnly: boolean;
    setShowOverdueOnly: (show: boolean) => void;
    dateRangeFilter: { from: Date | undefined; to: Date | undefined };
    setDateRangeFilter: (range: { from: Date | undefined; to: Date | undefined }) => void;
    sortByAssignee: boolean;
    setSortByAssignee: (sort: boolean) => void;
    sortByCategory: boolean;
    setSortByCategory: (sort: boolean) => void;
    contacts: Contact[];
    noteAssigneesCache: Map<string, Contact[]>;
    assigneeFilter: string[];
    setAssigneeFilter: (assignees: string[] | ((prev: string[]) => string[])) => void;
    assigneePopoverOpen?: boolean;
    setAssigneePopoverOpen?: (open: boolean) => void;
    taskStatusFilter: 'active' | 'completed' | 'deleted';
    setTaskStatusFilter: (status: 'active' | 'completed' | 'deleted') => void;
    hasCompletedTasks: boolean;

    // Keyboard handlers for search
    onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export const NoteListToolbar = memo(function NoteListToolbar({
    isMobile,
    selectedNote,
    sidebarTrigger,
    viewMode,
    setViewMode,
    compactTaskView,
    setCompactTaskView,
    activeNotes,
    noteLabelsCache,
    aiProvider,
    searchQuery,
    setSearchQuery,
    searchInputRef,
    categoryFilter,
    setCategoryFilter,
    labels,
    labelFilter,
    setLabelFilter,
    sortConfig,
    onSortConfigChange,
    sortByDeadline,
    setSortByDeadline,
    showOverdueOnly,
    setShowOverdueOnly,
    dateRangeFilter,
    setDateRangeFilter,
    sortByAssignee,
    setSortByAssignee,
    sortByCategory,
    setSortByCategory,
    contacts,
    noteAssigneesCache,
    assigneeFilter,
    setAssigneeFilter,
    assigneePopoverOpen,
    setAssigneePopoverOpen,
    taskStatusFilter,
    setTaskStatusFilter,
    hasCompletedTasks,
    onSearchKeyDown,
}: NoteListToolbarProps) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language === 'es' ? es : i18n.language === 'pt' ? ptBR : enUS;
    const [copied, setCopied] = useState(false);
    const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
    const [dateRangeDialogOpen, setDateRangeDialogOpen] = useState(false);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [keepVisible, setKeepVisible] = useState(false);
    const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleDropdownOpenChange = useCallback((open: boolean) => {
        setDropdownOpen(open);
        if (!open) {
            // Grace period after closing so toolbar doesn't vanish instantly
            setKeepVisible(true);
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            hideTimeoutRef.current = setTimeout(() => {
                setKeepVisible(false);
                // Blur after grace period so group-focus-within doesn't keep toolbar stuck.
                // Must run after Radix restores focus to the trigger.
                (document.activeElement as HTMLElement)?.blur();
            }, 500);
        } else {
            if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
            setKeepVisible(false);
        }
    }, []);

    const handleCopyTasks = useCallback(async () => {
        if (activeNotes.length === 0) return;

        const formattedTasks = activeNotes.map((note) => {
            const parts: string[] = [];

            // Title
            parts.push(`- ${note.content}`);

            // Labels
            const noteLabels = noteLabelsCache.get(note.id) ?? [];
            if (noteLabels.length > 0) {
                const labelNames = noteLabels.map(l => l.name).join(', ');
                parts.push(`  ${t('labels')}: ${labelNames}`);
            }

            // Deadline
            if (note.deadline) {
                const date = parseLocalDate(note.deadline);
                const formattedDate = formatLocalDate(date);
                parts.push(`  ${t('deadline')}: ${formattedDate}`);
            }

            // Assignee
            const assignees = noteAssigneesCache.get(note.id) ?? [];
            if (assignees.length > 0) {
                const contact = assignees[0];
                const name = contact.lastname
                    ? `${contact.name} ${contact.lastname}`
                    : contact.name;
                parts.push(`  ${t('assignee.placeholder')}: ${name}`);
            }

            return parts.join('\n');
        }).join('\n\n');

        const textToCopy = `${formattedTasks}\n\nCopiado desde Triple A`;

        try {
            await navigator.clipboard.writeText(textToCopy);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy tasks:', err);
        }
    }, [activeNotes, noteLabelsCache, noteAssigneesCache, t]);

    return (
        <div className={`flex-shrink-0 group relative z-10 ${isMobile && selectedNote ? 'hidden' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
                {/* Logo - first position */}
                <Logo size="sm" className="mr-1" />

                {/* Hideable toolbar content */}
                <div className={`flex items-center gap-2 transition-opacity duration-200 ${dropdownOpen || keepVisible ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}>

                    {/* Sidebar trigger */}
                    {sidebarTrigger}

                    <NoteFilters
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        onSearchKeyDown={onSearchKeyDown}
                        searchInputRef={searchInputRef}
                        categoryFilter={categoryFilter}
                        onCategoryFilterChange={setCategoryFilter}
                        viewMode={viewMode}
                        labels={labels}
                        labelFilter={labelFilter}
                        onLabelFilterChange={setLabelFilter}
                        sortConfig={sortConfig}
                        onSortConfigChange={onSortConfigChange}
                        sortByDeadline={sortByDeadline}
                        onSortByDeadlineChange={setSortByDeadline}
                        showOverdueOnly={showOverdueOnly}
                        onShowOverdueOnlyChange={setShowOverdueOnly}
                        dateRangeFilter={dateRangeFilter}
                        onDateRangeFilterChange={setDateRangeFilter}
                        sortByAssignee={sortByAssignee}
                        onSortByAssigneeChange={setSortByAssignee}
                        sortByCategory={sortByCategory}
                        onSortByCategoryChange={setSortByCategory}
                        contacts={contacts}
                        assigneeFilter={assigneeFilter}
                        onAssigneeFilterChange={setAssigneeFilter}
                        assigneePopoverOpen={assigneePopoverOpen}
                        onAssigneePopoverOpenChange={setAssigneePopoverOpen}
                        taskStatusFilter={taskStatusFilter}
                        onTaskStatusFilterChange={setTaskStatusFilter}
                        hasCompletedTasks={hasCompletedTasks}
                    />
                    {/* More options dropdown */}
                    <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownOpenChange}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-8 w-8 shadow-none"
                                aria-label={t('toolbar.moreOptions')}
                            >
                                <Ellipsis className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}>
                                {viewMode === 'list' ? <CalendarIcon className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
                                {viewMode === 'list' ? t('calendar.switchToCalendarView') : t('calendar.switchToListView')}
                                <span className="ml-auto text-xs text-muted-foreground">Alt+V</span>
                            </DropdownMenuItem>
                            {!isMobile && (
                                <DropdownMenuItem onClick={() => setCompactTaskView(!compactTaskView)}>
                                    {compactTaskView ? <AlignJustify className="h-4 w-4 mr-2" /> : <List className="h-4 w-4 mr-2" />}
                                    {compactTaskView ? t('fullViewTooltip') : t('compactViewTooltip')}
                                    <span className="ml-auto text-xs text-muted-foreground">Alt+F</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                onClick={handleCopyTasks}
                                disabled={activeNotes.length === 0}
                            >
                                {copied ? <Check className="h-4 w-4 mr-2 text-green-500" /> : <Copy className="h-4 w-4 mr-2" />}
                                {t('copyActiveTasks')} ({activeNotes.length})
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => setSummaryDialogOpen(true)}
                                disabled={activeNotes.length === 0 || !aiProvider}
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                {t('ai.summary.button')} ({activeNotes.length})
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setCategoryFilter(categoryFilter === 'todo' ? 'all' : 'todo')}>
                                <Pickaxe className="h-4 w-4 mr-2" />
                                {t('filterByCategory', { category: t('categoryTodo') })}
                                {categoryFilter === 'todo' && <Check className="h-4 w-4 ml-auto" />}
                                <span className="ml-auto text-xs text-muted-foreground">Alt+Q</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCategoryFilter(categoryFilter === 'followup' ? 'all' : 'followup')}>
                                <Forward className="h-4 w-4 mr-2" />
                                {t('filterByCategory', { category: t('categoryFollowUp') })}
                                {categoryFilter === 'followup' && <Check className="h-4 w-4 ml-auto" />}
                                <span className="ml-auto text-xs text-muted-foreground">Alt+W</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCategoryFilter(categoryFilter === 'meeting' ? 'all' : 'meeting')}>
                                <Users className="h-4 w-4 mr-2" />
                                {t('filterByCategory', { category: t('categoryMeeting') })}
                                {categoryFilter === 'meeting' && <Check className="h-4 w-4 ml-auto" />}
                                <span className="ml-auto text-xs text-muted-foreground">Alt+E</span>
                            </DropdownMenuItem>
                            {viewMode !== 'calendar' && (
                                <DropdownMenuItem onClick={() => setCategoryFilter(categoryFilter === 'notes' ? 'all' : 'notes')}>
                                    <StickyNote className="h-4 w-4 mr-2" />
                                    {t('filterByCategory', { category: t('categoryNotes') })}
                                    {categoryFilter === 'notes' && <Check className="h-4 w-4 ml-auto" />}
                                    <span className="ml-auto text-xs text-muted-foreground">Alt+R</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDateRangeDialogOpen(true)}>
                                <CalendarRange className="h-4 w-4 mr-2" />
                                {t('dateRange.filter')}
                                {(dateRangeFilter.from || dateRangeFilter.to) && (
                                    <span className="ml-auto text-xs text-muted-foreground">
                                        {dateRangeFilter.from && dateRangeFilter.to
                                            ? `${format(dateRangeFilter.from, 'dd/MM', { locale })} - ${format(dateRangeFilter.to, 'dd/MM', { locale })}`
                                            : dateRangeFilter.from
                                                ? format(dateRangeFilter.from, 'dd/MM', { locale })
                                                : format(dateRangeFilter.to!, 'dd/MM', { locale })}
                                    </span>
                                )}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* AI Summary Dialog */}
            {aiProvider && (
                <AISummaryDialog
                    open={summaryDialogOpen}
                    onOpenChange={setSummaryDialogOpen}
                    notes={activeNotes}
                    aiProvider={aiProvider}
                    noteAssigneesCache={noteAssigneesCache}
                />
            )}

            {/* Date Range Dialog */}
            <Dialog open={dateRangeDialogOpen} onOpenChange={setDateRangeDialogOpen}>
                <DialogContent className="w-auto max-w-fit">
                    <DialogHeader>
                        <DialogTitle>{t('dateRange.filter')}</DialogTitle>
                        <DialogDescription>{t('dateRange.filterDescription')}</DialogDescription>
                    </DialogHeader>
                    <Calendar
                        mode="range"
                        selected={{ from: dateRangeFilter.from, to: dateRangeFilter.to }}
                        onSelect={(range) => {
                            setDateRangeFilter({
                                from: range?.from,
                                to: range?.to,
                            });
                        }}
                        locale={locale}
                        weekStartsOn={1}
                        numberOfMonths={1}
                    />
                    {(dateRangeFilter.from || dateRangeFilter.to) && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                                setDateRangeFilter({ from: undefined, to: undefined });
                                setDateRangeDialogOpen(false);
                            }}
                        >
                            <X className="h-3 w-3 mr-1" />
                            {t('dateRange.clear')}
                        </Button>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
});
