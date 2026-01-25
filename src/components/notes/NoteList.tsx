import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { Calendar, PanelRightClose, PanelRightOpen, List, Pickaxe, Forward, StickyNote, Users as UsersIcon, User, Tag, AlertCircle, AlignJustify, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ColorPicker } from '@/components/ui/color-picker';
import type { EditableDescriptionHandle } from '@/components/ui/EditableDescription';
import { useNoteHistory } from '@/hooks/useNoteHistory';
import { useLabels } from '@/hooks/useLabels';
import { useSettings } from '@/hooks/useSettings';
import type { Note, NoteCategory, Label } from '@/types/note';
import { PostponeDialog } from './PostponeDialog';
import { MemoizedNoteRow } from './NoteRow';
import { NoteEditorPanel } from './NoteEditorPanel';
import { CalendarView } from './CalendarView';
import { TimelineView } from './TimelineView';
import { NoteFilters } from './NoteFilters';
import { parseLocalDate, startOfDay, endOfDay, getLocalDateKey } from '@/utils/dateUtils';
import { useContacts } from '@/hooks/useContacts';
import { useDeletedNotes } from '@/hooks/useDeletedNotes';
import { getInitials } from '@/lib/utils';

interface NoteListProps {
  notes: Note[];
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDelete: (id: string) => void;
  onRestore: (note: Note) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onUpdateDeadline: (id: string, deadline: string | null) => void;
  onUpdateAssignee: (id: string, assigneeId: string | null) => void;
  onReorderNotes: (orderedIds: string[]) => void;
  onPostponeNote: (id: string, newDeadline: string, reason: string) => Promise<void>;
  selectedNote: Note | null;
  onSelectNote: (note: Note | null) => void;
  onNavigateToEditor?: (column: number) => void;
  onCreateNoteAfter?: (afterNoteId: string, category: NoteCategory, deadline?: string | null, labelIds?: string[]) => Promise<Note>;
  onCreateTask?: () => void;
  // External filter control (from CommandPalette)
  externalLabelFilter?: string[];
  externalCategoryFilter?: NoteCategory | 'all';
  externalAssigneeFilter?: string[];
  onLabelFilterChange?: (labels: string[]) => void;
  onCategoryFilterChange?: (category: NoteCategory | 'all') => void;
  onAssigneeFilterChange?: (assignees: string[]) => void;
  // External view mode and date control (from URL)
  externalViewMode?: 'list' | 'calendar';
  onViewModeChange?: (viewMode: 'list' | 'calendar') => void;
  externalSelectedDate?: Date;
  onSelectedDateChange?: (date: Date | undefined) => void;
  // Sidebar trigger element
  sidebarTrigger?: React.ReactNode;
}

type FocusTarget = 'title' | 'description-start' | 'description-end' | null;

// Helper to format date/time


export interface NoteListHandle {
  focusFirstTaskTitle: (column?: number) => void;
}

// Helper to get column position (position within current line)
function getColumnPosition(text: string, cursorPos: number): number {
  const textBeforeCursor = text.substring(0, cursorPos);
  const lastNewline = textBeforeCursor.lastIndexOf('\n');
  return lastNewline === -1 ? cursorPos : cursorPos - lastNewline - 1;
}

