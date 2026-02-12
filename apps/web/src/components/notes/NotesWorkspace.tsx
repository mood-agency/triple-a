import { useRef, useState, forwardRef, useImperativeHandle, useMemo, useEffect, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ArrowLeft } from 'lucide-react';
import {
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
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
import { useSettings } from '@/hooks/useSettings';
import { useContacts } from '@/hooks/useContacts';
import type { Note, NoteCategory, Label, NoteVersion } from '@/types/note';
import type { Contact } from '@/types/contact';
import { EMPTY_LABELS } from '@/constants/notes';
import { parseHashtags } from '@/utils/hashtagParser';
import { useLabels } from '@/hooks/useLabels';
import { useAssignees } from '@/hooks/useAssignees';
import { useNoteVersionsAndActions } from '@/hooks/useNoteVersionsAndActions';
import { useDeletedNotes } from '@/hooks/useDeletedNotes';
import { useNoteComments } from '@/hooks/useNoteComments';
import { NoteEditorPanel } from './NoteEditorPanel';
import { PostponeDialog } from './PostponeDialog';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { useNoteFilters } from './hooks/useNoteFilters';
import { getNoteCreationDefaults } from '@/utils/noteCreationDefaults';
import { useNoteSelection } from './hooks/useNoteSelection';
import { useNoteOperations } from './hooks/useNoteOperations';
import { NoteListToolbar } from './NoteListToolbar';
import { NoteListContent } from './NoteListContent';
import { DebugNavigationOverlay } from '@/hooks/useDebugNavigation';
import {
  useNavigationMediator,
  type RegionHandler,
  NavigationMediatorProvider,
} from './navigation';
import { useEventSubscription, eventBus } from '@/events';
import { useNoteFieldsStore } from '@/stores/useNoteFieldsStore';
import { useCommandPalette } from '@/contexts/CommandPaletteContext';

// Re-export types if needed
export interface NotesWorkspaceHandle {
  focusFirstTaskTitle: (column?: number) => void;
}

interface NotesWorkspaceProps {
  notes: Note[];
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDelete: (id: string, reason: string) => void;
  onRestore: (note: Note) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onUpdateDeadline: (id: string, deadline: string | null, isAllDay?: boolean) => void;
  onAddAssignee: (id: string, contactId: string) => void;
  onRemoveAssignee: (id: string, contactId: string) => void;
  onUpdateAssignee?: (id: string, contactId: string | null) => void;
  onReorderNotes: (orderedIds: string[]) => void;
  onPostponeNote: (id: string, newDeadline: string, reason: string) => Promise<void>;
  onTogglePublic?: (id: string, makePublic: boolean) => string | null | Promise<string | null>;
  selectedNote: Note | null;
  onSelectNote: (note: Note | null) => void;
  onNavigateToEditor?: (column: number) => void;
  onCreateNoteAfter?: (afterNoteId: string, category: NoteCategory, deadline?: string | null, labelIds?: string[], assigneeId?: string | null, newNoteId?: string) => Promise<Note>;
  onCreateTask?: () => void;
  loading?: boolean;
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
  // External sort control (from CommandPalette)
  externalSortConfig?: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null; createdAt: 'asc' | 'desc' | null };
  onSortConfigChange?: (config: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null; createdAt: 'asc' | 'desc' | null }) => void;
  // External task status control (from CommandPalette)
  externalTaskStatusFilter?: 'active' | 'completed' | 'deleted';
  onTaskStatusFilterChange?: (status: 'active' | 'completed' | 'deleted') => void;
  externalShowOverdueOnly?: boolean;
  onShowOverdueOnlyChange?: (show: boolean) => void;
  externalShowPublicOnly?: boolean;
  onShowPublicOnlyChange?: (show: boolean) => void;
  // Sidebar trigger element
  sidebarTrigger?: React.ReactNode;
  // Default contact for auto-assignment
  defaultContactId?: string | null;
}

