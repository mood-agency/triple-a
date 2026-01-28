import { useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { MemoizedNoteRow } from './NoteRow';
import { hasTimeComponent, getHourFromDeadline } from '@/utils/dateUtils';
import { sortNotesByCategory } from '@/utils/noteUtils';
import { useNoteRowProps } from '@/hooks/useNoteRowProps';

interface TimelineViewProps {
  notes: Note[];
  completedNotes: Note[];
  deletedNotes: Note[];
  selectedDate: Date;
  selectedNote: Note | null;
  onSelectNote: (noteId: string) => void;
  onDeleteWithToast: (note: Note, reason: string) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onNavigateDown: (noteId: string, column: number) => boolean;
  onNavigateUp: (noteId: string, column: number) => boolean;
  onNavigateToDescription: () => void;
  focusTarget: 'title' | 'description' | 'description-start' | 'description-end' | null;
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
  onAddAssignee: (noteId: string, contactId: string) => void;
  onRemoveAssignee: (noteId: string, contactId: string) => void;
  onUpdateAssignee?: (noteId: string, contactId: string | null) => void;
  taskStatusFilter: 'active' | 'completed' | 'deleted';
  onRestoreNote?: (noteId: string) => void;
  hasActiveFilters: boolean;
  renderNoResultsMessage: (completedCount: number) => React.ReactNode;
  hideEmptyHours?: boolean;
  sortByCategory?: boolean;
}

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 20;
const HOUR_HEIGHT = 60;

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
  onAddAssignee,
  onRemoveAssignee,
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

  // Build note row props using the shared hook
  const getNoteRowProps = useNoteRowProps({
    onDeleteWithToast,
    onToggleCompleted,
    onTogglePinned,
    onSelect: onSelectNote,
    onEdit,
    onNavigateDown,
    onNavigateUp,
    onNavigateToDescription,
    onTitleFocused,
    onCreateNoteAfter,
    allLabels: labels,
    onAddLabel,
    onRemoveLabel,
    onCreateLabel,
    onEditLabel,
    fixedNoteId,
    onToggleFixInSidebar,
    contacts,
    onAddAssignee,
    onRemoveAssignee,
    onUpdateAssignee: onUpdateAssignee || (() => {}),
    noteLabelsCache,
    assigneeNamesCache,
    selectedNote,
    focusTarget,
    desiredColumn,
    compactView,
    isDescriptionFocused,
    onContentChange,
  });

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

  // Helper to conditionally sort by category
  const applyCategorySort = (notesToSort: Note[]): Note[] => {
    return sortByCategory ? sortNotesByCategory(notesToSort) : notesToSort;
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
      allDayNotes: applyCategorySort(allDay),
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
      for (const [hour, hourNotes] of map.entries()) {
        map.set(hour, sortNotesByCategory(hourNotes));
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

  const renderNoteRow = (note: Note, isDeletedNote = false) => (
    <MemoizedNoteRow
      key={note.id}
      {...getNoteRowProps(note, {
        isDeleted: isDeletedNote,
        hideDeadline: true,
        onRestore: isDeletedNote && onRestoreNote ? () => onRestoreNote(note.id) : undefined,
      })}
    />
  );

  // Show empty state if no notes
  if (currentNotes.length === 0) {
    if (hasActiveFilters) {
      return <>{renderNoResultsMessage(completedNotes.length)}</>;
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
        <div className="flex-shrink-0 pb-2 mb-2">
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
