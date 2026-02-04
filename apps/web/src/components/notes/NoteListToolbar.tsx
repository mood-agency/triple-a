import { useState, useCallback, memo } from 'react';
import { Button } from '@/components/ui/button';
import { LazyTooltip } from '@/components/ui/lazy-tooltip';
import { Kbd } from '@/components/ui/kbd';
import { List, Calendar, AlignJustify, Copy, Check, Sparkles } from 'lucide-react';
import { NoteFilters } from './NoteFilters';
import { AISummaryDialog } from './AISummaryDialog';
import type { AIProviderConfig } from '@/hooks/useSettings';
import { Logo } from '@/components/Logo';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);

    const handleCopyTasks = useCallback(async () => {
        if (activeNotes.length === 0) return;

        const formattedTasks = activeNotes.map((note) => {
            const parts: string[] = [];

            // Title
            parts.push(`- ${note.content}`);

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

        try {
            await navigator.clipboard.writeText(formattedTasks);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy tasks:', err);
        }
    }, [activeNotes, contacts, noteAssigneesCache, t]);

    return (
        <div className={`flex-shrink-0 group ${isMobile && selectedNote ? 'hidden' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
                {/* Logo - first position */}
                <Logo size="sm" className="mr-1" />

                {/* Hideable toolbar content */}
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">

                    {/* Sidebar trigger */}
                    {sidebarTrigger}

                    {/* View mode toggle */}
                    <LazyTooltip
                        content={
                            <span className="flex items-center gap-2">
                                <p>{viewMode === 'list' ? t('calendar.switchToCalendarView') : t('calendar.switchToListView')}</p>
                                <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>V</Kbd></span>
                            </span>
                        }
                    >
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
                            className="h-8 w-8 shadow-none"
                            aria-label={viewMode === 'list' ? t('calendar.switchToCalendarView') : t('calendar.switchToListView')}
                        >
                            {viewMode === 'list' ? <List className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                        </Button>
                    </LazyTooltip>
                    {/* Compact view toggle - hide on mobile */}
                    {!isMobile && (
                        <LazyTooltip content={compactTaskView ? t('fullViewTooltip') : t('compactViewTooltip')}>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => setCompactTaskView(!compactTaskView)}
                                className="h-8 w-8 shadow-none"
                                aria-label={t('compactView')}
                            >
                                {compactTaskView ? <AlignJustify className="h-4 w-4" /> : <List className="h-4 w-4" />}
                            </Button>
                        </LazyTooltip>
                    )}
                    {/* Copy active tasks button */}
                    <LazyTooltip content={`${t('copyActiveTasks')} (${activeNotes.length})`}>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={handleCopyTasks}
                            className="h-8 w-8 shadow-none"
                            aria-label={t('copyActiveTasks')}
                            disabled={activeNotes.length === 0}
                        >
                            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                    </LazyTooltip>
                    {/* AI Summary button */}
                    <LazyTooltip content={aiProvider ? `${t('ai.summary.button')} (${activeNotes.length})` : t('ai.notConfigured')}>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setSummaryDialogOpen(true)}
                            className="h-8 w-8 shadow-none"
                            aria-label={t('ai.summary.button')}
                            disabled={activeNotes.length === 0 || !aiProvider}
                        >
                            <Sparkles className="h-4 w-4" />
                        </Button>
                    </LazyTooltip>
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
        </div>
    );
});
