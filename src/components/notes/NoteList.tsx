import { useEffect, useRef, useState, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { Calendar, Search, Pickaxe, Forward, StickyNote, Tag, X, PanelRightClose, PanelRightOpen, ArrowUpDown, AlertTriangle, Users, ChevronDown, Check, List } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import type { EditableDescriptionHandle } from '@/components/ui/EditableDescription';
import { useNoteHistory } from '@/hooks/useNoteHistory';
import { useLabels } from '@/hooks/useLabels';
import { useAutoLabel } from '@/hooks/useAutoLabel';
import { useSettings } from '@/hooks/useSettings';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import type { Note, NoteCategory, Label } from '@/types/note';
import { PostponeDialog } from './PostponeDialog';
import { MemoizedNoteRow } from './NoteRow';
import { NoteEditorPanel } from './NoteEditorPanel';
import { CalendarView } from './CalendarView';
import { parseLocalDate } from '@/utils/dateUtils';

interface NoteListProps {
  notes: Note[];
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDelete: (id: string) => void;
  onRestore: (note: Note) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onUpdateDeadline: (id: string, deadline: string | null) => void;
  onReorderNotes: (orderedIds: string[]) => void;
  onPostponeNote: (id: string, newDeadline: string, reason: string) => Promise<void>;
  selectedNote: Note | null;
  onSelectNote: (note: Note | null) => void;
  onNavigateToEditor?: (column: number) => void;
  onCreateNoteAfter?: (afterNoteId: string, category: NoteCategory) => Promise<Note>;
  // External filter control (from CommandPalette)
  externalLabelFilter?: string[];
  externalCategoryFilter?: NoteCategory | 'all';
  onLabelFilterChange?: (labels: string[]) => void;
  onCategoryFilterChange?: (category: NoteCategory | 'all') => void;
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

export const NoteList = forwardRef<NoteListHandle, NoteListProps>(function NoteList({ notes, onEdit, onDelete, onRestore, onToggleCompleted, onTogglePinned, onUpdateDeadline, onReorderNotes, onPostponeNote, selectedNote, onSelectNote, onNavigateToEditor, onCreateNoteAfter, externalLabelFilter, externalCategoryFilter, onLabelFilterChange, onCategoryFilterChange }, ref) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<EditableDescriptionHandle>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [titleValue, setTitleValue] = useState('');
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [desiredColumn, setDesiredColumn] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalCategoryFilter, setInternalCategoryFilter] = useState<NoteCategory | 'all'>('all');

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
  const { labels, getLabelsForNote, addLabelToNote, removeLabelFromNote, createLabel, updateLabel, noteLabelVersion } = useLabels();
  const [internalLabelFilter, setInternalLabelFilter] = useState<string[]>([]);

  // PERFORMANCE: Cache all note labels to avoid SQL queries on every render
  // This computes labels once per render instead of once per note per render
  const noteLabelsCache = useMemo(() => {
    const cache = new Map<string, Label[]>();
    // Only compute for visible notes to avoid unnecessary work
    for (const note of notes) {
      cache.set(note.id, getLabelsForNote(note.id));
    }
    return cache;
  }, [notes, getLabelsForNote, noteLabelVersion]);

  // Auto-labeling with AI
  const { autoLabelNote } = useAutoLabel();

  // Use external filters if provided, otherwise use internal state
  const labelFilter = externalLabelFilter ?? internalLabelFilter;
  const categoryFilter = externalCategoryFilter ?? internalCategoryFilter;

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
  const viewMode = settings.viewMode;
  const setViewMode = (value: 'list' | 'calendar') => updateSettings({ viewMode: value });
  const [calendarSelectedDate, setCalendarSelectedDate] = useState<Date | undefined>(undefined);
  const [sortByDeadline, setSortByDeadline] = useState(false);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showPostponeHistory, setShowPostponeHistory] = useState(false);
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false);

  // Fixed note editor state (for right column)
  const [fixedNoteLabels, setFixedNoteLabels] = useState<Label[]>([]);
  const [fixedNoteLabelDropdownOpen, setFixedNoteLabelDropdownOpen] = useState(false);
  const [fixedNoteCategoryDropdownOpen, setFixedNoteCategoryDropdownOpen] = useState(false);
  const [fixedNoteDeadlinePickerOpen, setFixedNoteDeadlinePickerOpen] = useState(false);
  const [fixedNoteDescriptionValue, setFixedNoteDescriptionValue] = useState('');
  const [fixedNoteShowPostponeHistory, setFixedNoteShowPostponeHistory] = useState(false);
  const fixedNoteDescriptionRef = useRef<EditableDescriptionHandle>(null);
  const { history: fixedNoteHistory, updateHistoryReason: updateFixedNoteHistoryReason } = useNoteHistory(fixedNote?.id ?? null);
  const [fixedNoteHistoryEntryToDelete, setFixedNoteHistoryEntryToDelete] = useState<string | null>(null);
  const [editingFixedNoteHistoryEntry, setEditingFixedNoteHistoryEntry] = useState<{ id: string; reason: string } | null>(null);

  const LABEL_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
  ];

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    // Pinned notes always pass through filters (except search query)
    if (note.pinned) {
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
    if (categoryFilter !== 'all' && note.category !== categoryFilter) {
      return false;
    }
    // Filter by labels (OR logic - note must have at least one selected label)
    if (labelFilter.length > 0) {
      // PERFORMANCE: Use cached labels instead of SQL query
      const noteLabelIds = (noteLabelsCache.get(note.id) || []).map(l => l.id);
      const hasMatchingLabel = labelFilter.some(labelId => noteLabelIds.includes(labelId));
      if (!hasMatchingLabel) return false;
    }
    // Filter by overdue status (only show tasks with deadlines that have passed)
    // Uses same logic as the red badge display: deadline < now
    if (showOverdueOnly) {
      if (!note.deadline) return false;
      const isOverdue = parseLocalDate(note.deadline) < new Date() && !note.completed;
      if (!isOverdue) return false;
    }
    // Filter by search query
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = note.content.toLowerCase().includes(query);
    const descriptionMatch = note.description?.toLowerCase().includes(query) ?? false;
    return titleMatch || descriptionMatch;
  }), [notes, categoryFilter, labelFilter, showOverdueOnly, searchQuery, noteLabelsCache]);

  // Separate active and completed notes
  // Memoized to avoid recomputing sort on every render
  const activeNotes = useMemo(() => {
    let active = baseFilteredNotes.filter((note) => !note.completed);

    // Sort active notes by deadline if enabled
    if (sortByDeadline) {
      active = [...active].sort((a, b) => {
        // Pinned notes always come first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;

        // Both pinned or both not pinned - sort by deadline
        // Notes without deadline go to the end
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        // Sort by deadline ascending (earliest first)
        return parseLocalDate(a.deadline).getTime() - parseLocalDate(b.deadline).getTime();
      });
    } else {
      // Even without deadline sorting, pinned notes should come first
      active = [...active].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return 0; // Maintain original order for non-pinned notes
      });
    }
    return active;
  }, [baseFilteredNotes, sortByDeadline]);

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

  // Calendar view: filter notes by selected date (only open followups and meetings with deadlines)
  const calendarFilteredNotes = useMemo(() => {
    if (!calendarSelectedDate) return [];
    const dateKey = calendarSelectedDate.toISOString().split('T')[0];
    return notes.filter((note) => {
      // Only show open (not completed) tasks
      if (note.completed) return false;
      // Must have a deadline matching the selected date
      if (!note.deadline) return false;
      const noteDeadline = note.deadline.split('T')[0];
      if (noteDeadline !== dateKey) return false;
      // Only show followups and meetings
      if (note.category !== 'followup' && note.category !== 'meeting') return false;
      // Apply category filter if set
      if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;
      return true;
    });
  }, [notes, calendarSelectedDate, categoryFilter]);

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
      // If there's an existing deadline, prompt for postpone reason
      if (selectedNote.deadline) {
        handleOpenPostponeDialog(selectedNote.id, date);
      } else {
        // No existing deadline, just set it directly
        onUpdateDeadline(selectedNote.id, date.toISOString());
      }
    } else {
      // Clearing the deadline
      onUpdateDeadline(selectedNote.id, null);
    }
  };

  const handleFixedNoteDeadlineChange = (date: Date | undefined) => {
    if (!fixedNote) return;

    if (date) {
      // If there's an existing deadline, prompt for postpone reason
      if (fixedNote.deadline) {
        handleOpenPostponeDialog(fixedNote.id, date);
      } else {
        // No existing deadline, just set it directly
        onUpdateDeadline(fixedNote.id, date.toISOString());
      }
    } else {
      // Clearing the deadline
      onUpdateDeadline(fixedNote.id, null);
    }
  };

  const handleCreateNoteAfter = useCallback(async (afterNoteId: string) => {
    if (!onCreateNoteAfter) return;
    const afterNote = filteredNotes.find((n) => n.id === afterNoteId);
    if (!afterNote) return;

    const newNote = await onCreateNoteAfter(afterNoteId, afterNote.category);
    // Select and focus the new note
    onSelectNote(newNote);
    setDesiredColumn(0);
    setFocusTarget('title');
  }, [onCreateNoteAfter, filteredNotes, onSelectNote]);

  const handleDeleteWithToast = useCallback((note: Note) => {
    const currentIndex = filteredNotes.findIndex((n) => n.id === note.id);

    // Determine where to navigate after deletion
    let targetNote: Note | null = null;
    let shouldNavigateToEditor = false;

    if (filteredNotes.length === 1) {
      // Last task, navigate to editor
      shouldNavigateToEditor = true;
    } else if (currentIndex > 0) {
      // Has task above, navigate to it
      targetNote = filteredNotes[currentIndex - 1];
    } else {
      // First task (no task above), navigate to task below
      targetNote = filteredNotes[currentIndex + 1];
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
  }, [filteredNotes, onDelete, onSelectNote, onNavigateToEditor, onRestore, t]);

  // Handle fixing/unfixing a note in the sidebar
  const handleToggleFixInSidebar = useCallback((noteId: string) => {
    if (fixedNoteId === noteId) {
      // Unfix: close sidebar and clear fixed note
      setFixedNoteId(null);
      setShowSidebar(false);
    } else {
      // Fix: open sidebar and set this note as fixed
      setFixedNoteId(noteId);
      setShowSidebar(true);
    }
  }, [fixedNoteId]);

  // Handle toggle completion with navigation to adjacent task
  const handleToggleCompletedWithNavigation = useCallback((noteId: string, completed: boolean) => {
    // Find current position in activeNotes (only active notes matter for navigation)
    const currentIndex = activeNotes.findIndex((n) => n.id === noteId);

    // Only navigate when completing a task (not when uncompleting)
    if (completed && currentIndex !== -1) {
      // Determine where to navigate after completion
      let targetNote: Note | null = null;

      if (activeNotes.length === 1) {
        // Last active task, deselect (show default description area)
        targetNote = null;
      } else if (currentIndex < activeNotes.length - 1) {
        // Has task below, navigate to it
        targetNote = activeNotes[currentIndex + 1];
      } else if (currentIndex > 0) {
        // Last task in list but has task above, navigate to it
        targetNote = activeNotes[currentIndex - 1];
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
  }, [activeNotes, onToggleCompleted, onSelectNote, t]);

  // PERFORMANCE: Cache label operation callbacks per note to prevent re-renders
  // Using useMemo with a Map ensures stable function references across renders
  const addLabelHandlers = useMemo(() => {
    const map = new Map<string, (labelId: string) => Promise<void>>();
    for (const note of notes) {
      map.set(note.id, async (labelId: string) => {
        await addLabelToNote(note.id, labelId);
      });
    }
    return map;
  }, [notes, addLabelToNote]);

  const removeLabelHandlers = useMemo(() => {
    const map = new Map<string, (labelId: string) => Promise<void>>();
    for (const note of notes) {
      map.set(note.id, async (labelId: string) => {
        await removeLabelFromNote(note.id, labelId);
      });
    }
    return map;
  }, [notes, removeLabelFromNote]);

  const autoLabelHandlers = useMemo(() => {
    const map = new Map<string, ((noteId: string, content: string, description?: string | null) => Promise<void>)>();
    for (const note of notes) {
      map.set(note.id, async (noteId: string, content: string, description?: string | null) => {
        await autoLabelNote(noteId, content, description);
      });
    }
    return map;
  }, [notes, autoLabelNote]);

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

  // ↓ desde título - returns true if navigation occurred
  const handleNavigateDownFromTitle = useCallback((noteId: string, column: number): boolean => {
    const idx = filteredNotes.findIndex((n) => n.id === noteId);
    if (idx < filteredNotes.length - 1) {
      setDesiredColumn(column);
      onSelectNote(filteredNotes[idx + 1]);
      setFocusTarget('title');
      return true;
    }
    return false;
  }, [filteredNotes, onSelectNote]);

  // ↑ desde título - returns true if navigation occurred
  const handleNavigateUpFromTitle = useCallback((noteId: string, column: number): boolean => {
    const idx = filteredNotes.findIndex((n) => n.id === noteId);
    if (idx > 0) {
      setDesiredColumn(column);
      const prevNote = filteredNotes[idx - 1];
      onSelectNote(prevNote);
      setFocusTarget('title');
      return true;
    } else if (idx === 0) {
      // On first task, navigate to the search bar
      onSelectNote(null);
      searchInputRef.current?.focus();
      return true;
    }
    return false;
  }, [filteredNotes, onSelectNote]);

  const handleTitleFocused = useCallback(() => {
    if (focusTarget === 'title') {
      setFocusTarget(null);
    }
  }, [focusTarget]);

  // Tab from title - always go to description (even if empty)
  const handleNavigateToDescription = useCallback(() => {
    setDesiredColumn(0);
    setFocusTarget('description-start');
  }, []);

  // Save description when it changes and user stops typing
  const handleDescriptionBlur = () => {
    if (selectedNote && descriptionValue !== (selectedNote.description || '')) {
      onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'l' && e.ctrlKey && selectedNote) {
      e.preventDefault();
      setLabelDropdownOpen(true);
    } else if (e.key === 'c' && e.altKey && selectedNote) {
      e.preventDefault();
      setCategoryDropdownOpen(true);
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
    if (e.key === 'l' && e.ctrlKey && fixedNote) {
      e.preventDefault();
      setFixedNoteLabelDropdownOpen(true);
    } else if (e.key === 'c' && e.altKey && fixedNote) {
      e.preventDefault();
      setFixedNoteCategoryDropdownOpen(true);
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
    setSortByDeadline(false);
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

  // PERFORMANCE: Cache navigation and selection handlers per note to prevent creating new functions on every render
  // This ensures stable function references for React.memo optimization
  const selectHandlers = useMemo(() => {
    const map = new Map<string, () => void>();
    for (const note of notes) {
      map.set(note.id, () => onSelectNote(note));
    }
    return map;
  }, [notes, onSelectNote]);

  const navigateDownHandlers = useMemo(() => {
    const map = new Map<string, (column: number) => boolean>();
    for (const note of notes) {
      map.set(note.id, (column: number) => handleNavigateDownFromTitle(note.id, column));
    }
    return map;
  }, [notes, handleNavigateDownFromTitle]);

  const navigateUpHandlers = useMemo(() => {
    const map = new Map<string, (column: number) => boolean>();
    for (const note of notes) {
      map.set(note.id, (column: number) => handleNavigateUpFromTitle(note.id, column));
    }
    return map;
  }, [notes, handleNavigateUpFromTitle]);

  const createNoteAfterHandlers = useMemo(() => {
    const map = new Map<string, () => void>();
    for (const note of notes) {
      map.set(note.id, () => handleCreateNoteAfter(note.id));
    }
    return map;
  }, [notes, handleCreateNoteAfter]);

  const toggleFixInSidebarHandlers = useMemo(() => {
    const map = new Map<string, () => void>();
    for (const note of notes) {
      map.set(note.id, () => handleToggleFixInSidebar(note.id));
    }
    return map;
  }, [notes, handleToggleFixInSidebar]);

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

  const hasActiveFilters = searchQuery.trim() !== '' || categoryFilter !== 'all' || labelFilter.length > 0 || showOverdueOnly;

  // Special case: show message when there are only completed tasks (no active tasks)
  const shouldShowOnlyCompletedMessage = hasActiveFilters && activeNotes.length === 0 && completedNotes.length > 0;


  // Build a comprehensive no-results message showing all active filters
  const getNoResultsMessage = () => {
    // Special case: filters match only completed tasks (no active tasks)
    if (shouldShowOnlyCompletedMessage) {
      if (completedNotes.length === 1) {
        return t('onlyCompletedTasksSingular');
      }
      return t('onlyCompletedTasks', { count: completedNotes.length });
    }

    const parts: string[] = [];

    if (searchQuery.trim() !== '') {
      parts.push(`texto "${searchQuery}"`);
    }

    if (categoryFilter !== 'all') {
      const categoryName = t(`category${categoryFilter.charAt(0).toUpperCase() + categoryFilter.slice(1)}`);
      parts.push(`categoría ${categoryName}`);
    }

    if (labelFilter.length > 0) {
      const selectedLabels = labels.filter(l => labelFilter.includes(l.id)).map(l => l.name);
      if (selectedLabels.length > 0) {
        parts.push(`${selectedLabels.length === 1 ? 'etiqueta' : 'etiquetas'} ${selectedLabels.join(', ')}`);
      }
    }

    if (showOverdueOnly) {
      parts.push('solo tareas vencidas');
    }

    if (parts.length === 0) {
      return t('noNotesWithFilters') + ' los filtros aplicados';
    }

    return t('noNotesWithFilters') + ': ' + parts.join(', ');
  };

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden" tabIndex={0}>
      <div className="flex gap-2 mb-3 flex-shrink-0">
        {/* View mode toggle - at the beginning */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {viewMode === 'calendar' ? <List className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{viewMode === 'calendar' ? t('calendar.switchToListView') : t('calendar.switchToCalendarView')}</p>
          </TooltipContent>
        </Tooltip>
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
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
            placeholder={t('searchNotes')}
            className="w-full pl-7 h-7 text-xs bg-transparent border border-muted-foreground/20 rounded-md outline-none focus:border-muted-foreground/40 transition-colors"
          />
        </div>
        {/* Category filters - hidden in calendar mode */}
        {viewMode !== 'calendar' && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'todo' ? 'all' : 'todo')}
              className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md border transition-colors ${
                categoryFilter === 'todo'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
              }`}
              title={t('categoryTodo')}
            >
              <Pickaxe className="h-3.5 w-3.5" />
              <span>{t('categoryTodo')}</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'followup' ? 'all' : 'followup')}
              className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md border transition-colors ${
                categoryFilter === 'followup'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
              }`}
              title={t('categoryFollowUp')}
            >
              <Forward className="h-3.5 w-3.5" />
              <span>{t('categoryFollowUp')}</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'notes' ? 'all' : 'notes')}
              className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md border transition-colors ${
                categoryFilter === 'notes'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
              }`}
              title={t('categoryNotes')}
            >
              <StickyNote className="h-3.5 w-3.5" />
              <span>{t('categoryNotes')}</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === 'meeting' ? 'all' : 'meeting')}
              className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md border transition-colors ${
                categoryFilter === 'meeting'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
              }`}
              title={t('categoryMeeting')}
            >
              <Users className="h-3.5 w-3.5" />
              <span>{t('categoryMeeting')}</span>
            </button>
          </div>
        )}
        {/* Label filters dropdown */}
        {labels.length > 0 && (
          <div className="flex gap-1 items-center ml-2 pl-2 border-l border-muted-foreground/20">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md border border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40 transition-colors"
                >
                  <Tag className="h-3.5 w-3.5" />
                  <span>{t('labels')}</span>
                  <ChevronDown className="h-3 w-3" />
                </button>
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
                              setLabelFilter(prev =>
                                prev.includes(label.id)
                                  ? prev.filter(id => id !== label.id)
                                  : [...prev, label.id]
                              );
                            }}
                            className="flex items-center justify-between"
                          >
                            <div className="flex items-center">
                              <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: label.color }} />
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
                  const label = labels.find(l => l.id === labelId);
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
                        onClick={() => setLabelFilter(prev => prev.filter(id => id !== label.id))}
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
        {/* Deadline options */}
        <div className="flex gap-1 items-center ml-2 pl-2 border-l border-muted-foreground/20">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setSortByDeadline(!sortByDeadline)}
                className={`flex items-center gap-1 px-2 h-6 text-xs rounded-md border transition-colors ${
                  sortByDeadline
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
                }`}
              >
                <ArrowUpDown className="h-3 w-3" />
                <Calendar className="h-3 w-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('sortByDeadline')}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setShowOverdueOnly(!showOverdueOnly)}
                className={`flex items-center gap-1 px-2 h-6 text-xs rounded-md border transition-colors ${
                  showOverdueOnly
                    ? 'bg-destructive text-destructive-foreground border-destructive'
                    : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>{t('overdue')}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('showOverdueOnly')}</p>
            </TooltipContent>
          </Tooltip>
        </div>
        {/* Sidebar button */}
        <div className="ml-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setShowSidebar(!showSidebar)}
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
      </div>
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        <div className={`${showSidebar ? 'w-[38rem]' : 'flex-1'} shrink-0 flex flex-col overflow-hidden`}>
          {viewMode === 'calendar' ? (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Calendar picker - centered */}
              <div className="flex-shrink-0 flex justify-center p-2">
                <CalendarView
                  notes={notes}
                  categoryFilter={categoryFilter}
                  selectedDate={calendarSelectedDate}
                  onSelectDate={setCalendarSelectedDate}
                />
              </div>
              {/* Task list for selected date - below calendar */}
              <div className="flex-1 overflow-y-auto pr-2 mt-2">
                {calendarSelectedDate ? (
                  calendarFilteredNotes.length > 0 ? (
                    calendarFilteredNotes.map((note) => (
                      <MemoizedNoteRow
                        key={note.id}
                        note={note}
                        onDeleteWithToast={handleDeleteWithToast}
                        onToggleCompleted={handleToggleCompletedWithNavigation}
                        onTogglePinned={onTogglePinned}
                        isSelected={selectedNote?.id === note.id}
                        onSelect={selectHandlers.get(note.id)!}
                        onEdit={onEdit}
                        onNavigateDown={navigateDownHandlers.get(note.id)!}
                        onNavigateUp={navigateUpHandlers.get(note.id)!}
                        onNavigateToDescription={handleNavigateToDescription}
                        shouldFocusTitle={focusTarget === 'title' && selectedNote?.id === note.id}
                        desiredColumn={desiredColumn}
                        onTitleFocused={handleTitleFocused}
                        onCreateNoteAfter={createNoteAfterHandlers.get(note.id)!}
                        isDragging={false}
                        labels={noteLabelsCache.get(note.id) || []}
                        allLabels={labels}
                        onAddLabel={addLabelHandlers.get(note.id)!}
                        onRemoveLabel={removeLabelHandlers.get(note.id)!}
                        onCreateLabel={handleCreateLabelClick}
                        onEditLabel={handleEditLabel}
                        onAutoLabel={autoLabelHandlers.get(note.id)!}
                        isFixedInSidebar={fixedNoteId === note.id}
                        onToggleFixInSidebar={toggleFixInSidebarHandlers.get(note.id)!}
                        onContentChange={selectedNote?.id === note.id ? handleContentChange : undefined}
                      />
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground/50 italic p-4 text-center">
                      {t('calendar.noTasks')}
                    </p>
                  )
                ) : (
                  <p className="text-sm text-muted-foreground/50 italic p-4 text-center">
                    {t('calendar.selectDateHint')}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Active tasks section - 75% */}
              <div className="overflow-y-auto pr-2 flex-[3]">
                {/* Show message when no active tasks but have filters */}
                {shouldShowOnlyCompletedMessage ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-center text-muted-foreground/60 text-sm italic">
                      {getNoResultsMessage()}
                    </p>
                  </div>
                ) : activeNotes.length === 0 && filteredNotes.length === 0 && hasActiveFilters ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-center text-muted-foreground/60 text-sm italic">
                      {getNoResultsMessage()}
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
                        onSelect={selectHandlers.get(note.id)!}
                        onEdit={onEdit}
                        onNavigateDown={navigateDownHandlers.get(note.id)!}
                        onNavigateUp={navigateUpHandlers.get(note.id)!}
                        onNavigateToDescription={handleNavigateToDescription}
                        shouldFocusTitle={focusTarget === 'title' && selectedNote?.id === note.id}
                        desiredColumn={desiredColumn}
                        onTitleFocused={handleTitleFocused}
                        onCreateNoteAfter={createNoteAfterHandlers.get(note.id)!}
                        isDragging={activeId === note.id}
                        labels={noteLabelsCache.get(note.id) || []}
                        allLabels={labels}
                        onAddLabel={addLabelHandlers.get(note.id)!}
                        onRemoveLabel={removeLabelHandlers.get(note.id)!}
                        onCreateLabel={handleCreateLabelClick}
                        onEditLabel={handleEditLabel}
                        onAutoLabel={autoLabelHandlers.get(note.id)!}
                        isFixedInSidebar={fixedNoteId === note.id}
                        onToggleFixInSidebar={toggleFixInSidebarHandlers.get(note.id)!}
                        onContentChange={selectedNote?.id === note.id ? handleContentChange : undefined}
                      />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              {/* Completed tasks section - 25% */}
              {completedNotes.length > 0 && (
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
                        onSelect={selectHandlers.get(note.id)!}
                        onEdit={onEdit}
                        onNavigateDown={navigateDownHandlers.get(note.id)!}
                        onNavigateUp={navigateUpHandlers.get(note.id)!}
                        onNavigateToDescription={handleNavigateToDescription}
                        shouldFocusTitle={focusTarget === 'title' && selectedNote?.id === note.id}
                        desiredColumn={desiredColumn}
                        onTitleFocused={handleTitleFocused}
                        onCreateNoteAfter={createNoteAfterHandlers.get(note.id)!}
                        isDragging={false}
                        labels={noteLabelsCache.get(note.id) || []}
                        allLabels={labels}
                        onAddLabel={addLabelHandlers.get(note.id)!}
                        onRemoveLabel={removeLabelHandlers.get(note.id)!}
                        onCreateLabel={handleCreateLabelClick}
                        onEditLabel={handleEditLabel}
                        onAutoLabel={autoLabelHandlers.get(note.id)!}
                        isFixedInSidebar={fixedNoteId === note.id}
                        onToggleFixInSidebar={toggleFixInSidebarHandlers.get(note.id)!}
                        onContentChange={selectedNote?.id === note.id ? handleContentChange : undefined}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex-1 min-w-0 border-l border-dashed border-muted-foreground/20 pl-4 overflow-hidden flex flex-col">
          {selectedNote ? (
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
              editingHistoryEntry={editingHistoryEntry}
              onEdit={onEdit}
              onDescriptionChange={setDescriptionValue}
              onDescriptionBlur={handleDescriptionBlur}
              onDescriptionKeyDown={handleDescriptionKeyDown}
              onTogglePostponeHistory={() => setShowPostponeHistory(!showPostponeHistory)}
              onAddLabel={handleAddLabel}
              onRemoveLabel={handleRemoveLabel}
              onEditLabel={handleEditLabel}
              onCreateLabel={() => setShowCreateLabelDialog(true)}
              onDeadlineChange={handleDeadlineChange}
              onDelete={() => handleDeleteWithToast(selectedNote)}
              onLabelDropdownOpenChange={setLabelDropdownOpen}
              onCategoryDropdownOpenChange={setCategoryDropdownOpen}
              onDeadlinePickerOpenChange={setDeadlinePickerOpen}
              onEditHistoryEntry={(entry) => setEditingHistoryEntry(entry)}
              onUpdateHistoryReason={updateHistoryReason}
              onDeleteHistoryEntry={(id) => setHistoryEntryToDelete(id)}
              onSetEditingHistoryEntry={setEditingHistoryEntry}
            />
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">
            {t('selectNoteToEdit')}
          </p>
        )}
      </div>

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
              editingHistoryEntry={editingFixedNoteHistoryEntry}
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
              onDelete={() => handleDeleteWithToast(fixedNote)}
              onLabelDropdownOpenChange={setFixedNoteLabelDropdownOpen}
              onCategoryDropdownOpenChange={setFixedNoteCategoryDropdownOpen}
              onDeadlinePickerOpenChange={setFixedNoteDeadlinePickerOpen}
              onEditHistoryEntry={(entry) => setEditingFixedNoteHistoryEntry(entry)}
              onUpdateHistoryReason={updateFixedNoteHistoryReason}
              onDeleteHistoryEntry={(id) => setFixedNoteHistoryEntryToDelete(id)}
              onSetEditingHistoryEntry={setEditingFixedNoteHistoryEntry}
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
              className="w-full px-3 py-2 text-sm border border-muted-foreground/20 rounded-md bg-transparent focus:outline-none focus:border-muted-foreground/40"
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
              className="w-full px-3 py-2 text-sm border border-muted-foreground/20 rounded-md bg-transparent focus:outline-none focus:border-muted-foreground/40"
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
                  deleteHistoryEntry(fixedNoteHistoryEntryToDelete);
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
