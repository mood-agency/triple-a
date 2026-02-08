import { memo } from 'react';
import type { DragEndEvent, SensorDescriptor, SensorOptions } from '@dnd-kit/core';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'motion/react';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import type { NoteCreationDefaults } from '@/utils/noteCreationDefaults';
import { EMPTY_LABELS } from '@/constants/notes';
import { useEventSubscription } from '@/events';
import { CalendarView } from './CalendarView';
import { TimelineBlockNoteList } from './TimelineBlockNoteList';
import { MemoizedNoteRow } from './NoteRow';
import { BlockNoteNoteList } from './BlockNoteNoteList';
import { NoteListEmptyState } from './NoteListEmptyState';
import { ActiveFiltersBar } from './ActiveFiltersBar';

const EMPTY_ASSIGNEES: Contact[] = [];

interface NoteListContentProps {
    isMobile: boolean;
    notes: Note[];
    viewMode: 'list' | 'calendar';
    selectedNote: Note | null;
    categoryFilter: NoteCategory | 'all';
    calendarSelectedDate?: Date;
    setCalendarSelectedDate: (date: Date | undefined) => void;
    calendarFilteredNotes: Note[];
    calendarCompletedNotes: Note[];
    calendarDeletedNotes: Note[];
    activeNotes: Note[];
    filteredNotes: Note[];
    completedNotes: Note[];
    deletedNotes: Note[];
    taskStatusFilter: 'active' | 'completed' | 'deleted';
    shouldShowOnlyCompletedMessage: boolean;
    hasActiveFilters: boolean;
    shouldShowNoResultsWithPinnedVisible: boolean;

    // Handlers
    handleSelectNoteById: (id: string) => void;
    handleDeleteWithToast: (note: Note, reason: string) => void;
    handleToggleCompletedWithNavigation: (id: string, completed: boolean) => void;
    onTogglePinned: (id: string, pinned: boolean) => void;
    onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
    handleNavigateDownById: (id: string, column: number) => boolean;
    handleNavigateUpById: (id: string, column: number) => boolean;
    handleNavigateToDescription: () => void;
    focusTarget: 'title' | 'description-start' | 'description-end' | null;
    desiredColumn: number;
    handleTitleFocused: () => void;
    handleCreateNoteAfterById: (id: string) => void;
    handleCreateTaskAtTime: (hour: number) => void;
    onCreateNoteAfter?: (afterNoteId: string, category: NoteCategory, deadline?: string | null, labelIds?: string[], assigneeId?: string | null, newNoteId?: string) => Promise<Note>;

    // Drag and Drop
    sensors: SensorDescriptor<SensorOptions>[];
    handleDragStart: (event: { active: { id: string | number } }) => void;
    handleDragEnd: (event: DragEndEvent) => void;
    activeId: string | null;

    // Labels & Contacts
    labels: Label[];
    noteLabelsCache: Map<string, Label[]>;
    handleAddLabelToNote: (noteId: string, labelId: string) => void;
    handleRemoveLabelFromNote: (noteId: string, labelId: string) => void;
    handleCreateLabelClick: () => void;
    handleCreateLabelAndAdd: (noteId: string, labelName: string) => void;
    handleEditLabel: (label: Label) => void;
    contacts: Contact[];
    assigneeNamesCache: Map<string, string | null>;
    noteAssigneesCache: Map<string, Contact[]>;
    onAddAssignee: (id: string, contactId: string) => void;
    onRemoveAssignee: (id: string, contactId: string) => void;
    onUpdateAssignee?: (id: string, contactId: string | null) => void;

    // Fixed Note
    fixedNoteId: string | null;
    handleToggleFixInSidebarById: (id: string) => void;

    // Other
    compactTaskView: boolean;
    isDescriptionFocused: boolean;
    onRestore: (note: Note) => void;

    // Empty State Props
    searchQuery: string;
    labelFilter: string[];
    assigneeFilter: string[];
    showOverdueOnly: boolean;
    showPublicOnly: boolean;

    // Sort & Status
    sortConfig: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null; createdAt: 'asc' | 'desc' | null };

    // Active Filters Bar Props
    onClearCategory: () => void;
    onClearLabel: (labelId: string) => void;
    onClearAssignee: (assigneeId: string) => void;
    onClearSearch: () => void;
    onClearSort: () => void;
    onClearTaskStatus: () => void;
    onClearOverdue: () => void;
    onClearPublic: () => void;
    onClearAllFilters: () => void;

    // Auto-save settings
    autoSaveInterval?: number; // in seconds, 0 = disabled

    // Toolbar rendered inside the left column
    toolbar?: React.ReactNode;

    // Note creation defaults based on active filters
    noteCreationDefaults?: NoteCreationDefaults;
}

