import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Separator } from '@/components/ui/separator';
import { Plus, List, Calendar, AlignJustify, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { NoteFilters } from './NoteFilters';
import { Logo } from '@/components/Logo';
import { useTranslation } from 'react-i18next';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';

interface NoteListToolbarProps {
    isMobile: boolean;
    selectedNote: Note | null;
    sidebarTrigger?: React.ReactNode;
    onCreateTask?: () => void;
    viewMode: 'list' | 'calendar';
    setViewMode: (mode: 'list' | 'calendar') => void;
    compactTaskView: boolean;
    setCompactTaskView: (compact: boolean) => void;

    // NoteFilters props
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    categoryFilter: NoteCategory | 'all';
    setCategoryFilter: (category: NoteCategory | 'all') => void;
    labels: Label[];
    labelFilter: string[];
    setLabelFilter: (labels: string[] | ((prev: string[]) => string[])) => void;
    sortConfig: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null };
    setSortConfig: (config: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null }) => void;
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
    assigneeFilter: string[];
    setAssigneeFilter: (assignees: string[] | ((prev: string[]) => string[])) => void;
    assigneePopoverOpen?: boolean;
    setAssigneePopoverOpen?: (open: boolean) => void;
    taskStatusFilter: 'active' | 'completed' | 'deleted';
    setTaskStatusFilter: (status: 'active' | 'completed' | 'deleted') => void;
    hasCompletedTasks: boolean;
    hasDeletedTasks: boolean;

    // Sidebar
    fixedNoteId: string | null;
    showSidebar: boolean;
    setShowSidebar: (show: boolean) => void;
    setFixedNoteId: (id: string | null) => void;

    // Keyboard handlers for search
    onSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export function NoteListToolbar({
    isMobile,
    selectedNote,
    sidebarTrigger,
    onCreateTask,
    viewMode,
    setViewMode,
    compactTaskView,
    setCompactTaskView,
    searchQuery,
    setSearchQuery,
    searchInputRef,
    categoryFilter,
    setCategoryFilter,
    labels,
    labelFilter,
    setLabelFilter,
    sortConfig,
    setSortConfig,
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
    assigneeFilter,
    setAssigneeFilter,
    assigneePopoverOpen,
    setAssigneePopoverOpen,
    taskStatusFilter,
    setTaskStatusFilter,
    hasCompletedTasks,
    hasDeletedTasks,
    fixedNoteId,
    showSidebar,
    setShowSidebar,
    setFixedNoteId,
    onSearchKeyDown,
}: NoteListToolbarProps) {
    const { t } = useTranslation();

    return (
        <div className={`flex-shrink-0 group ${isMobile && selectedNote ? 'hidden' : ''}`}>
        <div className="flex items-center gap-2 mb-2">
            {/* Logo - first position */}
            <Logo size="sm" className="mr-1" />

            {/* Hideable toolbar content */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">

            {/* Sidebar trigger */}
            {sidebarTrigger}

            {/* Create task button */}
            {onCreateTask && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button onClick={onCreateTask} size="icon" variant="outline" className="h-8 w-8 shadow-none">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{t('newTask')}</p>
                    </TooltipContent>
                </Tooltip>
            )}

            {/* View mode toggle */}
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
                        className="h-8 w-8 shadow-none"
                        aria-label={viewMode === 'list' ? t('calendar.switchToCalendarView') : t('calendar.switchToListView')}
                    >
                        {viewMode === 'list' ? <List className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                    </Button>
                </TooltipTrigger>
                <TooltipContent className="flex items-center gap-2">
                    <p>{viewMode === 'list' ? t('calendar.switchToCalendarView') : t('calendar.switchToListView')}</p>
                    <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>Shift</Kbd><Kbd>C</Kbd></span>
                </TooltipContent>
            </Tooltip>
            {/* Compact view toggle - hide on mobile */}
            {!isMobile && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCompactTaskView(!compactTaskView)}
                            className="h-8 w-8 shadow-none"
                            aria-label={t('compactView')}
                        >
                            {compactTaskView ? <AlignJustify className="h-4 w-4" /> : <List className="h-4 w-4" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{compactTaskView ? t('fullViewTooltip') : t('compactViewTooltip')}</p>
                    </TooltipContent>
                </Tooltip>
            )}
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
                onSortConfigChange={setSortConfig}
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
                hasDeletedTasks={hasDeletedTasks}
            />
            {/* Sidebar button - only show when a note is fixed to sidebar (hide on mobile) */}
            {fixedNoteId && !isMobile && (
                <div className="ml-auto">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                type="button"
                                onClick={() => {
                                    if (showSidebar) {
                                        // When closing sidebar, also clear the fixed note
                                        setFixedNoteId(null);
                                    }
                                    setShowSidebar(!showSidebar);
                                }}
                                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                            >
                                {showSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                            </button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>{showSidebar ? t('hideSidebar') : t('showSidebar')}</p>
                        </TooltipContent>
                    </Tooltip>
                </div>
            )}
            </div>
        </div>
        <Separator className="mb-3" />
        </div>
    );
}