export const NotesWorkspace = forwardRef<NotesWorkspaceHandle, NotesWorkspaceProps>(function NotesWorkspace({ notes, onEdit, onDelete, onRestore, onToggleCompleted, onTogglePinned, onUpdateDeadline, onAddAssignee, onRemoveAssignee, onUpdateAssignee, onReorderNotes, onPostponeNote, onTogglePublic, selectedNote, onSelectNote, onNavigateToEditor, onCreateNoteAfter, onCreateTask: _onCreateTask, loading: _loading, externalLabelFilter, externalCategoryFilter, externalAssigneeFilter, onLabelFilterChange, onCategoryFilterChange, onAssigneeFilterChange, externalViewMode, onViewModeChange, externalSelectedDate, onSelectedDateChange, externalSortConfig, onSortConfigChange, externalTaskStatusFilter, onTaskStatusFilterChange, externalShowOverdueOnly, onShowOverdueOnlyChange, externalShowPublicOnly, onShowPublicOnlyChange, sidebarTrigger, defaultContactId }, ref) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { contacts } = useContacts();
  const { deletedNotes } = useDeletedNotes({
    enabled: externalViewMode === 'calendar' || externalTaskStatusFilter === 'deleted',
  });
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Labels logic
  const { labels: rawLabels, getLabelsForNote, addLabelToNote, removeLabelFromNote, createLabel, updateLabel, noteLabelVersion } = useLabels();
  // Assignees logic
  const { noteAssigneeVersion, getAssigneesForNote } = useAssignees();
  const labelsKey = rawLabels.map(l => `${l.id}:${l.name}:${l.color}`).join(',');
  const labels = useMemo(() => rawLabels, [labelsKey]);

  const LABEL_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
  ];

  // Note Labels Cache
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const noteIdsKey = notes.map(n => n.id).join(',');

  const noteLabelsCache = useMemo(() => {
    const cache = new Map<string, Label[]>();

    // Build cache using the hook's getLabelsForNote function
    for (const note of notesRef.current) {
      const noteLabels = getLabelsForNote(note.id);
      cache.set(note.id, noteLabels.length > 0 ? noteLabels : EMPTY_LABELS);
    }

    return cache;
  }, [noteIdsKey, getLabelsForNote, noteLabelVersion]);

  // Note Assignees Cache (maps note_id -> array of Contact objects)
  const noteAssigneesCache = useMemo(() => {
    const cache = new Map<string, Contact[]>();

    // Build cache using the hook's getAssigneesForNote function
    for (const note of notesRef.current) {
      const assignees = getAssigneesForNote(note.id);
      cache.set(note.id, assignees);
    }

    return cache;
  }, [noteIdsKey, noteAssigneeVersion, getAssigneesForNote]);

  // --- Hooks ---
  const filters = useNoteFilters({
    notes,
    deletedNotes,
    externalLabelFilter,
    externalCategoryFilter,
    externalAssigneeFilter,
    onLabelFilterChange,
    onCategoryFilterChange,
    onAssigneeFilterChange,
    externalViewMode,
    onViewModeChange,
    externalSelectedDate,
    onSelectedDateChange,
    externalSortConfig,
    onSortConfigChange,
    noteLabelsCache,
    noteAssigneesCache,
    externalTaskStatusFilter,
    onTaskStatusFilterChange,
    externalShowOverdueOnly,
    onShowOverdueOnlyChange,
    externalShowPublicOnly,
    onShowPublicOnlyChange,
  });

  const selection = useNoteSelection({
    selectedNote,
    onEdit,
    autoSaveInterval: settings.autoSaveInterval,
  });

  const { isOpen: isCommandPaletteOpen } = useCommandPalette();
  const pendingFocusFirstTaskRef = useRef(false);

  // Navigation Mediator for centralized keyboard navigation
  // The onSaveItem callback centralizes save decisions - regions provide data, mediator decides if/when to save
  const navigationMediator = useNavigationMediator({
    onSaveItem: (region, itemId, data) => {
      let didSave = false;

      if (region === 'taskList') {
        // Compare with current note to avoid unnecessary saves
        const note = notes.find(n => n.id === itemId);
        if (note && (data.content !== note.content || data.category !== note.category)) {
          onEdit(itemId, data.content, data.category, data.description);
          didSave = true;
        }
      } else if (region === 'editor' || region === 'sidebar') {
        // For editor/sidebar regions, save description changes
        const note = notes.find(n => n.id === itemId);
        if (note && data.description !== note.description) {
          onEdit(itemId, note.content, note.category, data.description);
          didSave = true;
        }
      }

      // Emit save success event for UI feedback (toast)
      if (didSave) {
        eventBus.emit('editor:saveSuccess', { savedCount: 1 });
      }
    },
  });

  // Register search region handler
  const searchRegionHandler = useMemo<RegionHandler>(() => ({
    region: 'search',
    focusFirst: () => {
      searchInputRef.current?.focus();
      return true;
    },
    focusLast: () => {
      searchInputRef.current?.focus();
      return true;
    },
    canReceiveFocus: () => true,
  }), []);

  // Register search region with mediator
  useEffect(() => {
    navigationMediator.registerRegion(searchRegionHandler);
    return () => {
      navigationMediator.unregisterRegion('search');
    };
  }, [navigationMediator, searchRegionHandler]);

  // Listen for navigation events from regions (decouples regions from mediator)
  useEventSubscription('navigation:itemChanged', (event) => {
    navigationMediator.setCurrentItem(event.payload.region, event.payload.itemId);
  });

  useEventSubscription('navigation:pushHistory', (event) => {
    navigationMediator.pushFocusHistory({
      region: event.payload.region,
      noteId: event.payload.noteId,
      column: event.payload.column,
      context: event.payload.context,
    });
  });

  useEventSubscription('navigation:saveCurrentItem', (event) => {
    navigationMediator.saveCurrentItem(event.payload.region);
  });

  // Listen for Tab navigation to update title value immediately (before async save completes)
  useEventSubscription('editor:navigateToDescription', (event) => {
    if (event.payload.content !== undefined) {
      // Clean content (remove tags/mentions) before syncing to store so EditableTitle initializes clean
      // We use the current labels/contacts from the workspace
      const { cleanedContent } = parseHashtags(event.payload.content, { labels, contacts });
      // Use the event's noteId directly instead of selection.setTitleValue() which uses
      // selectedNoteIdRef.current — that ref can be stale if the user clicks a task
      // and presses Tab before the useEffect updates the ref, causing the WRONG
      // note's title to be updated (visual blink on the previous task).
      useNoteFieldsStore.getState().setTitleValue(event.payload.noteId, cleanedContent);
    }
  });

  // Window blur handler - save current items in all regions when user leaves the window
  useEffect(() => {
    const handleWindowBlur = () => {
      // Save current item in taskList region
      navigationMediator.saveCurrentItem('taskList');
      // Save current item in editor region (main description panel)
      navigationMediator.saveCurrentItem('editor');
      // Save current item in sidebar region (fixed sidebar panel)
      navigationMediator.saveCurrentItem('sidebar');
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [navigationMediator]);


  // Track previous filter values to detect changes and auto-select first task
  // Note: searchQuery is excluded - user should press Down arrow after typing to navigate to results
  const prevFiltersRef = useRef({
    categoryFilter: filters.categoryFilter,
    labelFilter: JSON.stringify(filters.labelFilter),
    assigneeFilter: JSON.stringify(filters.assigneeFilter),
    showOverdueOnly: filters.showOverdueOnly,
    viewMode: filters.viewMode,
    calendarSelectedDate: filters.calendarSelectedDate?.getTime(),
    taskStatusFilter: filters.taskStatusFilter,
    sortConfig: JSON.stringify(filters.sortConfig),
  });

  // Refs for current values to use in setTimeout
  const viewModeRef = useRef(filters.viewMode);
  viewModeRef.current = filters.viewMode;
  const calendarFilteredNotesRef = useRef(filters.calendarFilteredNotes);
  calendarFilteredNotesRef.current = filters.calendarFilteredNotes;

  useEffect(() => {
    const prev = prevFiltersRef.current;
    const hasFilterChanged =
      prev.categoryFilter !== filters.categoryFilter ||
      prev.labelFilter !== JSON.stringify(filters.labelFilter) ||
      prev.assigneeFilter !== JSON.stringify(filters.assigneeFilter) ||
      prev.showOverdueOnly !== filters.showOverdueOnly ||
      prev.viewMode !== filters.viewMode ||
      prev.calendarSelectedDate !== filters.calendarSelectedDate?.getTime() ||
      prev.taskStatusFilter !== filters.taskStatusFilter ||
      prev.sortConfig !== JSON.stringify(filters.sortConfig);

    if (hasFilterChanged) {
      // Always select the first filtered note immediately
      const notesToUse = viewModeRef.current === 'calendar' ? calendarFilteredNotesRef.current : filters.activeNotesRef.current;
      if (notesToUse.length > 0) {
        onSelectNote(notesToUse[0]);
      } else {
        onSelectNote(null);
      }

      if (isCommandPaletteOpen) {
        // Palette is still open (e.g. label/assignee toggles) — defer focus until it closes
        pendingFocusFirstTaskRef.current = true;
      } else {
        // Palette already closed — focus after dialog unmounts
        setTimeout(() => {
          selection.setFocusTarget('title');
          selection.setDesiredColumn(0);
        }, 50);
      }
    }

    prevFiltersRef.current = {
      categoryFilter: filters.categoryFilter,
      labelFilter: JSON.stringify(filters.labelFilter),
      assigneeFilter: JSON.stringify(filters.assigneeFilter),
      showOverdueOnly: filters.showOverdueOnly,
      viewMode: filters.viewMode,
      calendarSelectedDate: filters.calendarSelectedDate?.getTime(),
      taskStatusFilter: filters.taskStatusFilter,
      sortConfig: JSON.stringify(filters.sortConfig),
    };
  }, [filters.categoryFilter, filters.labelFilter, filters.assigneeFilter, filters.showOverdueOnly, filters.viewMode, filters.calendarSelectedDate, filters.taskStatusFilter, filters.sortConfig, filters.activeNotesRef, onSelectNote, selection, isCommandPaletteOpen]);

  // When the command palette closes and there's a pending focus, apply it
  useEffect(() => {
    if (!isCommandPaletteOpen && pendingFocusFirstTaskRef.current) {
      pendingFocusFirstTaskRef.current = false;
      // Small delay to ensure dialog is fully unmounted and focus trap released
      setTimeout(() => {
        const notesToUse = viewModeRef.current === 'calendar' ? calendarFilteredNotesRef.current : filters.activeNotesRef.current;
        if (notesToUse.length > 0) {
          onSelectNote(notesToUse[0]);
          selection.setFocusTarget('title');
          selection.setDesiredColumn(0);
        }
      }, 50);
    }
  }, [isCommandPaletteOpen, filters.activeNotesRef, onSelectNote, selection]);

  const noteCreationDefaults = useMemo(() => getNoteCreationDefaults({
    categoryFilter: filters.categoryFilter,
    labelFilter: filters.labelFilter,
    assigneeFilter: filters.assigneeFilter,
    dateRangeFilter: filters.dateRangeFilter,
    defaultContactId,
  }), [filters.categoryFilter, filters.labelFilter, filters.assigneeFilter, filters.dateRangeFilter, defaultContactId]);

  const operations = useNoteOperations({
    filteredNotesRef: filters.filteredNotesRef,
    activeNotesRef: filters.activeNotesRef,
    onDelete,
    onRestore,
    onToggleCompleted,
    onSelectNote,
    onNavigateToEditor,
    setDesiredColumn: selection.setDesiredColumn,
    setFocusTarget: selection.setFocusTarget,
    onCreateNoteAfter,
    viewMode: filters.viewMode,
    calendarSelectedDate: filters.calendarSelectedDate,
    noteCreationDefaults,
  });

  // --- UI State ---
  const showSidebar = settings.showSidebar;
  const setShowSidebar = (value: boolean) => updateSettings({ showSidebar: value });
  const [sidebarClosing, setSidebarClosing] = useState(false);

  const compactTaskView = settings.compactTaskView;
  const setCompactTaskView = (value: boolean) => updateSettings({ compactTaskView: value });

  // Fixed Note State
  const fixedNoteId = settings.fixedNoteId;
  const setFixedNoteId = (value: string | null) => updateSettings({ fixedNoteId: value });
  const [closingNote, setClosingNote] = useState<Note | null>(null);

  const fixedNote = useMemo(() => {
    if (!fixedNoteId) return null;
    return notes.find(n => n.id === fixedNoteId) ?? null;
  }, [notes, fixedNoteId]);

  // Use closingNote during animation, otherwise use fixedNote
  const displayedNote = sidebarClosing ? closingNote : fixedNote;

  // Ensure sidebar is visible when a note is pinned (handles state desync on page refresh)
  // Multiple useSettings() instances across the app sync independently with Supabase,
  // which can cause showSidebar to be overwritten to false while fixedNoteId remains set.
  useEffect(() => {
    if (fixedNoteId && fixedNote && !showSidebar && !sidebarClosing) {
      setShowSidebar(true);
    }
  }, [fixedNoteId, fixedNote, showSidebar, sidebarClosing]);

  const closeSidebar = useCallback(() => {
    setSidebarClosing(true);
    setShowSidebar(false);
    setFixedNoteId(null);
  }, [setShowSidebar, setFixedNoteId]);

  const handleToggleFixInSidebarById = useCallback((noteId: string) => {
    if (fixedNoteId === noteId) {
      // Save the current note for display during closing animation
      const noteToClose = notes.find(n => n.id === noteId) ?? null;
      setClosingNote(noteToClose);
      closeSidebar();
    } else {
      setClosingNote(null);
      setFixedNoteId(noteId);
      setShowSidebar(true);
      setSidebarClosing(false);
    }
  }, [fixedNoteId, setFixedNoteId, setShowSidebar, closeSidebar, notes]);

  // History (versions and actions) - always use selectedNote to show history for the note being edited
  const { versions, actions, deleteAction, updateReason, reload: reloadHistory } = useNoteVersionsAndActions(selectedNote?.id ?? null);
  const [historyEntryToDelete, setHistoryEntryToDelete] = useState<string | null>(null);
  const [editingHistoryEntry, setEditingHistoryEntry] = useState<{ id: string; reason: string } | null>(null);

  const { versions: fixedNoteVersions, actions: fixedNoteActions, deleteAction: deleteFixedNoteAction, updateReason: updateFixedNoteReason } = useNoteVersionsAndActions(fixedNote?.id ?? null);
  const [fixedNoteHistoryEntryToDelete, setFixedNoteHistoryEntryToDelete] = useState<string | null>(null);
  const [editingFixedNoteHistoryEntry, setEditingFixedNoteHistoryEntry] = useState<{ id: string; reason: string } | null>(null);

  // Dialogs & Local State
  // fixedNoteLabels removed — now managed via useNoteFieldsStore fixed slot
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
  const [showEditorDeleteDialog, setShowEditorDeleteDialog] = useState(false);
  const [showPostponeHistory, setShowPostponeHistory] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [deadlinePickerOpen, setDeadlinePickerOpen] = useState(false);
  const originalDeadlineRef = useRef<string | null>(null);
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [assigneeFilterPopoverOpen, setAssigneeFilterPopoverOpen] = useState(false);

  // Fixed Note Editor specific state
  const [fixedNoteLabelDropdownOpen, setFixedNoteLabelDropdownOpen] = useState(false);
  const [fixedNoteCategoryDropdownOpen, setFixedNoteCategoryDropdownOpen] = useState(false);
  const [fixedNoteDeadlinePickerOpen, setFixedNoteDeadlinePickerOpen] = useState(false);
  const fixedNoteOriginalDeadlineRef = useRef<string | null>(null);
  const [fixedNoteAssigneePickerOpen, setFixedNoteAssigneePickerOpen] = useState(false);
  const [fixedNoteShowPostponeHistory, setFixedNoteShowPostponeHistory] = useState(false);
  const [fixedNoteShowVersionHistory, setFixedNoteShowVersionHistory] = useState(false);
  const fixedNoteDescriptionRef = useRef<any>(null);
  const [showFixedNoteDeleteDialog, setShowFixedNoteDeleteDialog] = useState(false);

  // Read fixed note description from store (same entry as selected note if IDs match)
  const displayedNoteId = displayedNote?.id ?? null;
  const fixedNoteDescriptionStoreValue = useNoteFieldsStore(s => displayedNoteId ? s.notes[displayedNoteId]?.descriptionValue ?? '' : '');
  const handleFixedNoteDescriptionChange = useCallback((value: string) => {
    if (displayedNoteId) {
      useNoteFieldsStore.getState().setDescriptionValue(displayedNoteId, value);
    }
  }, [displayedNoteId]);

  // Comments for selected note and fixed note
  const selectedNoteComments = useNoteComments(selectedNote?.id ?? '');
  const fixedNoteComments = useNoteComments(displayedNote?.id ?? '');

  // --- Effects & Handlers ---
  // Sync labels for selected note via store
  useEffect(() => {
    const store = useNoteFieldsStore.getState();
    if (selectedNote) store.setLabelsValue(selectedNote.id, getLabelsForNote(selectedNote.id));
  }, [selectedNote?.id, getLabelsForNote, noteLabelVersion]);

  // Sync assignees for selected note via store
  useEffect(() => {
    const store = useNoteFieldsStore.getState();
    if (selectedNote) store.setAssigneesValue(selectedNote.id, getAssigneesForNote(selectedNote.id));
  }, [selectedNote?.id, noteAssigneeVersion, getAssigneesForNote]);

  // Initialize fixed note in store when fixed note changes
  useEffect(() => {
    if (sidebarClosing) return; // Don't clean up store during close animation
    const store = useNoteFieldsStore.getState();
    if (fixedNote) {
      store.selectFixedNote({ id: fixedNote.id, content: fixedNote.content, description: fixedNote.description, deadline: fixedNote.deadline });
    } else {
      store.selectFixedNote(null);
    }
  }, [fixedNote?.id, sidebarClosing]);

  // Sync fixed note content/deadline when updated externally (e.g., edited in task list)
  // Skip if the fixed note is also the selected note (selected note's fields are managed by useNoteSelection/BlockNoteNoteList)
  useEffect(() => {
    if (!fixedNote) return;
    const store = useNoteFieldsStore.getState();
    if (store.notes[fixedNote.id] && fixedNote.id !== store.selectedNoteId) {
      store.setTitleValue(fixedNote.id, fixedNote.content);
      store.setDeadlineValue(fixedNote.id, fixedNote.deadline);
    }
  }, [fixedNote?.content, fixedNote?.deadline]);

  // Sync fixed note labels and assignees via store
  useEffect(() => {
    const store = useNoteFieldsStore.getState();
    if (fixedNote) {
      store.setLabelsValue(fixedNote.id, getLabelsForNote(fixedNote.id));
      store.setAssigneesValue(fixedNote.id, getAssigneesForNote(fixedNote.id));
    }
  }, [fixedNote?.id, getLabelsForNote, getAssigneesForNote, noteLabelVersion, noteAssigneeVersion]);

  useEffect(() => {
    setShowPostponeHistory(false);
    setShowVersionHistory(false);
  }, [selectedNote]);

  useEffect(() => {
    setFixedNoteShowPostponeHistory(false);
    setFixedNoteShowVersionHistory(false);
  }, [fixedNote?.id]);

  // Label Handlers
  const handleAddLabel = async (labelId: string) => {
    if (!selectedNote) return;
    const label = labels.find(l => l.id === labelId);
    if (label) useNoteFieldsStore.getState().setLabelsValue(selectedNote.id, prev => [...prev, label]);
    await addLabelToNote(selectedNote.id, labelId);
    useNoteFieldsStore.getState().setLabelsValue(selectedNote.id, getLabelsForNote(selectedNote.id));
  };
  const handleRemoveLabel = async (labelId: string) => {
    if (!selectedNote) return;
    useNoteFieldsStore.getState().setLabelsValue(selectedNote.id, prev => prev.filter(l => l.id !== labelId));
    await removeLabelFromNote(selectedNote.id, labelId);
    useNoteFieldsStore.getState().setLabelsValue(selectedNote.id, getLabelsForNote(selectedNote.id));
  };
  const handleFixedNoteAddLabel = async (labelId: string) => {
    if (!fixedNote) return;
    const label = labels.find(l => l.id === labelId);
    if (label) useNoteFieldsStore.getState().setLabelsValue(fixedNote.id, prev => [...prev, label]);
    await addLabelToNote(fixedNote.id, labelId);
    useNoteFieldsStore.getState().setLabelsValue(fixedNote.id, getLabelsForNote(fixedNote.id));
  };
  const handleFixedNoteRemoveLabel = async (labelId: string) => {
    if (!fixedNote) return;
    useNoteFieldsStore.getState().setLabelsValue(fixedNote.id, prev => prev.filter(l => l.id !== labelId));
    await removeLabelFromNote(fixedNote.id, labelId);
    useNoteFieldsStore.getState().setLabelsValue(fixedNote.id, getLabelsForNote(fixedNote.id));
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
    if (selectedNote) useNoteFieldsStore.getState().setLabelsValue(selectedNote.id, getLabelsForNote(selectedNote.id));
  };

  const handleAddLabelToNote = useCallback(async (noteId: string, labelId: string) => {
    await addLabelToNote(noteId, labelId);
  }, [addLabelToNote]);

  const handleRemoveLabelFromNote = useCallback(async (noteId: string, labelId: string) => {
    await removeLabelFromNote(noteId, labelId);
  }, [removeLabelFromNote]);

  const handleCreateLabelClick = useCallback(() => { setShowCreateLabelDialog(true); }, []);
  const handleCreateLabelAndAdd = useCallback(async (noteId: string, labelName: string) => {
    const newLabel = await createLabel(labelName);
    if (newLabel) await addLabelToNote(noteId, newLabel.id);
  }, [createLabel, addLabelToNote]);

  // Version history restore handlers
  const handleRestoreVersion = useCallback((entry: NoteVersion) => {
    if (selectedNote) {
      selection.setDescriptionValue(entry.description || '');
      onEdit(selectedNote.id, selectedNote.content, selectedNote.category, entry.description);
      setShowVersionHistory(false);
    }
  }, [selectedNote, selection, onEdit]);

  const handleFixedNoteRestoreVersion = useCallback((entry: NoteVersion) => {
    if (fixedNote) {
      useNoteFieldsStore.getState().setDescriptionValue(fixedNote.id, entry.description || '');
      onEdit(fixedNote.id, fixedNote.content, fixedNote.category, entry.description);
      setFixedNoteShowVersionHistory(false);
    }
  }, [fixedNote, onEdit]);

  // PERFORMANCE: Stabilized callbacks for NoteListContent
  const handleSelectNoteById = useCallback((id: string) => {
    const n = notes.find(n => n.id === id);
    if (n) {
      // Hide description panel when switching to a different task (but keep sidebar visible if there's a fixed note)
      if (selectedNote?.id !== id && !fixedNoteId) {
        setShowSidebar(false);
        setSidebarClosing(false);
      }
      onSelectNote(n);
    }
  }, [notes, onSelectNote, selectedNote, fixedNoteId, setShowSidebar]);

  // Pin handler that saves state and shows toast
  const handleTogglePinnedWithToast = useCallback((id: string, pinned: boolean) => {
    onTogglePinned(id, pinned);
    toast.success(pinned ? t('notePinned') : t('noteUnpinned'));
  }, [onTogglePinned, t]);

  // Wrap assignee callbacks with optimistic store updates
  const handleEditorAddAssignee = useCallback((id: string, contactId: string) => {
    const contact = contacts.find(c => c.id === contactId);
    if (contact) useNoteFieldsStore.getState().setAssigneesValue(id, prev => [...prev, contact]);
    onAddAssignee(id, contactId);
  }, [onAddAssignee, contacts]);

  const handleEditorRemoveAssignee = useCallback((id: string, contactId: string) => {
    useNoteFieldsStore.getState().setAssigneesValue(id, prev => prev.filter(a => a.id !== contactId));
    onRemoveAssignee(id, contactId);
  }, [onRemoveAssignee]);

  const handleClearCategory = useCallback(() => {
    filters.setCategoryFilter('all');
  }, [filters]);

  const handleClearLabel = useCallback((labelId: string) => {
    filters.setLabelFilter(prev => prev.filter(id => id !== labelId));
  }, [filters]);

  const handleClearAssignee = useCallback((assigneeId: string) => {
    filters.setAssigneeFilter(prev => prev.filter(id => id !== assigneeId));
  }, [filters]);

  const handleClearSearch = useCallback(() => {
    filters.setSearchQuery('');
  }, [filters]);

  const handleClearSort = useCallback(() => {
    filters.setSortConfig({ deadline: null, assignee: null, category: null, createdAt: null });
    filters.setSortByDeadline(false);
    filters.setSortByAssignee(false);
    filters.setSortByCategory(false);
  }, [filters]);

  const handleClearTaskStatus = useCallback(() => {
    filters.setTaskStatusFilter('active');
  }, [filters]);

  const handleClearOverdue = useCallback(() => {
    filters.setShowOverdueOnly(false);
  }, [filters]);

  const handleClearPublic = useCallback(() => {
    filters.setShowPublicOnly(false);
  }, [filters]);

  const handleClearAllFilters = useCallback(() => {
    filters.setCategoryFilter('all');
    filters.setLabelFilter([]);
    filters.setAssigneeFilter([]);
    filters.setSearchQuery('');
    filters.setSortConfig({ deadline: null, assignee: null, category: null, createdAt: null });
    filters.setSortByDeadline(false);
    filters.setSortByAssignee(false);
    filters.setSortByCategory(false);
    filters.setTaskStatusFilter('active');
    filters.setShowOverdueOnly(false);
    filters.setShowPublicOnly(false);
  }, [filters]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Use mediator to navigate from search to task list
      navigationMediator.navigate({
        fromRegion: 'search',
        direction: 'down',
        column: 0,
      });
    } else if (e.key === 'Escape') {
      filters.setSearchQuery('');
      searchInputRef.current?.blur();
    }
  }, [filters, navigationMediator]);

  // Postpone Handlers
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
      reloadHistory();
      setNoteToPostpone(null);
      setPendingPostponeDate(null);
      setPostponeDialogOpen(false);
    }
  };

  // Deadline Handlers
  const handleDeadlineChange = (date: Date | undefined, isAllDay?: boolean) => {
    if (!selectedNote) return;
    const newDeadline = date ? date.toISOString() : null;
    useNoteFieldsStore.getState().setDeadlineValue(selectedNote.id, newDeadline);
    onUpdateDeadline(selectedNote.id, newDeadline, isAllDay);
  };
  const handleDeadlinePickerOpenChange = (open: boolean) => {
    if (open && selectedNote) originalDeadlineRef.current = selectedNote.deadline;
    setDeadlinePickerOpen(open);
  };
  const handleDeadlineSave = (date: Date) => {
    if (!selectedNote) return;
    handleOpenPostponeDialog(selectedNote.id, date);
    originalDeadlineRef.current = null;
  };

  const handleFixedNoteDeadlineChange = (date: Date | undefined, isAllDay?: boolean) => {
    if (!fixedNote) return;
    const newDeadline = date ? date.toISOString() : null;
    useNoteFieldsStore.getState().setDeadlineValue(fixedNote.id, newDeadline);
    onUpdateDeadline(fixedNote.id, newDeadline, isAllDay);
  };
  const handleFixedNoteDeadlinePickerOpenChange = (open: boolean) => {
    if (open && fixedNote) fixedNoteOriginalDeadlineRef.current = fixedNote.deadline;
    setFixedNoteDeadlinePickerOpen(open);
  };
  const handleFixedNoteDeadlineSave = (date: Date) => {
    if (fixedNote) handleOpenPostponeDialog(fixedNote.id, date);
    fixedNoteOriginalDeadlineRef.current = null;
  };

  // Drag and Drop
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragStart = (event: { active: { id: string | number } }) => setActiveId(String(event.active.id));
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

  // Hotkeys
  const hotkeyOptions = { preventDefault: true, enableOnFormTags: true, enableOnContentEditable: true };
  // CTRL+F: Only focus global search when NOT inside a contenteditable (allows browser native find in editor)
  useHotkeys('ctrl+f', () => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, {
    ...hotkeyOptions,
    enableOnContentEditable: false,
    enabled: () => {
      const activeElement = document.activeElement;
      return activeElement?.closest('[contenteditable="true"]') === null;
    },
  });
  useHotkeys('alt+q', () => { filters.setCategoryFilter(filters.categoryFilter === 'todo' ? 'all' : 'todo'); }, hotkeyOptions, [filters.categoryFilter]);
  useHotkeys('alt+w', () => { filters.setCategoryFilter(filters.categoryFilter === 'followup' ? 'all' : 'followup'); }, hotkeyOptions, [filters.categoryFilter]);
  useHotkeys('alt+e', () => { filters.setCategoryFilter(filters.categoryFilter === 'meeting' ? 'all' : 'meeting'); }, hotkeyOptions, [filters.categoryFilter]);
  useHotkeys('alt+r', () => { filters.setCategoryFilter(filters.categoryFilter === 'notes' ? 'all' : 'notes'); }, hotkeyOptions, [filters.categoryFilter]);
  useHotkeys('alt+c', () => {
    filters.setCategoryFilter('all'); filters.setLabelFilter([]); filters.setAssigneeFilter([]); filters.setSearchQuery('');
    filters.setSortConfig({ deadline: null, assignee: null, category: null, createdAt: null });
    filters.setSortByDeadline(false); filters.setSortByAssignee(false); filters.setSortByCategory(false);
    filters.setTaskStatusFilter('active'); filters.setShowOverdueOnly(false);
  }, hotkeyOptions);

  useHotkeys('down', (e) => {
    e.preventDefault();
    if (!selectedNote && filters.filteredNotes.length > 0) {
      onSelectNote(filters.filteredNotes[0]);
      selection.setFocusTarget('title');
    }
  }, { enableOnFormTags: true, enableOnContentEditable: false }, [selectedNote, filters.filteredNotes, onSelectNote]);
  useHotkeys('up', (e) => {
    e.preventDefault();
    if (!selectedNote && filters.filteredNotes.length > 0) {
      onSelectNote(filters.filteredNotes[filters.filteredNotes.length - 1]);
      selection.setFocusTarget('title');
    }
  }, { enableOnFormTags: true, enableOnContentEditable: false }, [selectedNote, filters.filteredNotes, onSelectNote]);
  useHotkeys('escape', () => {
    // Don't deselect if a dialog or command palette is open
    const dialogOpen = document.querySelector('[role="dialog"], [cmdk-root]');
    if (!dialogOpen) {
      onSelectNote(null);
    }
  }, { ...hotkeyOptions, enableOnFormTags: false }, [onSelectNote]);
  useHotkeys('tab', () => {
    if (selectedNote) {
      // Push current position to history before navigating away
      navigationMediator.pushFocusHistory({
        region: 'taskList',
        noteId: selectedNote.id,
        column: selectedNote.content.length,
      });
      // Always navigate to description - opens panel if closed, focuses if open
      selection.handleNavigateToDescription();
    }
  }, { ...hotkeyOptions, enableOnFormTags: ['INPUT'], enableOnContentEditable: true }, [selectedNote, navigationMediator]);
  useHotkeys('alt+t', () => { if (selectedNote) setDeadlinePickerOpen(true); }, { ...hotkeyOptions, enableOnContentEditable: true }, [selectedNote]);
  useHotkeys('alt+v', () => { filters.setViewMode(filters.viewMode === 'list' ? 'calendar' : 'list'); }, hotkeyOptions, [filters.viewMode]);
  useHotkeys('alt+f', () => { setCompactTaskView(!compactTaskView); }, hotkeyOptions, [compactTaskView]);
  useHotkeys('alt+p', () => { setAssigneeFilterPopoverOpen(true); }, hotkeyOptions);
  useHotkeys('alt+x', () => { if (selectedNote) handleTogglePinnedWithToast(selectedNote.id, !selectedNote.pinned); }, { ...hotkeyOptions, enableOnContentEditable: true }, [selectedNote, handleTogglePinnedWithToast]);
  useHotkeys('alt+b', () => { if (selectedNote) handleToggleFixInSidebarById(selectedNote.id); }, { ...hotkeyOptions, enableOnContentEditable: true }, [selectedNote, handleToggleFixInSidebarById]);
  useHotkeys('ctrl+backspace', () => { if (selectedNote) operations.handleDeleteWithToast(selectedNote, 'hotkey'); }, { ...hotkeyOptions, enableOnContentEditable: true }, [selectedNote, operations]);


  // Wrapper for onEdit passed to NoteEditorPanel (main editor panel)
  // When the title is edited from the editor panel, also update selection.titleValue
  // so the task list stays in sync and EditableTitle doesn't revert to the old value
  const handleEditorOnEdit = useCallback((id: string, content: string, category?: NoteCategory, description?: string | null) => {
    onEdit(id, content, category, description);
    const note = notesRef.current.find(n => n.id === id);
    if (note && content !== note.content) {
      selection.setTitleValue(content);
    }
  }, [onEdit, selection]);

  // Editor Handlers wrapper
  // Note: The actual save is now handled by the navigation mediator via event bus
  // NoteEditorPanel emits 'navigation:saveCurrentItem' on blur, which triggers the mediator's onSaveItem callback
  const handleDescriptionBlur = () => {
    console.log('[NoteList] handleDescriptionBlur - description lost focus');
    selection.setIsDescriptionFocused(false);
    // Flush any pending auto-save timer (mediator handles the actual save)
    selection.flushDescriptionAutoSave();
  };
  const handleDescriptionFocus = () => {
    console.log('[NoteList] handleDescriptionFocus - description gained focus');
    selection.setIsDescriptionFocused(true);
  };

  // Note: Save on Escape is handled by the mediator via NoteEditorPanel's keydown event
  // which emits 'navigation:saveCurrentItem' before calling this handler
  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'd' && e.ctrlKey && selectedNote) {
      e.preventDefault();
      // Save via mediator before toggling complete
      navigationMediator.saveCurrentItem('editor');
      operations.handleToggleCompletedWithNavigation(selectedNote.id, !selectedNote.completed);
    } else if (e.key === 'Escape' && selectedNote) {
      e.preventDefault();
      e.stopPropagation();
      // Note: Save already handled by NoteEditorPanel's keydown wrapper via event bus
      // Close description panel
      selection.setShowDescriptionPanel(false);
      // Return focus to the previous location using the mediator
      const returned = navigationMediator.returnToPrevious();
      if (!returned) {
        // Fallback: focus the current note's title
        selection.setDesiredColumn(selectedNote.content.length);
        selection.setFocusTarget('title');
      }
    }
  };

  // Note: The actual save is now handled by the navigation mediator via event bus
  // NoteEditorPanel emits 'navigation:saveCurrentItem' on blur, which triggers the mediator's onSaveItem callback
  const handleFixedNoteDescriptionBlur = () => {
    // No-op: save is handled by the mediator through NoteEditorPanel's blur event
  };

  // Note: Save on Escape is handled by the mediator via NoteEditorPanel's keydown event
  // which emits 'navigation:saveCurrentItem' before calling this handler
  const handleFixedNoteDescriptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'd' && e.ctrlKey && fixedNote) {
      e.preventDefault();
      // Save via mediator before toggling complete
      navigationMediator.saveCurrentItem('sidebar');
      operations.handleToggleCompletedWithNavigation(fixedNote.id, !fixedNote.completed);
    } else if (e.key === 'Escape') {
      // Note: Save already handled by NoteEditorPanel's keydown wrapper via event bus
      fixedNoteDescriptionRef.current?.blur();
    }
  };

  // Handle caret restoration
  const handleLabelDropdownOpenChange = (open: boolean) => {
    setLabelDropdownOpen(open);
    if (!open) selection.restoreDescriptionCaret();
  };
  const handleCategoryDropdownOpenChange = (open: boolean) => {
    setCategoryDropdownOpen(open);
    if (!open) selection.restoreDescriptionCaret();
  };
  const handleAssigneePickerOpenChange = (open: boolean) => {
    setAssigneePickerOpen(open);
    if (!open) selection.restoreDescriptionCaret();
  };


  // Imperative Handle
  useImperativeHandle(ref, () => ({
    focusFirstTaskTitle: (column?: number) => {
      if (filters.filteredNotes.length > 0) {
        onSelectNote(filters.filteredNotes[0]);
        selection.setDesiredColumn(column ?? 0);
        selection.setFocusTarget('title');
      }
    },
  }), [filters.filteredNotes, onSelectNote, selection]);


  return (
    <NavigationMediatorProvider mediator={navigationMediator}>
      <div ref={containerRef} className="flex flex-col h-full outline-none" tabIndex={-1}>
        <DebugNavigationOverlay
          selectedNoteId={selectedNote?.id ?? null}
          focusTarget={selection.focusTarget}
          desiredColumn={selection.desiredColumn}
          isDescriptionFocused={selection.isDescriptionFocused}
          showDescriptionPanel={selection.showDescriptionPanel}
        />
        <div className="flex gap-4 flex-1 min-h-0">
          <NoteListContent
            toolbar={
              <NoteListToolbar
                isMobile={isMobile}
                selectedNote={selectedNote}
                sidebarTrigger={sidebarTrigger}
                viewMode={filters.viewMode}
                setViewMode={filters.setViewMode}
                compactTaskView={compactTaskView}
                setCompactTaskView={setCompactTaskView}
                activeNotes={filters.viewMode === 'calendar' ? filters.calendarFilteredNotes : filters.activeNotes}
                noteLabelsCache={noteLabelsCache}
                searchQuery={filters.searchQuery}
                setSearchQuery={filters.setSearchQuery}
                searchInputRef={searchInputRef}
                categoryFilter={filters.categoryFilter}
                setCategoryFilter={filters.setCategoryFilter}
                labels={labels}
                labelFilter={filters.labelFilter}
                setLabelFilter={filters.setLabelFilter}
                sortConfig={filters.sortConfig}
                onSortConfigChange={onSortConfigChange ?? (() => { })}
                sortByDeadline={filters.sortByDeadline}
                setSortByDeadline={filters.setSortByDeadline}
                showOverdueOnly={filters.showOverdueOnly}
                setShowOverdueOnly={filters.setShowOverdueOnly}
                dateRangeFilter={filters.dateRangeFilter}
                setDateRangeFilter={filters.setDateRangeFilter}
                sortByAssignee={filters.sortByAssignee}
                setSortByAssignee={filters.setSortByAssignee}
                sortByCategory={filters.sortByCategory}
                setSortByCategory={filters.setSortByCategory}
                contacts={contacts}
                noteAssigneesCache={noteAssigneesCache}
                aiProvider={settings.aiProvider}
                assigneeFilter={filters.assigneeFilter}
                setAssigneeFilter={filters.setAssigneeFilter}
                assigneePopoverOpen={assigneeFilterPopoverOpen}
                setAssigneePopoverOpen={setAssigneeFilterPopoverOpen}
                taskStatusFilter={filters.taskStatusFilter}
                setTaskStatusFilter={filters.setTaskStatusFilter}
                hasCompletedTasks={filters.completedNotes.length > 0}
                onSearchKeyDown={handleSearchKeyDown}
              />
            }
            isMobile={isMobile}
            notes={notes}
            viewMode={filters.viewMode}
            selectedNote={selectedNote}
            categoryFilter={filters.categoryFilter}
            calendarSelectedDate={filters.calendarSelectedDate}
            setCalendarSelectedDate={filters.setCalendarSelectedDate}
            calendarFilteredNotes={filters.calendarFilteredNotes}
            calendarCompletedNotes={filters.calendarCompletedNotes}
            calendarDeletedNotes={filters.calendarDeletedNotes}
            activeNotes={filters.activeNotes}
            filteredNotes={filters.filteredNotes}
            completedNotes={filters.completedNotes}
            deletedNotes={deletedNotes}
            taskStatusFilter={filters.taskStatusFilter}
            shouldShowOnlyCompletedMessage={filters.notesMatchingFilters === 0 && filters.activeNotes.length === 0 && filters.completedNotes.length > 0}
            hasActiveFilters={filters.searchQuery.trim() !== '' || filters.categoryFilter !== 'all' || filters.labelFilter.length > 0 || filters.assigneeFilter.length > 0 || filters.showOverdueOnly || filters.showPublicOnly}
            shouldShowNoResultsWithPinnedVisible={filters.notesMatchingFilters === 0 && filters.activeNotes.length > 0}

            handleSelectNoteById={handleSelectNoteById}
            handleDeleteWithToast={operations.handleDeleteWithToast}
            handleToggleCompletedWithNavigation={operations.handleToggleCompletedWithNavigation}
            onTogglePinned={handleTogglePinnedWithToast}
            onEdit={onEdit}
            handleNavigateDownById={operations.handleNavigateDownById}
            handleNavigateUpById={operations.handleNavigateUpById}
            handleNavigateToDescription={selection.handleNavigateToDescription}
            focusTarget={selection.focusTarget}
            desiredColumn={selection.desiredColumn}
            handleTitleFocused={selection.handleTitleFocused}
            handleCreateNoteAfterById={operations.handleCreateNoteAfterById}
            handleCreateTaskAtTime={operations.handleCreateTaskAtTime}
            onCreateNoteAfter={onCreateNoteAfter}
            sensors={sensors}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            activeId={activeId}
            labels={labels}
            noteLabelsCache={noteLabelsCache}
            handleAddLabelToNote={handleAddLabelToNote}
            handleRemoveLabelFromNote={handleRemoveLabelFromNote}
            handleCreateLabelClick={handleCreateLabelClick}
            handleCreateLabelAndAdd={handleCreateLabelAndAdd}
            handleEditLabel={handleEditLabel}
            contacts={contacts}
            assigneeNamesCache={filters.assigneeNamesCache}
            noteAssigneesCache={noteAssigneesCache}
            onAddAssignee={onAddAssignee}
            onRemoveAssignee={onRemoveAssignee}
            onUpdateAssignee={onUpdateAssignee}
            fixedNoteId={fixedNoteId}
            handleToggleFixInSidebarById={handleToggleFixInSidebarById}
            compactTaskView={compactTaskView}
            isDescriptionFocused={selection.isDescriptionFocused}
            onRestore={onRestore}
            searchQuery={filters.searchQuery}
            labelFilter={filters.labelFilter}
            assigneeFilter={filters.assigneeFilter}
            showOverdueOnly={filters.showOverdueOnly}
            showPublicOnly={filters.showPublicOnly}
            sortConfig={filters.sortConfig}
            onClearCategory={handleClearCategory}
            onClearLabel={handleClearLabel}
            onClearAssignee={handleClearAssignee}
            onClearSearch={handleClearSearch}
            onClearSort={handleClearSort}
            onClearTaskStatus={handleClearTaskStatus}
            onClearOverdue={handleClearOverdue}
            onClearPublic={handleClearPublic}
            onClearAllFilters={handleClearAllFilters}
            autoSaveInterval={settings.autoSaveInterval}
            noteCreationDefaults={noteCreationDefaults}
          />

          <AnimatePresence>
            {selectedNote && selection.showDescriptionPanel && (
              <motion.div
                key="description-panel"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className={`${isMobile ? 'w-full' : 'w-[40%] -ml-4 pl-4 pr-4 -mt-4 pt-4 -mb-4 pb-4'} min-w-0 flex flex-col bg-background`}
              >
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectNote(null)}
                    className="mb-2 self-start -ml-2"
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    {t('back')}
                  </Button>
                )}
                <NoteEditorPanel
                  ref={selection.descriptionRef}
                  note={selectedNote}
                  allLabels={labels}
                  descriptionValue={selection.descriptionValue}
                  showPostponeHistory={showPostponeHistory}
                  showVersionHistory={showVersionHistory}
                  versions={versions}
                  actions={actions}
                  labelDropdownOpen={labelDropdownOpen}
                  categoryDropdownOpen={categoryDropdownOpen}
                  deadlinePickerOpen={deadlinePickerOpen}
                  assigneePickerOpen={assigneePickerOpen}
                  editingHistoryEntry={editingHistoryEntry}
                  contacts={contacts}
                  onEdit={handleEditorOnEdit}
                  onDescriptionChange={selection.setDescriptionValue}
                  onDescriptionBlur={handleDescriptionBlur}
                  onDescriptionFocus={handleDescriptionFocus}
                  onDescriptionKeyDown={handleDescriptionKeyDown}
                  onTogglePostponeHistory={() => setShowPostponeHistory(!showPostponeHistory)}
                  onToggleVersionHistory={() => setShowVersionHistory(!showVersionHistory)}
                  onRestoreVersion={handleRestoreVersion}
                  onAddLabel={handleAddLabel}
                  onRemoveLabel={handleRemoveLabel}
                  onEditLabel={handleEditLabel}
                  onCreateLabel={() => setShowCreateLabelDialog(true)}
                  onDeadlineChange={handleDeadlineChange}
                  onDeadlineSave={handleDeadlineSave}
                  onAddAssignee={handleEditorAddAssignee}
                  onRemoveAssignee={handleEditorRemoveAssignee}
                  onUpdateAssignee={onUpdateAssignee}
                  onDelete={() => setShowEditorDeleteDialog(true)}
                  onLabelDropdownOpenChange={handleLabelDropdownOpenChange}
                  onCategoryDropdownOpenChange={handleCategoryDropdownOpenChange}
                  onDeadlinePickerOpenChange={handleDeadlinePickerOpenChange}
                  onAssigneePickerOpenChange={handleAssigneePickerOpenChange}
                  onEditHistoryEntry={(entry) => setEditingHistoryEntry(entry)}
                  onUpdateHistoryReason={updateReason}
                  onDeleteHistoryEntry={(id) => setHistoryEntryToDelete(id)}
                  onSetEditingHistoryEntry={setEditingHistoryEntry}
                  onToggleComplete={(id) => operations.handleToggleCompletedWithNavigation(id, !selectedNote.completed)}
                  autoSaveInterval={settings.autoSaveInterval}
                  onTogglePublic={onTogglePublic}
                  aiProvider={settings.aiProvider}
                  onTogglePinned={onTogglePinned}
                  onToggleFixInSidebar={handleToggleFixInSidebarById}
                  isFixedInSidebar={fixedNoteId === selectedNote.id}
                  navigationRegion="editor"
                  commentThreads={selectedNoteComments.threads}
                  onAddComment={(content) => selectedNoteComments.addComment(content)}
                  onReplyToThread={(threadId, content) => selectedNoteComments.addComment(content, null, threadId)}
                  onEditComment={selectedNoteComments.updateComment}
                  onDeleteComment={selectedNoteComments.deleteComment}
                  onResolveThread={selectedNoteComments.resolveThread}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Fixed sidebar - animated with Motion */}
          {/* AnimatePresence with mode="wait": sidebar slides out, changes content, slides back in */}
          <AnimatePresence
            mode="wait"
            onExitComplete={() => {
              if (sidebarClosing) {
                setSidebarClosing(false);
                setShowSidebar(false);
                setClosingNote(null);
              }
            }}
          >
            {!isMobile && showSidebar && displayedNote && (
              <motion.div
                key={`fixed-sidebar-${displayedNote.id}`}
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{
                  duration: 0.25,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="ml-auto -my-4 -mr-4 w-[calc(33%+1rem)]"
              >
                <div className="w-full min-w-[400px] h-full flex flex-col rounded-l-xl border border-r-0 border-muted-foreground/20 bg-muted/30 overflow-y-auto p-4">
                  <NoteEditorPanel
                    ref={fixedNoteDescriptionRef}
                    note={displayedNote}
                    allLabels={labels}
                    descriptionValue={fixedNoteDescriptionStoreValue}
                    showPostponeHistory={fixedNoteShowPostponeHistory}
                    showVersionHistory={fixedNoteShowVersionHistory}
                    versions={fixedNoteVersions}
                    actions={fixedNoteActions}
                    labelDropdownOpen={fixedNoteLabelDropdownOpen}
                    categoryDropdownOpen={fixedNoteCategoryDropdownOpen}
                    deadlinePickerOpen={fixedNoteDeadlinePickerOpen}
                    assigneePickerOpen={fixedNoteAssigneePickerOpen}
                    editingHistoryEntry={editingFixedNoteHistoryEntry}
                    contacts={contacts}
                    onEdit={onEdit}
                    onDescriptionChange={handleFixedNoteDescriptionChange}
                    onDescriptionBlur={handleFixedNoteDescriptionBlur}
                    onDescriptionKeyDown={handleFixedNoteDescriptionKeyDown}
                    onTogglePostponeHistory={() => setFixedNoteShowPostponeHistory(!fixedNoteShowPostponeHistory)}
                    onToggleVersionHistory={() => setFixedNoteShowVersionHistory(!fixedNoteShowVersionHistory)}
                    onRestoreVersion={handleFixedNoteRestoreVersion}
                    onAddLabel={handleFixedNoteAddLabel}
                    onRemoveLabel={handleFixedNoteRemoveLabel}
                    onEditLabel={handleEditLabel}
                    onCreateLabel={() => setShowCreateLabelDialog(true)}
                    onDeadlineChange={handleFixedNoteDeadlineChange}
                    onDeadlineSave={handleFixedNoteDeadlineSave}
                    onAddAssignee={onAddAssignee}
                    onRemoveAssignee={onRemoveAssignee}
                    onUpdateAssignee={onUpdateAssignee}
                    onDelete={() => setShowFixedNoteDeleteDialog(true)}
                    onLabelDropdownOpenChange={setFixedNoteLabelDropdownOpen}
                    onCategoryDropdownOpenChange={setFixedNoteCategoryDropdownOpen}
                    onDeadlinePickerOpenChange={handleFixedNoteDeadlinePickerOpenChange}
                    onAssigneePickerOpenChange={setFixedNoteAssigneePickerOpen}
                    onEditHistoryEntry={(entry) => setEditingFixedNoteHistoryEntry(entry)}
                    onUpdateHistoryReason={updateFixedNoteReason}
                    onDeleteHistoryEntry={(id) => setFixedNoteHistoryEntryToDelete(id)}
                    onSetEditingHistoryEntry={setEditingFixedNoteHistoryEntry}
                    onToggleComplete={(id) => operations.handleToggleCompletedWithNavigation(id, !displayedNote?.completed)}
                    onClose={closeSidebar}
                    autoSaveInterval={settings.autoSaveInterval}
                    onTogglePublic={onTogglePublic}
                    aiProvider={settings.aiProvider}
                    onTogglePinned={onTogglePinned}
                    onToggleFixInSidebar={handleToggleFixInSidebarById}
                    isFixedInSidebar={true}
                    navigationRegion="sidebar"
                    commentThreads={fixedNoteComments.threads}
                    onAddComment={(content) => fixedNoteComments.addComment(content)}
                    onReplyToThread={(threadId, content) => fixedNoteComments.addComment(content, null, threadId)}
                    onEditComment={fixedNoteComments.updateComment}
                    onDeleteComment={fixedNoteComments.deleteComment}
                    onResolveThread={fixedNoteComments.resolveThread}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
                    deleteAction(historyEntryToDelete);
                    setHistoryEntryToDelete(null);
                  }
                }}
              >
                {t('delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                    deleteFixedNoteAction(fixedNoteHistoryEntryToDelete);
                    setFixedNoteHistoryEntryToDelete(null);
                  }
                }}
              >
                {t('delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Task Dialog for main editor panel */}
        {selectedNote && (
          <DeleteTaskDialog
            open={showEditorDeleteDialog}
            onOpenChange={setShowEditorDeleteDialog}
            onConfirm={(reason) => {
              operations.handleDeleteWithToast(selectedNote, reason);
              setShowEditorDeleteDialog(false);
            }}
            taskContent={selectedNote.content}
          />
        )}

        {/* Delete Task Dialog for fixed note editor */}
        {fixedNote && (
          <DeleteTaskDialog
            open={showFixedNoteDeleteDialog}
            onOpenChange={setShowFixedNoteDeleteDialog}
            onConfirm={(reason) => {
              operations.handleDeleteWithToast(fixedNote, reason);
              setShowFixedNoteDeleteDialog(false);
              setFixedNoteId(null);
              setShowSidebar(false);
            }}
            taskContent={fixedNote.content}
          />
        )}
      </div>
    </NavigationMediatorProvider>
  );
});
