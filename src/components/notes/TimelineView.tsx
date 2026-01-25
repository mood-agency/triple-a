import { useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { MemoizedNoteRow } from './NoteRow';
import { hasTimeComponent, getHourFromDeadline } from '@/utils/dateUtils';

interface TimelineViewProps {
  notes: Note[];
  completedNotes: Note[];
  deletedNotes: Note[];
  selectedDate: Date;
  selectedNote: Note | null;
  onSelectNote: (noteId: string) => void;
  onDeleteWithToast: (note: Note) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onNavigateDown: (noteId: string, column: number) => boolean;
  onNavigateUp: (noteId: string, column: number) => boolean;
  onNavigateToDescription: () => void;
  focusTarget: 'title' | 'description' | null;
  desiredColumn: number;
  onTitleFocused: () => void;
  onCreateNoteAfter: (noteId: string) => void;
  onCreateTaskAtTime?: (hour: number) => void;
  labels: Label[];
  noteLabelsCache: Map<string, Label[]>;
  onAddLabel: (noteId: string, labelId: string) => void;
  onRemoveLabel: (noteId: string, labelId: string) => void;
  onCreateLabel: () => void;
  onEditLabel: (label: Label) => void;
  fixedNoteId: string | null;
  onToggleFixInSidebar: (noteId: string) => void;
  onContentChange?: (content: string) => void;
  assigneeNamesCache: Map<string, string | null>;
  compactView: boolean;
  isDescriptionFocused: boolean;
  contacts: Contact[];
  onUpdateAssignee: (noteId: string, assigneeId: string | null) => void;
  taskStatusFilter: 'active' | 'completed' | 'deleted';
  onRestoreNote?: (noteId: string) => void;
  hasActiveFilters: boolean;
  renderNoResultsMessage: (completedCount: number) => string;
  hideEmptyHours?: boolean;
  sortByCategory?: boolean;
}

const EMPTY_LABELS: Label[] = [];
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;
const HOUR_HEIGHT = 60;

// Category order for sorting (todo first, then followup, then meeting)
const categoryOrder: Record<string, number> = {
  todo: 0,
  followup: 1,
  meeting: 2,
  notes: 3,
};

export function TimelineView({
  notes,
  completedNotes,
  deletedNotes,
  selectedDate,
  selectedNote,
  onSelectNote,
  onDeleteWithToast,
  onToggleCompleted,
  onTogglePinned,
  onEdit,
  onNavigateDown,
  onNavigateUp,
  onNavigateToDescription,
  focusTarget,
  desiredColumn,
  onTitleFocused,
  onCreateNoteAfter,
  onCreateTaskAtTime,
  labels,
  noteLabelsCache,
  onAddLabel,
  onRemoveLabel,
  onCreateLabel,
  onEditLabel,
  fixedNoteId,
  onToggleFixInSidebar,
  onContentChange,
  assigneeNamesCache,
  compactView,
  isDescriptionFocused,
  contacts,
  onUpdateAssignee,
  taskStatusFilter,
  onRestoreNote,
  hasActiveFilters,
  renderNoResultsMessage,
  hideEmptyHours = true,
  sortByCategory = false,
}: TimelineViewProps) {
  const { t } = useTranslation();
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get current notes based on filter
  const currentNotes = useMemo(() => {
    switch (taskStatusFilter) {
      case 'completed':
        return completedNotes;
      case 'deleted':
        return deletedNotes;
      default:
        return notes;
    }
  }, [taskStatusFilter, notes, completedNotes, deletedNotes]);

  // Sort function for category ordering
  const sortNotesByCategory = (notes: Note[]): Note[] => {
    if (!sortByCategory) return notes;
    return [...notes].sort((a, b) => {
      // Pinned notes first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      // Then by category
      const aOrder = categoryOrder[a.category] ?? 99;
      const bOrder = categoryOrder[b.category] ?? 99;
      return aOrder - bOrder;
    });
  };

  // Separate notes with time vs all-day notes
  const { allDayNotes, timedNotes } = useMemo(() => {
    const allDay: Note[] = [];
    const timed: Note[] = [];

    for (const note of currentNotes) {
      if (note.deadline && hasTimeComponent(note.deadline)) {
        timed.push(note);
      } else {
        allDay.push(note);
      }
    }

    return {
      allDayNotes: sortNotesByCategory(allDay),
      timedNotes: timed
    };
  }, [currentNotes, sortByCategory]);

  // Group timed notes by hour (with category sorting applied per hour)
  const notesByHour = useMemo(() => {
    const map = new Map<number, Note[]>();

    for (const note of timedNotes) {
      if (!note.deadline) continue;
      const hour = getHourFromDeadline(note.deadline);
      const existing = map.get(hour) || [];
      map.set(hour, [...existing, note]);
    }

    // Apply category sorting within each hour
    if (sortByCategory) {
      for (const [hour, notes] of map.entries()) {
        map.set(hour, sortNotesByCategory(notes));
      }
    }

    return map;
  }, [timedNotes, sortByCategory]);

  // Calculate visible hour range
  const { startHour, endHour } = useMemo(() => {
    let min = DEFAULT_START_HOUR;
    let max = DEFAULT_END_HOUR;

    for (const hour of notesByHour.keys()) {
      if (hour < min) min = hour;
      if (hour > max) max = hour + 1;
    }

    return { startHour: min, endHour: max };
  }, [notesByHour]);

  // Generate hour slots
  const hours = useMemo(() => {
    const result: number[] = [];
    for (let h = startHour; h <= endHour; h++) {
      result.push(h);
    }
    return result;
  }, [startHour, endHour]);

  // Auto-scroll to current hour when viewing today
  useEffect(() => {
    const today = new Date();
    const isToday =
      selectedDate.getFullYear() === today.getFullYear() &&
      selectedDate.getMonth() === today.getMonth() &&
      selectedDate.getDate() === today.getDate();

    if (isToday && scrollContainerRef.current) {
      const currentHour = today.getHours();
      if (currentHour >= startHour && currentHour <= endHour) {
        const scrollOffset = (currentHour - startHour) * HOUR_HEIGHT;
        scrollContainerRef.current.scrollTop = Math.max(0, scrollOffset - HOUR_HEIGHT);
      }
    }
  }, [selectedDate, startHour, endHour]);

  const handleHourClick = (hour: number) => {
    if (onCreateTaskAtTime) {
      onCreateTaskAtTime(hour);
    }
  };

  const renderNoteRow = (note: Note, isDeleted = false) => (
    <MemoizedNoteRow
      key={note.id}
      note={note}
      onDeleteWithToast={onDeleteWithToast}
      onToggleCompleted={onToggleCompleted}
      onTogglePinned={onTogglePinned}
      isSelected={selectedNote?.id === note.id}
      onSelect={onSelectNote}
      onEdit={onEdit}
      onNavigateDown={onNavigateDown}
      onNavigateUp={onNavigateUp}
      onNavigateToDescription={onNavigateToDescription}
      shouldFocusTitle={focusTarget === 'title' && selectedNote?.id === note.id}
      desiredColumn={desiredColumn}
      onTitleFocused={onTitleFocused}
      onCreateNoteAfter={onCreateNoteAfter}
      isDragging={false}
      labels={noteLabelsCache.get(note.id) ?? EMPTY_LABELS}
      allLabels={labels}
      onAddLabel={onAddLabel}
      onRemoveLabel={onRemoveLabel}
      onCreateLabel={onCreateLabel}
      onEditLabel={onEditLabel}
      isFixedInSidebar={fixedNoteId === note.id}
      onToggleFixInSidebar={onToggleFixInSidebar}
      onContentChange={selectedNote?.id === note.id ? onContentChange : undefined}
      assigneeName={assigneeNamesCache.get(note.id)}
      compactView={compactView}
      isDescriptionFocused={isDescriptionFocused && selectedNote?.id === note.id}
      contacts={contacts}
      onUpdateAssignee={onUpdateAssignee}
      isDeleted={isDeleted}
      hideDeadline
      onRestore={isDeleted && onRestoreNote ? () => onRestoreNote(note.id) : undefined}
    />
  );

  // Show empty state if no notes
  if (currentNotes.length === 0) {
    if (hasActiveFilters) {
      return (
        <p className="text-sm text-muted-foreground/50 italic p-4 text-center">
          {renderNoResultsMessage(completedNotes.length)}
        </p>
      );
    }
    return (
      <p className="text-sm text-muted-foreground/50 italic p-4 text-center">
        {t('calendar.noTasks')}
      </p>
    );
  }

  const isDeleted = taskStatusFilter === 'deleted';

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* All day section */}
      {allDayNotes.length > 0 && (
        <div className="flex-shrink-0 pb-2 mb-2 px-1">
          <div className="text-xs text-muted-foreground/60 mb-1">
            {t('calendar.allDay')}
          </div>
          <div className="space-y-0">
            {allDayNotes.map((note) => renderNoteRow(note, isDeleted))}
          </div>
        </div>
      )}

      {/* Timeline grid */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-1"
      >
        {timedNotes.length > 0 || allDayNotes.length === 0 ? (
          <div className="space-y-0">
            {hours.map((hour) => {
              const notesForHour = notesByHour.get(hour) || [];
              const hasNotes = notesForHour.length > 0;

              // Skip empty hours if hideEmptyHours is enabled
              if (hideEmptyHours && !hasNotes) {
                return null;
              }

              return (
                <div key={hour}>
                  {/* Hour label */}
                  <div className="text-xs text-muted-foreground/60 pt-2 pb-1 border-t border-border/30">
                    {String(hour).padStart(2, '0')}:00
                  </div>

                  {/* Time slot */}
                  <div
                    className={`relative ${
                      !hasNotes ? 'hover:bg-accent/20 cursor-pointer group' : ''
                    }`}
                    style={{ minHeight: hasNotes ? 'auto' : `${HOUR_HEIGHT - 24}px` }}
                    onClick={() => !hasNotes && handleHourClick(hour)}
                  >
                    {hasNotes ? (
                      <div className="space-y-0">
                        {notesForHour.map((note) => renderNoteRow(note, isDeleted))}
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Plus className="h-4 w-4 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