export const NoteListContent = memo(function NoteListContent({
    isMobile,
    notes,
    viewMode,
    selectedNote,
    categoryFilter,
    calendarSelectedDate,
    setCalendarSelectedDate,
    calendarFilteredNotes,
    calendarCompletedNotes: _calendarCompletedNotes,
    calendarDeletedNotes: _calendarDeletedNotes,
    activeNotes,
    filteredNotes,
    completedNotes,
    deletedNotes,
    taskStatusFilter,
    shouldShowOnlyCompletedMessage,
    hasActiveFilters,
    shouldShowNoResultsWithPinnedVisible,
    handleSelectNoteById,
    handleDeleteWithToast,
    handleToggleCompletedWithNavigation,
    onTogglePinned,
    onEdit,
    handleNavigateDownById,
    handleNavigateUpById,
    handleNavigateToDescription,
    focusTarget,
    desiredColumn,
    handleTitleFocused,
    handleCreateNoteAfterById,
    handleCreateTaskAtTime: _handleCreateTaskAtTime,
    onCreateNoteAfter: _onCreateNoteAfter,
    sensors: _sensors,
    handleDragStart: _handleDragStart,
    handleDragEnd: _handleDragEnd,
    activeId: _activeId,
    labels,
    noteLabelsCache,
    handleAddLabelToNote,
    handleRemoveLabelFromNote,
    handleCreateLabelClick,
    handleCreateLabelAndAdd,
    handleEditLabel,
    contacts,
    assigneeNamesCache,
    noteAssigneesCache,
    onAddAssignee,
    onRemoveAssignee,
    onUpdateAssignee,
    fixedNoteId,
    handleToggleFixInSidebarById,
    compactTaskView,
    isDescriptionFocused,
    onRestore,
    searchQuery,
    labelFilter,
    assigneeFilter,
    showOverdueOnly,
    showPublicOnly,
    sortConfig,
    onClearCategory,
    onClearLabel,
    onClearAssignee,
    onClearSearch,
    onClearSort,
    onClearTaskStatus,
    onClearOverdue,
    onClearPublic,
    onClearAllFilters,
    autoSaveInterval = 3,
    toolbar,
    noteCreationDefaults,
}: NoteListContentProps) {
    const { t } = useTranslation();

    // Listen for save success events from BlockNote components (via event bus)
    useEventSubscription('editor:saveSuccess', (event) => {
        toast.success(t('toast.noteSaved', { count: event.payload.savedCount }));
    });

    const NoResultsMessage = ({ completedCount, fillHeight = true }: { completedCount?: number; fillHeight?: boolean }) => {
        return <NoteListEmptyState
            completedCount={completedCount}
            shouldShowOnlyCompletedMessage={shouldShowOnlyCompletedMessage}
            fillHeight={fillHeight}
        />;
    };

    return (
        <motion.div
            initial={{ borderRightColor: "rgba(255, 255, 255, 0)" }}
            animate={{ borderRightColor: "rgba(255, 255, 255, 0.08)" }}
            transition={{ duration: 5, ease: "linear" }}
            className={`${isMobile ? 'w-full' : 'w-[calc(30%+1rem)] -ml-4 pl-4 pr-1 -mt-4 pt-4 -mb-4 pb-4'} ${!isMobile ? 'border-r' : ''} ${isMobile && selectedNote ? 'hidden' : ''} shrink-0 flex flex-col overflow-hidden bg-[#121212]`}
        >
            {toolbar}
            <AnimatePresence>
                <ActiveFiltersBar
                    key="active-filters-bar"
                    categoryFilter={categoryFilter}
                    labelFilter={labelFilter}
                    assigneeFilter={assigneeFilter}
                    searchQuery={searchQuery}
                    labels={labels}
                    contacts={contacts}
                    sortConfig={sortConfig}
                    taskStatusFilter={taskStatusFilter}
                    showOverdueOnly={showOverdueOnly}
                    showPublicOnly={showPublicOnly}
                    onClearCategory={onClearCategory}
                    onClearLabel={onClearLabel}
                    onClearAssignee={onClearAssignee}
                    onClearSearch={onClearSearch}
                    onClearSort={onClearSort}
                    onClearTaskStatus={onClearTaskStatus}
                    onClearOverdue={onClearOverdue}
                    onClearPublic={onClearPublic}
                    onClearAll={onClearAllFilters}
                />
            </AnimatePresence>
            {
                notes.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-center text-muted-foreground/60 text-sm italic">
                            {t('noNotes')}
                        </p>
                    </div>
                ) : viewMode === 'calendar' ? (
                    <div className="flex flex-col h-full overflow-hidden">
                        {/* Calendar picker - left aligned */}
                        <div className="flex-shrink-0 py-2">
                            <CalendarView
                                notes={notes}
                                categoryFilter={categoryFilter}
                                selectedDate={calendarSelectedDate}
                                onSelectDate={setCalendarSelectedDate}
                                labelFilter={labelFilter}
                                assigneeFilter={assigneeFilter}
                                searchQuery={searchQuery}
                                showOverdueOnly={showOverdueOnly}
                                noteLabelsCache={noteLabelsCache}
                            />
                        </div>
                        {/* Timeline view for selected date - below calendar */}
                        {calendarSelectedDate ? (
                            <TimelineBlockNoteList
                                notes={calendarFilteredNotes}
                                noteLabelsCache={noteLabelsCache}
                                noteAssigneesCache={noteAssigneesCache}
                                onNavigateToDescription={handleNavigateToDescription}
                                onSelectNote={handleSelectNoteById}
                                onToggleFixInSidebar={handleToggleFixInSidebarById}
                                onEdit={onEdit}
                                onToggleCompleted={handleToggleCompletedWithNavigation}
                                onDelete={(noteId, reason) => {
                                    const note = notes.find(n => n.id === noteId);
                                    if (note) handleDeleteWithToast(note, reason);
                                }}
                                onTogglePinned={onTogglePinned}
                                onCreateNoteAfter={_onCreateNoteAfter}
                                onAddLabel={handleAddLabelToNote}
                                onCreateLabelAndAdd={handleCreateLabelAndAdd}
                                onAddAssignee={onAddAssignee}
                                compactView={compactTaskView}
                                fixedNoteId={fixedNoteId}
                                hideEmptyHours={true}
                                startHour={8}
                                endHour={20}
                            />
                        ) : (
                            <p className="text-sm text-muted-foreground/50 italic p-4 text-center">
                                {t('calendar.selectDateHint')}
                            </p>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Active tasks section */}
                        {taskStatusFilter === 'active' && (
                            <div className="overflow-y-auto pr-2 flex-[3] flex flex-col">
                                {/* Show message when no active tasks but have filters */}
                                {shouldShowOnlyCompletedMessage ? (
                                    <NoResultsMessage />
                                ) : activeNotes.length === 0 && filteredNotes.length === 0 && hasActiveFilters ? (
                                    <NoResultsMessage />
                                ) : (
                                    <>
                                        {/* Pass filtered notes when filters are active, otherwise pass all active notes */}
                                        <BlockNoteNoteList
                                            notes={hasActiveFilters ? filteredNotes : activeNotes}
                                            noteLabelsCache={noteLabelsCache}
                                            noteAssigneesCache={noteAssigneesCache}
                                            compactView={compactTaskView}
                                            fixedNoteId={fixedNoteId}
                                            onNavigateToDescription={handleNavigateToDescription}
                                            onSelectNote={handleSelectNoteById}
                                            onToggleFixInSidebar={handleToggleFixInSidebarById}
                                            onEdit={onEdit}
                                            onToggleCompleted={handleToggleCompletedWithNavigation}
                                            onDelete={(noteId, reason) => {
                                                const note = notes.find(n => n.id === noteId);
                                                if (note) handleDeleteWithToast(note, reason);
                                            }}
                                            onTogglePinned={onTogglePinned}
                                            onCreateNoteAfter={_onCreateNoteAfter}
                                            onAddLabel={handleAddLabelToNote}
                                            onCreateLabelAndAdd={handleCreateLabelAndAdd}
                                            onAddAssignee={onAddAssignee}
                                            selectedNoteId={selectedNote?.id}
                                            noteCreationDefaults={noteCreationDefaults}
                                        />
                                        {/* Show no results message after pinned notes when they don't match filters */}
                                        {shouldShowNoResultsWithPinnedVisible && (
                                            <NoResultsMessage fillHeight={false} />
                                        )}
                                    </>
                                )}
                            </div>
                        )}

                        {/* Completed tasks section */}
                        {taskStatusFilter === 'completed' && (
                            completedNotes.length > 0 ? (
                                <div className="flex-1 border-t border-dashed border-muted-foreground/20 mt-2 pt-2 overflow-hidden flex flex-col">
                                    <div className="text-xs text-muted-foreground/60 mb-1 px-1 flex-shrink-0">
                                        {t('completedTasks')} ({completedNotes.length})
                                    </div>
                                    <div className="overflow-y-auto pr-2 flex-1">
                                        {completedNotes.map((note) => (
                                            <MemoizedNoteRow
                                                key={note.id}
                                                note={note}
                                                onDeleteWithToast={handleDeleteWithToast}
                                                onToggleCompleted={handleToggleCompletedWithNavigation}
                                                onTogglePinned={onTogglePinned}
                                                isSelected={selectedNote?.id === note.id}
                                                onSelect={handleSelectNoteById}
                                                onEdit={onEdit}
                                                onNavigateDown={handleNavigateDownById}
                                                onNavigateUp={handleNavigateUpById}
                                                onNavigateToDescription={handleNavigateToDescription}
                                                shouldFocusTitle={focusTarget === 'title' && selectedNote?.id === note.id}
                                                desiredColumn={desiredColumn}
                                                onTitleFocused={handleTitleFocused}
                                                onCreateNoteAfter={handleCreateNoteAfterById}
                                                isDragging={false}
                                                labels={noteLabelsCache.get(note.id) ?? EMPTY_LABELS}
                                                allLabels={labels}
                                                onAddLabel={handleAddLabelToNote}
                                                onRemoveLabel={handleRemoveLabelFromNote}
                                                onCreateLabel={handleCreateLabelClick}
                                                onCreateLabelAndAdd={handleCreateLabelAndAdd}
                                                onEditLabel={handleEditLabel}
                                                isFixedInSidebar={fixedNoteId === note.id}
                                                onToggleFixInSidebar={handleToggleFixInSidebarById}
                                                assignees={noteAssigneesCache.get(note.id) ?? EMPTY_ASSIGNEES}
                                                contacts={contacts}
                                                onAddAssignee={onAddAssignee}
                                                onRemoveAssignee={onRemoveAssignee}
                                                onUpdateAssignee={onUpdateAssignee}
                                                compactView={compactTaskView}
                                                autoSaveInterval={autoSaveInterval}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : hasActiveFilters ? (
                                <NoResultsMessage />
                            ) : null
                        )}

                        {/* Deleted tasks section */}
                        {taskStatusFilter === 'deleted' && (
                            deletedNotes.length > 0 ? (
                                <div className="flex-1 border-t border-dashed border-muted-foreground/20 mt-2 pt-2 overflow-hidden flex flex-col">
                                    <div className="text-xs text-muted-foreground/60 mb-1 px-1 flex-shrink-0">
                                        {t('trash.title')} ({deletedNotes.length})
                                    </div>
                                    <div className="overflow-y-auto pr-2 flex-1">
                                        {deletedNotes.map((note) => (
                                            <MemoizedNoteRow
                                                key={note.id}
                                                note={note}
                                                onDeleteWithToast={handleDeleteWithToast}
                                                onToggleCompleted={handleToggleCompletedWithNavigation}
                                                onTogglePinned={onTogglePinned}
                                                isSelected={selectedNote?.id === note.id}
                                                onSelect={handleSelectNoteById}
                                                onEdit={onEdit}
                                                onNavigateDown={handleNavigateDownById}
                                                onNavigateUp={handleNavigateUpById}
                                                onNavigateToDescription={handleNavigateToDescription}
                                                shouldFocusTitle={focusTarget === 'title' && selectedNote?.id === note.id}
                                                desiredColumn={desiredColumn}
                                                onTitleFocused={handleTitleFocused}
                                                onCreateNoteAfter={handleCreateNoteAfterById}
                                                isDragging={false}
                                                labels={noteLabelsCache.get(note.id) ?? EMPTY_LABELS}
                                                allLabels={labels}
                                                onAddLabel={handleAddLabelToNote}
                                                onRemoveLabel={handleRemoveLabelFromNote}
                                                onCreateLabel={handleCreateLabelClick}
                                                onCreateLabelAndAdd={handleCreateLabelAndAdd}
                                                onEditLabel={handleEditLabel}
                                                isFixedInSidebar={fixedNoteId === note.id}
                                                onToggleFixInSidebar={handleToggleFixInSidebarById}
                                                assigneeName={assigneeNamesCache.get(note.id)}
                                                assignees={noteAssigneesCache.get(note.id) ?? EMPTY_ASSIGNEES}
                                                isDeleted={true}
                                                onRestore={() => onRestore(note)}
                                                compactView={compactTaskView}
                                                isDescriptionFocused={isDescriptionFocused && selectedNote?.id === note.id}
                                                contacts={contacts}
                                                onAddAssignee={onAddAssignee}
                                                onRemoveAssignee={onRemoveAssignee}
                                                onUpdateAssignee={onUpdateAssignee}
                                                autoSaveInterval={autoSaveInterval}
                                            />))}
                                    </div>
                                </div>
                            ) : hasActiveFilters ? (
                                <NoResultsMessage />
                            ) : null
                        )}
                    </>
                )
            }
        </motion.div >
    );
});
