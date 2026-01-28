import { memo } from 'react';
import {
    DndContext,
    closestCenter,
    type DragEndEvent,
    type SensorDescriptor,
    type SensorOptions,
} from '@dnd-kit/core';
import {
    SortableContext,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { EMPTY_LABELS } from '@/constants/notes';
import { CalendarView } from './CalendarView';
import { TimelineView } from './TimelineView';
import { MemoizedNoteRow } from './NoteRow';
import { NoteListEmptyState } from './NoteListEmptyState';
import { ActiveFiltersBar } from './ActiveFiltersBar';

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
    onAddAssignee: (id: string, contactId: string) => void;
    onRemoveAssignee: (id: string, contactId: string) => void;
    onUpdateAssignee?: (id: string, contactId: string | null) => void;

    // Fixed Note
    fixedNoteId: string | null;
    handleToggleFixInSidebarById: (id: string) => void;

    // Other
    handleContentChange: (content: string) => void;
    compactTaskView: boolean;
    isDescriptionFocused: boolean;
    onRestore: (note: Note) => void;

    // Empty State Props
    searchQuery: string;
    labelFilter: string[];
    assigneeFilter: string[];
    showOverdueOnly: boolean;

    // Active Filters Bar Props
    onClearCategory: () => void;
    onClearLabel: (labelId: string) => void;
    onClearAssignee: (assigneeId: string) => void;
    onClearSearch: () => void;
    onClearAllFilters: () => void;

    // Auto-save settings
    autoSaveInterval?: number; // in seconds, 0 = disabled
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
    calendarCompletedNotes,
    calendarDeletedNotes,
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
    handleCreateTaskAtTime,
    sensors,
    handleDragStart,
    handleDragEnd,
    activeId,
    labels,
    noteLabelsCache,
    handleAddLabelToNote,
    handleRemoveLabelFromNote,
    handleCreateLabelClick,
    handleCreateLabelAndAdd,
    handleEditLabel,
    contacts,
    assigneeNamesCache,
    onAddAssignee,
    onRemoveAssignee,
    onUpdateAssignee,
    fixedNoteId,
    handleToggleFixInSidebarById,
    handleContentChange,
    compactTaskView,
    isDescriptionFocused,
    onRestore,
    searchQuery,
    labelFilter,
    assigneeFilter,
    showOverdueOnly,
    onClearCategory,
    onClearLabel,
    onClearAssignee,
    onClearSearch,
    onClearAllFilters,
    autoSaveInterval = 3,
}: NoteListContentProps) {
    const { t } = useTranslation();

    const NoResultsMessage = ({ completedCount, fillHeight = true }: { completedCount?: number; fillHeight?: boolean }) => {
        return <NoteListEmptyState
            completedCount={completedCount}
            shouldShowOnlyCompletedMessage={shouldShowOnlyCompletedMessage}
            fillHeight={fillHeight}
        />;
    };

    return (
        <div className={`${isMobile ? 'w-full' : 'w-[30%]'} ${isMobile && selectedNote ? 'hidden' : ''} shrink-0 flex flex-col overflow-hidden`}>
            <ActiveFiltersBar
                categoryFilter={categoryFilter}
                labelFilter={labelFilter}
                assigneeFilter={assigneeFilter}
                searchQuery={searchQuery}
                labels={labels}
                contacts={contacts}
                onClearCategory={onClearCategory}
                onClearLabel={onClearLabel}
                onClearAssignee={onClearAssignee}
                onClearSearch={onClearSearch}
                onClearAll={onClearAllFilters}
            />
            {notes.length === 0 ? (
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
                        <TimelineView
                            notes={calendarFilteredNotes}
                            completedNotes={calendarCompletedNotes}
                            deletedNotes={calendarDeletedNotes}
                            selectedDate={calendarSelectedDate}
                            selectedNote={selectedNote}
                            onSelectNote={handleSelectNoteById}
                            onDeleteWithToast={handleDeleteWithToast}
                            onToggleCompleted={handleToggleCompletedWithNavigation}
                            onTogglePinned={onTogglePinned}
                            onEdit={onEdit}
                            onNavigateDown={handleNavigateDownById}
                            onNavigateUp={handleNavigateUpById}
                            onNavigateToDescription={handleNavigateToDescription}
                            focusTarget={focusTarget}
                            desiredColumn={desiredColumn}
                            onTitleFocused={handleTitleFocused}
                            onCreateNoteAfter={handleCreateNoteAfterById}
                            onCreateTaskAtTime={handleCreateTaskAtTime}
                            labels={labels}
                            noteLabelsCache={noteLabelsCache}
                            onAddLabel={handleAddLabelToNote}
                            onRemoveLabel={handleRemoveLabelFromNote}
                            onCreateLabel={handleCreateLabelClick}
                            onEditLabel={handleEditLabel}
                            fixedNoteId={fixedNoteId}
                            onToggleFixInSidebar={handleToggleFixInSidebarById}
                            onContentChange={handleContentChange}
                            assigneeNamesCache={assigneeNamesCache}
                            compactView={compactTaskView}
                            isDescriptionFocused={isDescriptionFocused}
                            contacts={contacts}
                            onAddAssignee={onAddAssignee}
                            onRemoveAssignee={onRemoveAssignee}
                            onUpdateAssignee={onUpdateAssignee}
                            taskStatusFilter={taskStatusFilter}
                            onRestoreNote={(noteId) => {
                                const note = calendarDeletedNotes.find(n => n.id === noteId);
                                if (note) onRestore(note);
                            }}
                            hasActiveFilters={hasActiveFilters}
                            renderNoResultsMessage={(completedCount) => <NoResultsMessage completedCount={completedCount} />}
                            sortByCategory={false} // Assuming default false or passed prop
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
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={activeNotes.map((n) => n.id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            {activeNotes.map((note) => (
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
                                                    isDragging={activeId === note.id}
                                                    labels={noteLabelsCache.get(note.id) ?? EMPTY_LABELS}
                                                    allLabels={labels}
                                                    onAddLabel={handleAddLabelToNote}
                                                    onRemoveLabel={handleRemoveLabelFromNote}
                                                    onCreateLabel={handleCreateLabelClick}
                                                    onCreateLabelAndAdd={handleCreateLabelAndAdd}
                                                    onEditLabel={handleEditLabel}
                                                    isFixedInSidebar={fixedNoteId === note.id}
                                                    onToggleFixInSidebar={handleToggleFixInSidebarById}
                                                    onContentChange={selectedNote?.id === note.id ? handleContentChange : undefined}
                                                    assigneeName={assigneeNamesCache.get(note.id)}
                                                    compactView={compactTaskView}
                                                    isDescriptionFocused={isDescriptionFocused && selectedNote?.id === note.id}
                                                    contacts={contacts}
                                                    onAddAssignee={onAddAssignee}
                                                    onRemoveAssignee={onRemoveAssignee}
                                                    onUpdateAssignee={onUpdateAssignee}
                                                    autoSaveInterval={autoSaveInterval}
                                                />
                                            ))}
                                        </SortableContext>
                                    </DndContext>
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
                                            onContentChange={selectedNote?.id === note.id ? handleContentChange : undefined}
                                            contacts={contacts}
                                            onAddAssignee={onAddAssignee}
                                            onRemoveAssignee={onRemoveAssignee}
                                            onUpdateAssignee={onUpdateAssignee}
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
                                            onContentChange={selectedNote?.id === note.id ? handleContentChange : undefined}
                                            assigneeName={assigneeNamesCache.get(note.id)}
                                            isDeleted={true}
                                            onRestore={() => onRestore(note)}
                                            compactView={compactTaskView}
                                            isDescriptionFocused={isDescriptionFocused && selectedNote?.id === note.id}
                                                                                        contacts={contacts}
                                                                                        onAddAssignee={onAddAssignee}
                                                                                        onRemoveAssignee={onRemoveAssignee}
                                                                                        onUpdateAssignee={onUpdateAssignee}
                                                                                        autoSaveInterval={autoSaveInterval}
                                                                                    />                                    ))}
                                </div>
                            </div>
                        ) : hasActiveFilters ? (
                            <NoResultsMessage />
                        ) : null
                    )}
                </>
            )}
        </div>
    );
});