export const NoteList = forwardRef<NoteListHandle, NoteListProps>(function NoteList({ notes, onEdit, onDelete, onRestore, onToggleCompleted, onTogglePinned, onUpdateDeadline, onUpdateAssignee, onReorderNotes, onPostponeNote, selectedNote, onSelectNote, onNavigateToEditor, onCreateNoteAfter, onCreateTask, externalLabelFilter, externalCategoryFilter, externalAssigneeFilter, onLabelFilterChange, onCategoryFilterChange, onAssigneeFilterChange, externalViewMode, onViewModeChange, externalSelectedDate, onSelectedDateChange, sidebarTrigger }, ref) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { contacts } = useContacts();
  const { deletedNotes } = useDeletedNotes();
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<EditableDescriptionHandle>(null);
  const descriptionCaretPositionRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // PERFORMANCE: Use refs to access latest values without creating callback dependencies
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const filteredNotesRef = useRef<Note[]>([]);
  const activeNotesRef = useRef<Note[]>([]);
  const focusTargetRef = useRef<FocusTarget>(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [titleValue, setTitleValue] = useState('');
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);
  focusTargetRef.current = focusTarget; // Keep ref in sync
  const [desiredColumn, setDesiredColumn] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalCategoryFilter, setInternalCategoryFilter] = useState<NoteCategory | 'all'>('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'active' | 'completed' | 'deleted'>('active');

  // Use fixedNoteId from settings for persistence
  const fixedNoteId = settings.fixedNoteId;
  const setFixedNoteId = (value: string | null) => updateSettings({ fixedNoteId: value });

  // Get the fixed note from the ID (for sidebar)
  const fixedNote = useMemo(() => {
    if (!fixedNoteId) return null;
    return notes.find(n => n.id === fixedNoteId) ?? null;
  }, [notes, fixedNoteId]);

  // Use fixed note for history if available, otherwise use selected note
  const noteForSidebar = fixedNote ?? selectedNote;
  const { history, deleteHistoryEntry, updateHistoryReason, reload: reloadHistory } = useNoteHistory(noteForSidebar?.id ?? null);
  const [historyEntryToDelete, setHistoryEntryToDelete] = useState<string | null>(null);
  const [editingHistoryEntry, setEditingHistoryEntry] = useState<{ id: string; reason: string } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [categoryJustChanged, setCategoryJustChanged] = useState(false);

  // Labels state
  const { labels: rawLabels, getLabelsForNote, addLabelToNote, removeLabelFromNote, createLabel, updateLabel, noteLabelVersion } = useLabels();
  const [internalLabelFilter, setInternalLabelFilter] = useState<string[]>([]);
  const [internalAssigneeFilter, setInternalAssigneeFilter] = useState<string[]>([]);

  // PERFORMANCE: Stable empty array to avoid creating new references
  const EMPTY_LABELS: Label[] = useMemo(() => [], []);

  // PERFORMANCE: Memoize labels array to prevent unnecessary re-renders of all NoteRows
  // Only update the reference when label IDs change (not on every useLabels update)
  const labelsKey = rawLabels.map(l => l.id).join(',');
  const labels = useMemo(() => rawLabels, [labelsKey]);

  // PERFORMANCE: Cache all note labels to avoid SQL queries on every render
  // This computes labels once per render instead of once per note per render
  // Use note IDs as key to avoid recomputation when notes array reference changes but IDs stay the same
  const noteIdsKey = notes.map(n => n.id).join(',');
  const noteLabelsCache = useMemo(() => {
    const cache = new Map<string, Label[]>();
    // Only compute for visible notes to avoid unnecessary work
    // Use notesRef.current to access latest notes without adding to dependencies
    for (const note of notesRef.current) {
      const noteLabels = getLabelsForNote(note.id);
      // Use stable empty array reference for notes without labels
      cache.set(note.id, noteLabels.length > 0 ? noteLabels : EMPTY_LABELS);
    }
    return cache;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteIdsKey, getLabelsForNote, noteLabelVersion, EMPTY_LABELS]);

  // PERFORMANCE: Pre-compute assignee names for all notes to avoid per-note lookups
  // Include assignee IDs in the key so cache updates when assignees change
  const assigneeIdsKey = notes.map(n => n.assignee_id ?? '').join(',');
  const assigneeNamesCache = useMemo(() => {
    const cache = new Map<string, string | null>();
    for (const note of notesRef.current) {
      if (note.assignee_id) {
        const contact = contacts.find(c => c.id === note.assignee_id);
        cache.set(note.id, contact ? getInitials(contact.name, contact.lastname) : null);
      } else {
        cache.set(note.id, null);
      }
    }
    return cache;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteIdsKey, assigneeIdsKey, contacts]);


  // Use external filters if provided, otherwise use internal state
  const labelFilter = externalLabelFilter ?? internalLabelFilter;
  const categoryFilter = externalCategoryFilter ?? internalCategoryFilter;
  const assigneeFilter = externalAssigneeFilter ?? internalAssigneeFilter;

  const setLabelFilter = (value: string[] | ((prev: string[]) => string[])) => {
    const newValue = typeof value === 'function' ? value(labelFilter) : value;
    if (onLabelFilterChange) {
      onLabelFilterChange(newValue);
    } else {
      setInternalLabelFilter(newValue);
    }
  };

  const setCategoryFilter = (value: NoteCategory | 'all') => {
    if (onCategoryFilterChange) {
      onCategoryFilterChange(value);
    } else {
      setInternalCategoryFilter(value);
    }
  };

  const setAssigneeFilter = (value: string[] | ((prev: string[]) => string[])) => {
    const newValue = typeof value === 'function' ? value(assigneeFilter) : value;
    if (onAssigneeFilterChange) {
      onAssigneeFilterChange(newValue);
    } else {
      setInternalAssigneeFilter(newValue);
    }
  };
  const [noteLabels, setNoteLabels] = useState<Label[]>([]);
  const [showCreateLabelDialog, setShowCreateLabelDialog] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6b7280');
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [editLabelName, setEditLabelName] = useState('');
  const [editLabelColor, setEditLabelColor] = useState('#6b7280');
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [postponeDialogOpen, setPostponeDialogOpen] = useState(false);
  const [noteToPostpone, setNoteToPostpone] = useState<Note | null>(null);
  const [pendingPostponeDate, setPendingPostponeDate] = useState<Date | null>(null);
  const showSidebar = settings.showSidebar;
  const setShowSidebar = (value: boolean) => updateSettings({ showSidebar: value });

  // Use external view mode if provided, otherwise use settings
  const viewMode = externalViewMode ?? settings.viewMode;
  const setViewMode = (value: 'list' | 'calendar') => {
    if (onViewModeChange) {
      onViewModeChange(value);
    } else {
      updateSettings({ viewMode: value });
    }
  };

  const compactTaskView = settings.compactTaskView;
  const setCompactTaskView = (value: boolean) => updateSettings({ compactTaskView: value });

  // Use external selected date if provided, otherwise use internal state
  const [internalCalendarSelectedDate, setInternalCalendarSelectedDate] = useState<Date | undefined>(new Date());
  const calendarSelectedDate = externalSelectedDate ?? internalCalendarSelectedDate;
  const setCalendarSelectedDate = (date: Date | undefined) => {
    if (onSelectedDateChange) {
      onSelectedDateChange(date);
    } else {
      setInternalCalendarSelectedDate(date);
    }
  };
  const [sortByDeadline, setSortByDeadline] = useState(false);
  const [sortByAssignee, setSortByAssignee] = useState(false);
  const [sortByCategory, setSortByCategory] = useState(true);
  const [sortConfig, setSortConfig] = useState<{ deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null }>({
    deadline: null,
    assignee: null,
    category: 'asc',
  });
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [showPostponeHistory, setShowPostponeHistory] = useState(false);
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);

  // Fixed note editor state (for right column)
  const [fixedNoteLabels, setFixedNoteLabels] = useState<Label[]>([]);
  const [fixedNoteLabelDropdownOpen, setFixedNoteLabelDropdownOpen] = useState(false);
  const [fixedNoteCategoryDropdownOpen, setFixedNoteCategoryDropdownOpen] = useState(false);
  const [fixedNoteDeadlinePickerOpen, setFixedNoteDeadlinePickerOpen] = useState(false);
  const [fixedNoteAssigneePickerOpen, setFixedNoteAssigneePickerOpen] = useState(false);
  const [fixedNoteDescriptionValue, setFixedNoteDescriptionValue] = useState('');
  const [fixedNoteShowPostponeHistory, setFixedNoteShowPostponeHistory] = useState(false);
  const fixedNoteDescriptionRef = useRef<EditableDescriptionHandle>(null);
  const { history: fixedNoteHistory, deleteHistoryEntry: deleteFixedNoteHistoryEntry, updateHistoryReason: updateFixedNoteHistoryReason } = useNoteHistory(fixedNote?.id ?? null);
  const [fixedNoteHistoryEntryToDelete, setFixedNoteHistoryEntryToDelete] = useState<string | null>(null);
  const [editingFixedNoteHistoryEntry, setEditingFixedNoteHistoryEntry] = useState<{ id: string; reason: string } | null>(null);

  const LABEL_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
  ];

  // DnD sensors - memoized to prevent recreation on every render
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, keyboardSensor);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = notes.findIndex((n) => n.id === active.id);
      const newIndex = notes.findIndex((n) => n.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(notes, oldIndex, newIndex);
        onReorderNotes(newOrder.map((n) => n.id));
      }
    }
  };

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveId(String(event.active.id));
  };

  // Filter notes based on search query, category, labels, and overdue status
  // Memoized to avoid recomputing on every render
  const baseFilteredNotes = useMemo(() => notes.filter((note) => {
    // Pinned notes pass through most filters (except search query and category-based exclusion)
    if (note.pinned) {
      // Still respect category filter: when 'all', exclude notes; when specific, match that category
      if (categoryFilter === 'all' && note.category === 'notes') return false;
      if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;

      // Still filter by search query if present
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = note.content.toLowerCase().includes(query);
        const descriptionMatch = note.description?.toLowerCase().includes(query) ?? false;
        return titleMatch || descriptionMatch;
      }
      return true;
    }

    // Filter by category
    // When 'all' is selected, show only action items (todo, followup, meeting) - NOT notes
    // Notes only appear when explicitly filtered with categoryFilter === 'notes'
    if (categoryFilter === 'all') {
      // Exclude notes category when showing "all" action items
      if (note.category === 'notes') return false;
    } else if (note.category !== categoryFilter) {
      return false;
    }
    // Filter by labels (OR logic - note must have at least one selected label)
    if (labelFilter.length > 0) {
      // PERFORMANCE: Use cached labels instead of SQL query
      const noteLabelIds = (noteLabelsCache.get(note.id) ?? EMPTY_LABELS).map(l => l.id);
      const hasMatchingLabel = labelFilter.some(labelId => noteLabelIds.includes(labelId));
      if (!hasMatchingLabel) return false;
    }
    // Filter by assignee (OR logic - note must have one of the selected assignees)
    if (assigneeFilter.length > 0) {
      if (!note.assignee_id || !assigneeFilter.includes(note.assignee_id)) {
        return false;
      }
    }
    // Filter by overdue status (only show tasks with deadlines that have passed)
    // Uses same logic as the red badge display: deadline < now
    // Meetings are excluded since they are scheduled events, not tasks with deadlines
    if (showOverdueOnly) {
      if (!note.deadline || note.category === 'meeting') return false;
      const isOverdue = parseLocalDate(note.deadline) < new Date() && !note.completed;
      if (!isOverdue) return false;
    }
    // Filter by date range (filter tasks by their deadline within the range)
    if (dateRangeFilter.from || dateRangeFilter.to) {
      if (!note.deadline) return false;
      const noteDeadline = parseLocalDate(note.deadline);
      if (dateRangeFilter.from && noteDeadline < startOfDay(dateRangeFilter.from)) return false;
      if (dateRangeFilter.to && noteDeadline > endOfDay(dateRangeFilter.to)) return false;
    }
    // Filter by search query
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = note.content.toLowerCase().includes(query);
    const descriptionMatch = note.description?.toLowerCase().includes(query) ?? false;
    return titleMatch || descriptionMatch;
  }), [notes, categoryFilter, labelFilter, assigneeFilter, showOverdueOnly, dateRangeFilter, searchQuery, noteLabelsCache]);

  // Category order for sorting
  const categoryOrder: Record<string, number> = {
    todo: 0,
    followup: 1,
    meeting: 2,
    notes: 3,
  };

  // Separate active and completed notes
  // Memoized to avoid recomputing sort on every render
  const activeNotes = useMemo(() => {
    let active = baseFilteredNotes.filter((note) => !note.completed);

    // Sort active notes
    active = [...active].sort((a, b) => {
      // Pinned notes always come first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // Sort by category if enabled
      if (sortConfig.category) {
        const aOrder = categoryOrder[a.category] ?? 99;
        const bOrder = categoryOrder[b.category] ?? 99;
        if (aOrder !== bOrder) {
          const result = aOrder - bOrder;
          return sortConfig.category === 'desc' ? -result : result;
        }
      }

      // Sort by assignee if enabled
      if (sortConfig.assignee) {
        const aName = assigneeNamesCache.get(a.id) ?? '';
        const bName = assigneeNamesCache.get(b.id) ?? '';
        // Tasks with assignee come first, then sort alphabetically
        if (aName && !bName) return -1;
        if (!aName && bName) return 1;
        if (aName && bName) {
          const nameCompare = aName.localeCompare(bName);
          if (nameCompare !== 0) {
            return sortConfig.assignee === 'desc' ? -nameCompare : nameCompare;
          }
        }
      }

      // Sort by deadline if enabled
      if (sortConfig.deadline) {
        // Notes without deadline go to the end
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        // Sort by deadline
        const result = parseLocalDate(a.deadline).getTime() - parseLocalDate(b.deadline).getTime();
        return sortConfig.deadline === 'desc' ? -result : result;
      }

      return 0; // Maintain original order
    });

    return active;
  }, [baseFilteredNotes, sortConfig, assigneeNamesCache]);

  const completedNotes = useMemo(() => baseFilteredNotes
    .filter((note) => note.completed)
    .sort((a, b) => {
      // Pinned notes always come first, even in completed section
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      // Sort by completed_at descending (most recent first)
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bTime - aTime;
    }), [baseFilteredNotes]);

  // Combined for navigation purposes (active first, then completed)
  // Memoized to avoid recreating array on every render
  const filteredNotes = useMemo(() => [...activeNotes, ...completedNotes], [activeNotes, completedNotes]);

  // PERFORMANCE: Keep refs updated for use in stable callbacks
  activeNotesRef.current = activeNotes;

  // Calendar view: filter notes by selected date (only open followups and meetings with deadlines)
  const calendarFilteredNotes = useMemo(() => {
    if (!calendarSelectedDate) return [];
    // Use local date format to avoid timezone issues (toISOString converts to UTC)
    const year = calendarSelectedDate.getFullYear();
    const month = String(calendarSelectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(calendarSelectedDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    return notes.filter((note) => {
      // Only show open (not completed) tasks
      if (note.completed) return false;
      // Must have a deadline matching the selected date
      if (!note.deadline) return false;
      const noteDeadline = getLocalDateKey(note.deadline);
      if (noteDeadline !== dateKey) return false;
      // Only show todos, followups and meetings (not notes)
      if (note.category !== 'todo' && note.category !== 'followup' && note.category !== 'meeting') return false;
      // Apply category filter if set
      if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;
      // Apply label filter if set
      if (labelFilter.length > 0) {
        const noteLabelIds = (noteLabelsCache.get(note.id) ?? EMPTY_LABELS).map(l => l.id);
        if (!labelFilter.some(labelId => noteLabelIds.includes(labelId))) return false;
      }
      // Apply assignee filter if set
      if (assigneeFilter.length > 0) {
        if (!note.assignee_id || !assigneeFilter.includes(note.assignee_id)) return false;
      }
      // Apply search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = note.content.toLowerCase().includes(query);
        const descriptionMatch = note.description?.toLowerCase().includes(query) ?? false;
        if (!titleMatch && !descriptionMatch) return false;
      }
      return true;
    });
  }, [notes, calendarSelectedDate, categoryFilter, labelFilter, assigneeFilter, searchQuery, noteLabelsCache, EMPTY_LABELS]);

  // Calendar view: completed tasks for selected date
  const calendarCompletedNotes = useMemo(() => {
    if (!calendarSelectedDate) return [];
    // Use local date format to avoid timezone issues (toISOString converts to UTC)
    const year = calendarSelectedDate.getFullYear();
    const month = String(calendarSelectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(calendarSelectedDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    return notes.filter((note) => {
      // Only show completed tasks
      if (!note.completed) return false;
      // Must have a deadline matching the selected date
      if (!note.deadline) return false;
      const noteDeadline = getLocalDateKey(note.deadline);
      if (noteDeadline !== dateKey) return false;
      // Only show todos, followups and meetings (not notes)
      if (note.category !== 'todo' && note.category !== 'followup' && note.category !== 'meeting') return false;
      // Apply category filter if set
      if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;
      // Apply label filter if set
      if (labelFilter.length > 0) {
        const noteLabelIds = (noteLabelsCache.get(note.id) ?? EMPTY_LABELS).map(l => l.id);
        if (!labelFilter.some(labelId => noteLabelIds.includes(labelId))) return false;
      }
      // Apply assignee filter if set
      if (assigneeFilter.length > 0) {
        if (!note.assignee_id || !assigneeFilter.includes(note.assignee_id)) return false;
      }
      // Apply search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = note.content.toLowerCase().includes(query);
        const descriptionMatch = note.description?.toLowerCase().includes(query) ?? false;
        if (!titleMatch && !descriptionMatch) return false;
      }
      return true;
    }).sort((a, b) => {
      // Sort by completed_at descending (most recent first)
      const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
      const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [notes, calendarSelectedDate, categoryFilter, labelFilter, assigneeFilter, searchQuery, noteLabelsCache, EMPTY_LABELS]);

  // Calendar view: deleted tasks for selected date
  const calendarDeletedNotes = useMemo(() => {
    if (!calendarSelectedDate) return [];
    // Use local date format to avoid timezone issues (toISOString converts to UTC)
    const year = calendarSelectedDate.getFullYear();
    const month = String(calendarSelectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(calendarSelectedDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;
    return deletedNotes.filter((note) => {
      // Must have a deadline matching the selected date
      if (!note.deadline) return false;
      const noteDeadline = getLocalDateKey(note.deadline);
      if (noteDeadline !== dateKey) return false;
      // Only show todos, followups and meetings (not notes)
      if (note.category !== 'todo' && note.category !== 'followup' && note.category !== 'meeting') return false;
      // Apply category filter if set
      if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;
      // Apply label filter if set
      if (labelFilter.length > 0) {
        const noteLabelIds = (noteLabelsCache.get(note.id) ?? EMPTY_LABELS).map(l => l.id);
        if (!labelFilter.some(labelId => noteLabelIds.includes(labelId))) return false;
      }
      // Apply assignee filter if set
      if (assigneeFilter.length > 0) {
        if (!note.assignee_id || !assigneeFilter.includes(note.assignee_id)) return false;
      }
      // Apply search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = note.content.toLowerCase().includes(query);
        const descriptionMatch = note.description?.toLowerCase().includes(query) ?? false;
        if (!titleMatch && !descriptionMatch) return false;
      }
      return true;
    });
  }, [deletedNotes, calendarSelectedDate, categoryFilter, labelFilter, assigneeFilter, searchQuery, noteLabelsCache, EMPTY_LABELS]);

  // PERFORMANCE: Keep filteredNotesRef updated based on view mode for navigation callbacks
  // In calendar mode, use calendar-specific arrays; in list mode, use regular filtered arrays
  filteredNotesRef.current = viewMode === 'calendar'
    ? [...calendarFilteredNotes, ...calendarCompletedNotes]
    : filteredNotes;

  // Load labels when selected note changes
  useEffect(() => {
    if (selectedNote) {
      setNoteLabels(getLabelsForNote(selectedNote.id));
    } else {
      setNoteLabels([]);
    }
  }, [selectedNote, getLabelsForNote]);

  // Sync fixed note labels when fixed note changes
  useEffect(() => {
    if (fixedNote) {
      setFixedNoteLabels(getLabelsForNote(fixedNote.id));
    } else {
      setFixedNoteLabels([]);
    }
  }, [fixedNote, getLabelsForNote]);

  const handleAddLabel = async (labelId: string) => {
    if (!selectedNote) return;
    await addLabelToNote(selectedNote.id, labelId);
    setNoteLabels(getLabelsForNote(selectedNote.id));
  };

  const handleRemoveLabel = async (labelId: string) => {
    if (!selectedNote) return;
    await removeLabelFromNote(selectedNote.id, labelId);
    setNoteLabels(getLabelsForNote(selectedNote.id));
  };

  // Fixed note label handlers
  const handleFixedNoteAddLabel = async (labelId: string) => {
    if (!fixedNote) return;
    await addLabelToNote(fixedNote.id, labelId);
    setFixedNoteLabels(getLabelsForNote(fixedNote.id));
  };

  const handleFixedNoteRemoveLabel = async (labelId: string) => {
    if (!fixedNote) return;
    await removeLabelFromNote(fixedNote.id, labelId);
    setFixedNoteLabels(getLabelsForNote(fixedNote.id));
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    await createLabel(newLabelName.trim(), newLabelColor);
    setNewLabelName('');
    setNewLabelColor('#6b7280');
    setShowCreateLabelDialog(false);
  };

  const handleEditLabel = (label: Label) => {
    setEditingLabel(label);
    setEditLabelName(label.name);
    setEditLabelColor(label.color);
    setLabelDropdownOpen(false);
  };

  const handleSaveEditLabel = async () => {
    if (!editingLabel || !editLabelName.trim()) return;
    await updateLabel(editingLabel.id, editLabelName.trim(), editLabelColor);
    setEditingLabel(null);
    setEditLabelName('');
    setEditLabelColor('#6b7280');
    if (selectedNote) {
      setNoteLabels(getLabelsForNote(selectedNote.id));
    }
  };

  const handleOpenPostponeDialog = (noteId: string, newDate?: Date) => {
    const note = notes.find(n => n.id === noteId);
    if (note) {
      setNoteToPostpone(note);
      setPendingPostponeDate(newDate || null);
      setPostponeDialogOpen(true);
    }
  };

  const handlePostpone = async (newDeadline: string, reason: string) => {
    if (noteToPostpone) {
      await onPostponeNote(noteToPostpone.id, newDeadline, reason);
      // Reload history to show the new postpone entry
      reloadHistory();
      setNoteToPostpone(null);
      setPendingPostponeDate(null);
      setPostponeDialogOpen(false);
    }
  };

  const handleDeadlineChange = (date: Date | undefined) => {
    if (!selectedNote) return;

    if (date) {
      // Just update the deadline directly (no postpone dialog on every change)
      onUpdateDeadline(selectedNote.id, date.toISOString());
    } else {
      // Clearing the deadline
      onUpdateDeadline(selectedNote.id, null);
    }
  };

  // Called when user clicks Save button in the date picker
  const handleDeadlineSave = (date: Date) => {
    if (!selectedNote) return;

    // If there's an existing deadline that changed, prompt for postpone reason
    if (selectedNote.deadline) {
      const existingDate = parseLocalDate(selectedNote.deadline);
      // Only show postpone dialog if the date actually changed
      if (existingDate.getTime() !== date.getTime()) {
        handleOpenPostponeDialog(selectedNote.id, date);
      }
    }
    // If no existing deadline, the change was already applied via handleDeadlineChange
  };

  const handleFixedNoteDeadlineChange = (date: Date | undefined) => {
    if (!fixedNote) return;

    if (date) {
      // Just update the deadline directly (no postpone dialog on every change)
      onUpdateDeadline(fixedNote.id, date.toISOString());
    } else {
      // Clearing the deadline
      onUpdateDeadline(fixedNote.id, null);
    }
  };

  // Called when user clicks Save button in the fixed note date picker
  const handleFixedNoteDeadlineSave = (date: Date) => {
    if (!fixedNote) return;

    // If there's an existing deadline that changed, prompt for postpone reason
    if (fixedNote.deadline) {
      const existingDate = parseLocalDate(fixedNote.deadline);
      // Only show postpone dialog if the date actually changed
      if (existingDate.getTime() !== date.getTime()) {
        handleOpenPostponeDialog(fixedNote.id, date);
      }
    }
    // If no existing deadline, the change was already applied via handleFixedNoteDeadlineChange
  };

  // PERFORMANCE: Uses ref to avoid dependency on filteredNotes
  const handleDeleteWithToast = useCallback((note: Note) => {
    const currentFilteredNotes = filteredNotesRef.current;
    const currentIndex = currentFilteredNotes.findIndex((n) => n.id === note.id);

    // Determine where to navigate after deletion
    let targetNote: Note | null = null;
    let shouldNavigateToEditor = false;

    if (currentFilteredNotes.length === 1) {
      // Last task, navigate to editor
      shouldNavigateToEditor = true;
    } else if (currentIndex > 0) {
      // Has task above, navigate to it
      targetNote = currentFilteredNotes[currentIndex - 1];
    } else {
      // First task (no task above), navigate to task below
      targetNote = currentFilteredNotes[currentIndex + 1];
    }

    // Delete first, then navigate
    onDelete(note.id);

    // Navigate after deletion
    if (shouldNavigateToEditor) {
      onSelectNote(null);
      onNavigateToEditor?.(0);
    } else if (targetNote) {
      onSelectNote(targetNote);
      // Position caret at end of text when navigating up, start when navigating down
      setDesiredColumn(currentIndex > 0 ? targetNote.content.length : 0);
      setFocusTarget('title');
    }

    toast(t('taskDeleted'), {
      action: {
        label: t('undo'),
        onClick: () => onRestore(note),
      },
    });
  }, [onDelete, onSelectNote, onNavigateToEditor, onRestore, t]);

  // PERFORMANCE: Uses ref to avoid dependency on activeNotes
  const handleToggleCompletedWithNavigation = useCallback((noteId: string, completed: boolean) => {
    const currentActiveNotes = activeNotesRef.current;
    // Find current position in activeNotes (only active notes matter for navigation)
    const currentIndex = currentActiveNotes.findIndex((n) => n.id === noteId);

    // Only navigate when completing a task (not when uncompleting)
    if (completed && currentIndex !== -1) {
      // Determine where to navigate after completion
      let targetNote: Note | null = null;

      if (currentActiveNotes.length === 1) {
        // Last active task, deselect (show default description area)
        targetNote = null;
      } else if (currentIndex < currentActiveNotes.length - 1) {
        // Has task below, navigate to it
        targetNote = currentActiveNotes[currentIndex + 1];
      } else if (currentIndex > 0) {
        // Last task in list but has task above, navigate to it
        targetNote = currentActiveNotes[currentIndex - 1];
      }

      // Toggle completion
      onToggleCompleted(noteId, completed);

      // Show toast for completion
      toast.success(t('taskCompleted'));

      // Navigate to adjacent task or deselect
      onSelectNote(targetNote);
      if (targetNote) {
        setDesiredColumn(0);
        setFocusTarget('title');
      }
    } else {
      // Just toggle without navigation (uncompleting a task)
      onToggleCompleted(noteId, completed);

      // Show toast for reopening
      if (!completed) {
        toast(t('taskReopened'));
      }
    }
  }, [onToggleCompleted, onSelectNote, t]);

  // PERFORMANCE: Stable callbacks that accept noteId as parameter
  // This avoids creating per-note closures which cause re-renders when notes array changes
  const handleAddLabelToNote = useCallback(async (noteId: string, labelId: string) => {
    await addLabelToNote(noteId, labelId);
  }, [addLabelToNote]);

  const handleRemoveLabelFromNote = useCallback(async (noteId: string, labelId: string) => {
    await removeLabelFromNote(noteId, labelId);
  }, [removeLabelFromNote]);

  // Create a new label and add it to a note (used by hashtag parsing)
  const handleCreateLabelAndAdd = useCallback(async (noteId: string, labelName: string) => {
    const newLabel = await createLabel(labelName);
    if (newLabel) {
      await addLabelToNote(noteId, newLabel.id);
    }
  }, [createLabel, addLabelToNote]);

  const handleCreateLabelClick = useCallback(() => {
    setShowCreateLabelDialog(true);
  }, []);

  // Expose method to focus first task from parent
  useImperativeHandle(ref, () => ({
    focusFirstTaskTitle: (column?: number) => {
      if (filteredNotes.length > 0) {
        onSelectNote(filteredNotes[0]);
        setDesiredColumn(column ?? 0);
        setFocusTarget('title');
      }
    },
  }), [filteredNotes, onSelectNote]);

  // Update description and title values when selected note changes
  useEffect(() => {
    setDescriptionValue(selectedNote?.description || '');
    setTitleValue(selectedNote?.content || '');
    // Reset postpone history visibility when note changes
    setShowPostponeHistory(false);
  }, [selectedNote]);

  // Update fixed note description value when fixed note changes
  useEffect(() => {
    setFixedNoteDescriptionValue(fixedNote?.description || '');
    // Reset postpone history visibility when note changes
    setFixedNoteShowPostponeHistory(false);
  }, [fixedNote]);

  // Aplicar focus según focusTarget
  useEffect(() => {
    if (!focusTarget || !selectedNote) return;

    if (focusTarget === 'description-start' || focusTarget === 'description-end') {
      setTimeout(() => {
        descriptionRef.current?.focus();
        if (descriptionRef.current) {
          const value = descriptionValue;
          if (focusTarget === 'description-start') {
            // Use desired column on first line
            const firstLineLength = value.indexOf('\n') === -1 ? value.length : value.indexOf('\n');
            const pos = Math.min(desiredColumn, firstLineLength);
            descriptionRef.current.setCursorPosition(pos);
          } else {
            // Use desired column on last line
            const lines = value.split('\n');
            const lastLineLength = lines[lines.length - 1].length;
            const lastLineStart = value.length - lastLineLength;
            const pos = lastLineStart + Math.min(desiredColumn, lastLineLength);
            descriptionRef.current.setCursorPosition(pos);
          }
        }
        setFocusTarget(null);
      }, 0);
    }
    // 'title' se maneja via prop shouldFocusTitle en NoteRow
  }, [focusTarget, selectedNote, desiredColumn, descriptionValue]);

  // PERFORMANCE: Uses ref to avoid dependency on focusTarget
  const handleTitleFocused = useCallback(() => {
    if (focusTargetRef.current === 'title') {
      setFocusTarget(null);
    }
  }, []);

  // Tab from title - always go to description (even if empty)
  const handleNavigateToDescription = useCallback(() => {
    setDesiredColumn(0);
    setFocusTarget('description-start');
  }, []);

  // Handle description focus
  const handleDescriptionFocus = () => {
    setIsDescriptionFocused(true);
  };

  // Save description when it changes and user stops typing
  const handleDescriptionBlur = () => {
    setIsDescriptionFocused(false);
    if (selectedNote && descriptionValue !== (selectedNote.description || '')) {
      onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'd' && e.ctrlKey && selectedNote) {
      e.preventDefault();
      // Save description before toggling
      if (descriptionValue !== (selectedNote.description || '')) {
        onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
      }
      handleToggleCompletedWithNavigation(selectedNote.id, !selectedNote.completed);
    } else if (e.key === 'l' && e.altKey && selectedNote) {
      e.preventDefault();
      // Save caret position before opening dropdown
      const selectionInfo = descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        descriptionCaretPositionRef.current = selectionInfo.cursorPosition;
      }
      setLabelDropdownOpen(true);
    } else if (e.key === 'c' && e.altKey && selectedNote) {
      e.preventDefault();
      // Save caret position before opening dropdown
      const selectionInfo = descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        descriptionCaretPositionRef.current = selectionInfo.cursorPosition;
      }
      setCategoryDropdownOpen(true);
    } else if (e.key === 'p' && e.altKey && selectedNote) {
      e.preventDefault();
      // Save caret position before opening dropdown
      const selectionInfo = descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        descriptionCaretPositionRef.current = selectionInfo.cursorPosition;
      }
      setAssigneePickerOpen(true);
    } else if (e.key === 'Escape') {
      // Save changes before blurring
      if (selectedNote && descriptionValue !== (selectedNote.description || '')) {
        onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
      }
      descriptionRef.current?.blur();
    } else if (e.key === 'Tab' && e.shiftKey && selectedNote) {
      e.preventDefault();
      // Save current description
      if (descriptionValue !== (selectedNote.description || '')) {
        onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
      }
      // Go back to the title
      setDesiredColumn(selectedNote.content.length);
      setFocusTarget('title');
    } else if (e.key === 'ArrowDown' && selectedNote) {
      const selectionInfo = descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        const { cursorPosition, text } = selectionInfo;
        const textAfterCursor = text.substring(cursorPosition);
        const isOnLastLine = !textAfterCursor.includes('\n');

        if (isOnLastLine) {
          e.preventDefault();
          // Capture column position before navigating
          const column = getColumnPosition(text, cursorPosition);
          setDesiredColumn(column);
          // Save current description
          if (descriptionValue !== (selectedNote.description || '')) {
            onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
          }
          // Move to next note's title
          const currentIndex = filteredNotes.findIndex((n) => n.id === selectedNote.id);
          if (currentIndex < filteredNotes.length - 1) {
            onSelectNote(filteredNotes[currentIndex + 1]);
            setFocusTarget('title');
          }
        }
      }
    } else if (e.key === 'ArrowUp' && selectedNote) {
      const selectionInfo = descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        const { cursorPosition, text } = selectionInfo;
        const textBeforeCursor = text.substring(0, cursorPosition);
        const isOnFirstLine = !textBeforeCursor.includes('\n');

        if (isOnFirstLine) {
          e.preventDefault();
          // Capture column position before navigating
          const column = getColumnPosition(text, cursorPosition);
          setDesiredColumn(column);
          // Save current description
          if (descriptionValue !== (selectedNote.description || '')) {
            onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
          }
          // Go to title of the SAME task (not previous)
          setFocusTarget('title');
        }
      }
    }
  };

  // Fixed note description handlers
  const handleFixedNoteDescriptionBlur = () => {
    if (fixedNote && fixedNoteDescriptionValue !== (fixedNote.description || '')) {
      onEdit(fixedNote.id, fixedNote.content, fixedNote.category, fixedNoteDescriptionValue || null);
    }
  };

  const handleFixedNoteDescriptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'd' && e.ctrlKey && fixedNote) {
      e.preventDefault();
      // Save description before toggling
      if (fixedNoteDescriptionValue !== (fixedNote.description || '')) {
        onEdit(fixedNote.id, fixedNote.content, fixedNote.category, fixedNoteDescriptionValue || null);
      }
      handleToggleCompletedWithNavigation(fixedNote.id, !fixedNote.completed);
    } else if (e.key === 'l' && e.altKey && fixedNote) {
      e.preventDefault();
      setFixedNoteLabelDropdownOpen(true);
    } else if (e.key === 'c' && e.altKey && fixedNote) {
      e.preventDefault();
      setFixedNoteCategoryDropdownOpen(true);
    } else if (e.key === 'p' && e.altKey && fixedNote) {
      e.preventDefault();
      setFixedNoteAssigneePickerOpen(true);
    } else if (e.key === 'Escape') {
      // Save changes before blurring
      if (fixedNote && fixedNoteDescriptionValue !== (fixedNote.description || '')) {
        onEdit(fixedNote.id, fixedNote.content, fixedNote.category, fixedNoteDescriptionValue || null);
      }
      fixedNoteDescriptionRef.current?.blur();
    } else if (e.key === 'Tab' && e.shiftKey && fixedNote) {
      e.preventDefault();
      // Save current description
      if (fixedNoteDescriptionValue !== (fixedNote.description || '')) {
        onEdit(fixedNote.id, fixedNote.content, fixedNote.category, fixedNoteDescriptionValue || null);
      }
    }
  };

  // Handler to restore caret position when dropdown closes
  const restoreDescriptionCaret = useCallback(() => {
    if (descriptionCaretPositionRef.current !== null) {
      const position = descriptionCaretPositionRef.current;
      descriptionCaretPositionRef.current = null;
      // Use setTimeout to ensure the dropdown is fully closed before restoring focus
      setTimeout(() => {
        descriptionRef.current?.focus();
        descriptionRef.current?.setCursorPosition(position);
      }, 0);
    }
  }, []);

  // Wrapper handlers for dropdown open changes that restore caret on close
  const handleLabelDropdownOpenChange = useCallback((open: boolean) => {
    setLabelDropdownOpen(open);
    if (!open) {
      restoreDescriptionCaret();
    }
  }, [restoreDescriptionCaret]);

  const handleCategoryDropdownOpenChange = useCallback((open: boolean) => {
    setCategoryDropdownOpen(open);
    if (!open) {
      restoreDescriptionCaret();
    }
  }, [restoreDescriptionCaret]);

  const handleAssigneePickerOpenChange = useCallback((open: boolean) => {
    setAssigneePickerOpen(open);
    if (!open) {
      restoreDescriptionCaret();
    }
  }, [restoreDescriptionCaret]);

  // Hotkey options for category filters (work from anywhere, including search bar)
  const hotkeyOptions = { preventDefault: true, enableOnFormTags: true };

  // Ctrl+F to focus search bar (works from anywhere, including form fields)
  useHotkeys('ctrl+f', () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, { preventDefault: true, enableOnFormTags: true });

  // Alt+Q to toggle todo category
  useHotkeys('alt+q', () => {
    setCategoryFilter(categoryFilter === 'todo' ? 'all' : 'todo');
    setCategoryJustChanged(true);
  }, hotkeyOptions, [categoryFilter]);

  // Alt+W to toggle followup category
  useHotkeys('alt+w', () => {
    setCategoryFilter(categoryFilter === 'followup' ? 'all' : 'followup');
    setCategoryJustChanged(true);
  }, hotkeyOptions, [categoryFilter]);

  // Alt+E to toggle notes category
  useHotkeys('alt+e', () => {
    setCategoryFilter(categoryFilter === 'notes' ? 'all' : 'notes');
    setCategoryJustChanged(true);
  }, hotkeyOptions, [categoryFilter]);

  // Alt+R to toggle meeting category
  useHotkeys('alt+r', () => {
    setCategoryFilter(categoryFilter === 'meeting' ? 'all' : 'meeting');
    setCategoryJustChanged(true);
  }, hotkeyOptions, [categoryFilter]);

  // Alt+C to clear all filters
  useHotkeys('alt+c', () => {
    setCategoryFilter('all');
    setLabelFilter([]);
    setAssigneeFilter([]);
    setSortByDeadline(false);
    setSortByAssignee(false);
    setSortByCategory(false);
    setSortConfig({ deadline: null, assignee: null, category: null });
    setShowOverdueOnly(false);
    setCategoryJustChanged(true);
  }, hotkeyOptions);

  // Arrow down to select first task
  useHotkeys('down', () => {
    if ((categoryJustChanged || !selectedNote) && filteredNotes.length > 0) {
      onSelectNote(filteredNotes[0]);
      setFocusTarget('title');
      setCategoryJustChanged(false);
    }
  }, hotkeyOptions, [categoryJustChanged, selectedNote, filteredNotes, onSelectNote]);

  // Arrow up to select last task
  useHotkeys('up', () => {
    if ((categoryJustChanged || !selectedNote) && filteredNotes.length > 0) {
      onSelectNote(filteredNotes[filteredNotes.length - 1]);
      setFocusTarget('title');
      setCategoryJustChanged(false);
    }
  }, hotkeyOptions, [categoryJustChanged, selectedNote, filteredNotes, onSelectNote]);

  // Escape to deselect
  useHotkeys('escape', () => {
    onSelectNote(null);
    setCategoryJustChanged(false);
  }, hotkeyOptions, [onSelectNote]);

  // Alt+T to open deadline picker (only when a task is selected)
  useHotkeys('alt+t', () => {
    console.log('Alt+T pressed, selectedNote:', selectedNote);
    if (selectedNote) {
      console.log('Opening deadline picker');
      setDeadlinePickerOpen(true);
    }
  }, { preventDefault: true, enableOnFormTags: true, enableOnContentEditable: true }, [selectedNote]);

  // Ctrl+Shift+C to toggle calendar/list view
  useHotkeys('ctrl+shift+c', () => {
    setViewMode(viewMode === 'list' ? 'calendar' : 'list');
  }, hotkeyOptions, [viewMode, setViewMode]);

  // PERFORMANCE: Stable callbacks using refs to avoid dependency on notes array
  // These callbacks remain stable across renders, preventing unnecessary re-renders of child components
  // Note: Navigation handlers must be synchronous for proper focus management
  const handleSelectNoteById = useCallback((noteId: string) => {
    const note = notesRef.current.find(n => n.id === noteId);
    if (note) onSelectNote(note);
  }, [onSelectNote]);

  const handleNavigateDownById = useCallback((noteId: string, column: number): boolean => {
    const currentFilteredNotes = filteredNotesRef.current;
    const idx = currentFilteredNotes.findIndex((n) => n.id === noteId);
    if (idx < currentFilteredNotes.length - 1) {
      setDesiredColumn(column);
      onSelectNote(currentFilteredNotes[idx + 1]);
      setFocusTarget('title');
      return true;
    }
    return false;
  }, [onSelectNote]);

  const handleNavigateUpById = useCallback((noteId: string, column: number): boolean => {
    const currentFilteredNotes = filteredNotesRef.current;
    const idx = currentFilteredNotes.findIndex((n) => n.id === noteId);
    if (idx > 0) {
      setDesiredColumn(column);
      onSelectNote(currentFilteredNotes[idx - 1]);
      setFocusTarget('title');
      return true;
    } else if (idx === 0) {
      // On first task, navigate to the search bar
      onSelectNote(null);
      searchInputRef.current?.focus();
      return true;
    }
    return false;
  }, [onSelectNote]);

  const handleCreateNoteAfterById = useCallback((noteId: string) => {
    if (!onCreateNoteAfter) return;
    const currentFilteredNotes = filteredNotesRef.current;
    const afterNote = currentFilteredNotes.find((n) => n.id === noteId);
    if (!afterNote) return;

    // In calendar mode, inherit the deadline from the note we're creating after
    // This preserves the time component (e.g., if the note is at 14:00, new note will also be at 14:00)
    let deadline: string | undefined;
    if (viewMode === 'calendar' && calendarSelectedDate) {
      if (afterNote.deadline) {
        // Use the original note's deadline (preserves time component)
        deadline = afterNote.deadline;
      } else {
        // Fallback to just the date if no deadline on original note
        const year = calendarSelectedDate.getFullYear();
        const month = String(calendarSelectedDate.getMonth() + 1).padStart(2, '0');
        const day = String(calendarSelectedDate.getDate()).padStart(2, '0');
        deadline = `${year}-${month}-${day}`;
      }
    }

    // Pass label filter so new task is visible with current filters
    const result = onCreateNoteAfter(noteId, afterNote.category, deadline, labelFilter);
    // Handle both Promise and synchronous returns (TinyBase returns string ID, legacy returns Promise<Note>)
    Promise.resolve(result).then((newNoteOrId) => {
      if (newNoteOrId) {
        // If it's a string (ID from TinyBase), create minimal Note object; otherwise use as-is (Note from legacy)
        const newNote: Note = typeof newNoteOrId === 'string'
          ? { id: newNoteOrId } as unknown as Note
          : newNoteOrId;
        onSelectNote(newNote);
        setDesiredColumn(0);
        setFocusTarget('title');
      }
    });
  }, [onCreateNoteAfter, onSelectNote, viewMode, calendarSelectedDate, labelFilter]);

  // Handler to create a task at a specific hour in timeline view
  const handleCreateTaskAtTime = useCallback((hour: number) => {
    if (!onCreateNoteAfter || !calendarSelectedDate) return;

    // Build deadline with date + time in local timezone
    const year = calendarSelectedDate.getFullYear();
    const month = String(calendarSelectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(calendarSelectedDate.getDate()).padStart(2, '0');
    const hourStr = String(hour).padStart(2, '0');
    const deadline = `${year}-${month}-${day}T${hourStr}:00`;

    // Get last note in the current filtered list to use as reference, or use empty string for first note
    const currentFilteredNotes = filteredNotesRef.current;
    const lastNote = currentFilteredNotes[currentFilteredNotes.length - 1];
    const afterNoteId = lastNote?.id ?? '';

    // Create task with 'todo' category and the specific time deadline
    const result = onCreateNoteAfter(afterNoteId, 'todo', deadline, labelFilter);
    Promise.resolve(result).then((newNoteOrId) => {
      if (newNoteOrId) {
        const newNote: Note = typeof newNoteOrId === 'string'
          ? { id: newNoteOrId } as unknown as Note
          : newNoteOrId;
        onSelectNote(newNote);
        setDesiredColumn(0);
        setFocusTarget('title');
      }
    });
  }, [onCreateNoteAfter, onSelectNote, calendarSelectedDate, labelFilter]);

  const handleToggleFixInSidebarById = useCallback((noteId: string) => {
    if (fixedNoteId === noteId) {
      // Unfix: close sidebar and clear fixed note
      setFixedNoteId(null);
      setShowSidebar(false);
    } else {
      // Fix: open sidebar and set this note as fixed
      setFixedNoteId(noteId);
      setShowSidebar(true);
    }
  }, [fixedNoteId, setFixedNoteId, setShowSidebar]);

  // Handler for real-time title updates (only for selected note)
  const handleContentChange = useCallback((content: string) => {
    setTitleValue(content);
  }, []);

  if (notes.length === 0) {
    return (
      <p className="text-center text-muted-foreground/60 py-8 text-sm italic">
        {t('noNotes')}
      </p>
    );
  }

  const hasActiveFilters = searchQuery.trim() !== '' || categoryFilter !== 'all' || labelFilter.length > 0 || assigneeFilter.length > 0 || showOverdueOnly;

  // Special case: show message when there are only completed tasks (no active tasks)
  const shouldShowOnlyCompletedMessage = hasActiveFilters && activeNotes.length === 0 && completedNotes.length > 0;


  // Category icons and colors mapping
  const categoryStyles: Record<NoteCategory, { icon: React.ReactNode; className: string }> = {
    todo: { icon: <Pickaxe className="h-3 w-3" />, className: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30' },
    followup: { icon: <Forward className="h-3 w-3" />, className: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30' },
    notes: { icon: <StickyNote className="h-3 w-3" />, className: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-500/30' },
    meeting: { icon: <UsersIcon className="h-3 w-3" />, className: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30' },
  };

  // Build a comprehensive no-results message showing all active filters with badges
  const renderNoResultsMessage = (completedCount?: number) => {
    // Special case: filters match only completed tasks (no active tasks)
    const effectiveCompletedCount = completedCount ?? completedNotes.length;
    if (shouldShowOnlyCompletedMessage || (completedCount !== undefined && completedCount > 0)) {
      if (effectiveCompletedCount === 1) {
        return <span>{t('onlyCompletedTasksSingular')}</span>;
      }
      return <span>{t('onlyCompletedTasks', { count: effectiveCompletedCount })}</span>;
    }

    const elements: React.ReactNode[] = [];

    // Search text - bold
    if (searchQuery.trim() !== '') {
      elements.push(
        <span key="search" className="inline-flex items-center gap-1">
          {t('filterTextPrefix')} <strong className="font-semibold">"{searchQuery}"</strong>
        </span>
      );
    }

    // Category - badge with icon
    if (categoryFilter !== 'all') {
      const categoryName = t(`category${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)}`);
      const style = categoryStyles[categoryFilter];
      elements.push(
        <span key="category" className="inline-flex items-center gap-1">
          {t('filterCategoryPrefix')}
          <Badge className={`${style.className} gap-1`}>
            {style.icon}
            {categoryName}
          </Badge>
        </span>
      );
    }

    // Labels - badges with colors
    if (labelFilter.length > 0) {
      const selectedLabels = labels.filter(l => labelFilter.includes(l.id));
      if (selectedLabels.length > 0) {
        elements.push(
          <span key="labels" className="inline-flex items-center gap-1 flex-wrap">
            {t('filterLabelsPrefix')}
            {selectedLabels.map(label => (
              <Badge
                key={label.id}
                className="gap-1"
                style={{
                  backgroundColor: `${label.color}20`,
                  color: label.color,
                  borderColor: `${label.color}50`,
                }}
              >
                <Tag className="h-3 w-3" />
                {label.name}
              </Badge>
            ))}
          </span>
        );
      }
    }

    // Assignees - badges
    if (assigneeFilter.length > 0) {
      const selectedAssignees = contacts.filter(c => assigneeFilter.includes(c.id));
      if (selectedAssignees.length > 0) {
        elements.push(
          <span key="assignees" className="inline-flex items-center gap-1 flex-wrap">
            {t('filterAssigneesPrefix')}
            {selectedAssignees.map(contact => (
              <Badge
                key={contact.id}
                className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/30 gap-1"
              >
                <User className="h-3 w-3" />
                {`${contact.name} ${contact.lastname}`.trim()}
              </Badge>
            ))}
          </span>
        );
      }
    }

    // Overdue only - badge
    if (showOverdueOnly) {
      elements.push(
        <span key="overdue" className="inline-flex items-center gap-1">
          <Badge className="bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/30 gap-1">
            <AlertCircle className="h-3 w-3" />
            {t('filterOverdueOnly')}
          </Badge>
        </span>
      );
    }

    if (elements.length === 0) {
      return <span>{t('noNotesWithFilters')} {t('filterApplied')}</span>;
    }

    return (
      <span className="inline-flex items-center gap-1.5 flex-wrap justify-center">
        {t('noNotesWithFilters')}:
        {elements.map((el, idx) => (
          <span key={idx} className="inline-flex items-center gap-1">
            {idx > 0 && <span className="text-muted-foreground/50">,</span>}
            {el}
          </span>
        ))}
      </span>
    );
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full outline-none" tabIndex={0}>
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
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
        <NoteFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchKeyDown={(e) => {
            if (e.key === 'ArrowDown' && filteredNotes.length > 0) {
              e.preventDefault();
              onSelectNote(filteredNotes[0]);
              setDesiredColumn(0);
              setFocusTarget('title');
            } else if (e.key === 'Escape') {
              setSearchQuery('');
              searchInputRef.current?.blur();
            }
          }}
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
          hasCompletedTasks={completedNotes.length > 0}
          hasDeletedTasks={deletedNotes.length > 0}
        />
        {/* Sidebar button - only show when a note is fixed to sidebar */}
        {fixedNoteId && (
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
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        {/* NOTE LIST COLUMN WIDTH - adjust w-[30%] to change the note list width */}
        <div className="w-[30%] shrink-0 flex flex-col overflow-hidden">
          {viewMode === 'calendar' ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Calendar picker - left aligned */}
              <div className="flex-shrink-0 p-2">
                <CalendarView
                  notes={notes}
                  categoryFilter={categoryFilter}
                  selectedDate={calendarSelectedDate}
                  onSelectDate={setCalendarSelectedDate}
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
                  onUpdateAssignee={onUpdateAssignee}
                  taskStatusFilter={taskStatusFilter}
                  onRestoreNote={(noteId) => {
                    const note = calendarDeletedNotes.find(n => n.id === noteId);
                    if (note) onRestore(note);
                  }}
                  hasActiveFilters={hasActiveFilters}
                  renderNoResultsMessage={(completedCount) => renderNoResultsMessage(completedCount)}
                  sortByCategory={sortByCategory}
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
              <div className="overflow-y-auto pr-2 flex-[3]">
                {/* Show message when no active tasks but have filters */}
                {shouldShowOnlyCompletedMessage ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-center text-muted-foreground/60 text-sm italic">
                      {renderNoResultsMessage()}
                    </p>
                  </div>
                ) : activeNotes.length === 0 && filteredNotes.length === 0 && hasActiveFilters ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-center text-muted-foreground/60 text-sm italic">
                      {renderNoResultsMessage()}
                    </p>
                  </div>
                ) : (
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
                            onUpdateAssignee={onUpdateAssignee}
                      />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>
              )}

              {/* Completed tasks section */}
              {completedNotes.length > 0 && taskStatusFilter === 'completed' && (
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
                        assigneeName={assigneeNamesCache.get(note.id)}
                        compactView={compactTaskView}
                            isDescriptionFocused={isDescriptionFocused && selectedNote?.id === note.id}
                            contacts={contacts}
                            onUpdateAssignee={onUpdateAssignee}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Deleted tasks section */}
              {deletedNotes.length > 0 && taskStatusFilter === 'deleted' && (
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
                            onUpdateAssignee={onUpdateAssignee}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {selectedNote && (
        <div className="flex-1 min-w-0 border-l border-dashed border-muted-foreground/20 pl-4 overflow-hidden flex flex-col">
            <NoteEditorPanel
              ref={descriptionRef}
              note={selectedNote}
              noteLabels={noteLabels}
              allLabels={labels}
              descriptionValue={descriptionValue}
              titleValue={titleValue}
              showPostponeHistory={showPostponeHistory}
              history={history}
              labelDropdownOpen={labelDropdownOpen}
              categoryDropdownOpen={categoryDropdownOpen}
              deadlinePickerOpen={deadlinePickerOpen}
              assigneePickerOpen={assigneePickerOpen}
              editingHistoryEntry={editingHistoryEntry}
              contacts={contacts}
              onEdit={onEdit}
              onDescriptionChange={setDescriptionValue}
              onDescriptionBlur={handleDescriptionBlur}
              onDescriptionFocus={handleDescriptionFocus}
              onDescriptionKeyDown={handleDescriptionKeyDown}
              onTogglePostponeHistory={() => setShowPostponeHistory(!showPostponeHistory)}
              onAddLabel={handleAddLabel}
              onRemoveLabel={handleRemoveLabel}
              onEditLabel={handleEditLabel}
              onCreateLabel={() => setShowCreateLabelDialog(true)}
              onDeadlineChange={handleDeadlineChange}
              onDeadlineSave={handleDeadlineSave}
              onUpdateAssignee={onUpdateAssignee}
              onDelete={() => handleDeleteWithToast(selectedNote)}
              onLabelDropdownOpenChange={handleLabelDropdownOpenChange}
              onCategoryDropdownOpenChange={handleCategoryDropdownOpenChange}
              onDeadlinePickerOpenChange={setDeadlinePickerOpen}
              onAssigneePickerOpenChange={handleAssigneePickerOpenChange}
              onEditHistoryEntry={(entry) => setEditingHistoryEntry(entry)}
              onUpdateHistoryReason={updateHistoryReason}
              onDeleteHistoryEntry={(id) => setHistoryEntryToDelete(id)}
              onSetEditingHistoryEntry={setEditingHistoryEntry}
              onToggleComplete={(id) => handleToggleCompletedWithNavigation(id, !selectedNote.completed)}
            />
      </div>
        )}

      {showSidebar && (
      <div className="flex-1 min-w-0 border-l border-dashed border-muted-foreground/20 pl-4 overflow-hidden flex flex-col">
          {fixedNote ? (
            <NoteEditorPanel
              ref={fixedNoteDescriptionRef}
              note={fixedNote}
              noteLabels={fixedNoteLabels}
              allLabels={labels}
              descriptionValue={fixedNoteDescriptionValue}
              showPostponeHistory={fixedNoteShowPostponeHistory}
              history={fixedNoteHistory}
              labelDropdownOpen={fixedNoteLabelDropdownOpen}
              categoryDropdownOpen={fixedNoteCategoryDropdownOpen}
              deadlinePickerOpen={fixedNoteDeadlinePickerOpen}
              assigneePickerOpen={fixedNoteAssigneePickerOpen}
              editingHistoryEntry={editingFixedNoteHistoryEntry}
              contacts={contacts}
              onEdit={onEdit}
              onDescriptionChange={setFixedNoteDescriptionValue}
              onDescriptionBlur={handleFixedNoteDescriptionBlur}
              onDescriptionKeyDown={handleFixedNoteDescriptionKeyDown}
              onTogglePostponeHistory={() => setFixedNoteShowPostponeHistory(!fixedNoteShowPostponeHistory)}
              onAddLabel={handleFixedNoteAddLabel}
              onRemoveLabel={handleFixedNoteRemoveLabel}
              onEditLabel={handleEditLabel}
              onCreateLabel={() => setShowCreateLabelDialog(true)}
              onDeadlineChange={handleFixedNoteDeadlineChange}
              onDeadlineSave={handleFixedNoteDeadlineSave}
              onUpdateAssignee={onUpdateAssignee}
              onDelete={() => handleDeleteWithToast(fixedNote)}
              onLabelDropdownOpenChange={setFixedNoteLabelDropdownOpen}
              onCategoryDropdownOpenChange={setFixedNoteCategoryDropdownOpen}
              onDeadlinePickerOpenChange={setFixedNoteDeadlinePickerOpen}
              onAssigneePickerOpenChange={setFixedNoteAssigneePickerOpen}
              onEditHistoryEntry={(entry) => setEditingFixedNoteHistoryEntry(entry)}
              onUpdateHistoryReason={updateFixedNoteHistoryReason}
              onDeleteHistoryEntry={(id) => setFixedNoteHistoryEntryToDelete(id)}
              onSetEditingHistoryEntry={setEditingFixedNoteHistoryEntry}
              onToggleComplete={(id) => handleToggleCompletedWithNavigation(id, !fixedNote.completed)}
            />
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">
            {t('selectNoteToEdit')}
          </p>
        )}
      </div>
      )}
      </div>

      {/* Create Label Dialog */}
      <Dialog open={showCreateLabelDialog} onOpenChange={setShowCreateLabelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createLabel')}</DialogTitle>
            <DialogDescription>{t('newLabelName')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="text"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder={t('newLabelName')}
              className="w-full px-3 py-2 text-sm border border-muted-foreground/20 rounded-md bg-transparent focus:outline-none focus:border-muted-foreground/40 text-foreground caret-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabelName.trim()) {
                  handleCreateLabel();
                }
              }}
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('labelColor')}</p>
              <ColorPicker
                color={newLabelColor}
                onChange={setNewLabelColor}
                presetColors={LABEL_COLORS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateLabelDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCreateLabel} disabled={!newLabelName.trim()}>
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Label Dialog */}
      <Dialog open={!!editingLabel} onOpenChange={(open) => !open && setEditingLabel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editLabel')}</DialogTitle>
            <DialogDescription>{t('editLabelDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="text"
              value={editLabelName}
              onChange={(e) => setEditLabelName(e.target.value)}
              placeholder={t('newLabelName')}
              className="w-full px-3 py-2 text-sm border border-muted-foreground/20 rounded-md bg-transparent focus:outline-none focus:border-muted-foreground/40 text-foreground caret-foreground"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editLabelName.trim()) {
                  handleSaveEditLabel();
                }
              }}
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('labelColor')}</p>
              <ColorPicker
                color={editLabelColor}
                onChange={setEditLabelColor}
                presetColors={LABEL_COLORS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLabel(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveEditLabel} disabled={!editLabelName.trim()}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Postpone Dialog */}
      <PostponeDialog
        open={postponeDialogOpen}
        onOpenChange={(open) => {
          setPostponeDialogOpen(open);
          if (!open) setPendingPostponeDate(null);
        }}
        onPostpone={handlePostpone}
        taskContent={noteToPostpone?.content || ''}
        initialDate={pendingPostponeDate}
      />

      {/* Delete Postpone Reason Confirmation Dialog */}
      <Dialog open={!!historyEntryToDelete} onOpenChange={(open) => !open && setHistoryEntryToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deletePostponeReason')}</DialogTitle>
            <DialogDescription>{t('confirmDeletePostpone')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryEntryToDelete(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (historyEntryToDelete) {
                  deleteHistoryEntry(historyEntryToDelete);
                  setHistoryEntryToDelete(null);
                }
              }}
            >
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Fixed Note Postpone Reason Confirmation Dialog */}
      <Dialog open={!!fixedNoteHistoryEntryToDelete} onOpenChange={(open) => !open && setFixedNoteHistoryEntryToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deletePostponeReason')}</DialogTitle>
            <DialogDescription>{t('confirmDeletePostpone')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixedNoteHistoryEntryToDelete(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (fixedNoteHistoryEntryToDelete) {
                  deleteFixedNoteHistoryEntry(fixedNoteHistoryEntryToDelete);
                  setFixedNoteHistoryEntryToDelete(null);
                }
              }}
            >
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
