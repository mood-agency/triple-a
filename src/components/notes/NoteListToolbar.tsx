import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Plus, List, Calendar, AlignJustify, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { NoteFilters } from './NoteFilters';
import { useTranslation } from 'react-i18next';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import type { NoteSortConfig } from '@/utils/noteUtils';

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
    setLabelFilter: (labels: string[]) => void;
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
    setAssigneeFilter: (assignees: string[]) => void;
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
        <div className={`flex items-center gap-2 mb-3 flex-shrink-0 ${isMobile && selectedNote ? 'hidden' : ''}`}>
            {/* Sidebar trigger - first position */}
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
            <div className="flex">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className={`h-8 w-8 rounded-r-none border-r-0 shadow-none ${viewMode === 'list' ? 'bg-accent text-accent-foreground' : ''}`}
                            onClick={() => setViewMode('list')}
                            aria-label={t('calendar.switchToListView')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                        <p>{t('calendar.switchToListView')}</p>
                        <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>Shift</Kbd><Kbd>C</Kbd></span>
                    </TooltipContent>
                </Tooltip>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className={`h-8 w-8 rounded-l-none shadow-none ${viewMode === 'calendar' ? 'bg-accent text-accent-foreground' : ''}`}
                            onClick={() => setViewMode('calendar')}
                            aria-label={t('calendar.switchToCalendarView')}
                        >
                            <Calendar className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="flex items-center gap-2">
                        <p>{t('calendar.switchToCalendarView')}</p>
                        <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>Shift</Kbd><Kbd>C</Kbd></span>
                    </TooltipContent>
                </Tooltip>
            </div>
            {/* Compact view toggle - hide on mobile */}
            {!isMobile && (
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCompactTaskView(!compactTaskView)}
                            className={`h-8 w-8 shadow-none ${compactTaskView ? 'bg-accent text-accent-foreground' : ''}`}
                            aria-label={t('compactView')}
                        >
                            <AlignJustify className="h-4 w-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{t('compactViewTooltip')}</p>
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
    );
}
