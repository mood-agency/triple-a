import { useRef, useState, forwardRef, useImperativeHandle, useMemo, useEffect, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useTranslation } from 'react-i18next';
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
import type { Note, NoteCategory, Label } from '@/types/note';
import { useLabels } from '@/hooks/useLabels';
import { useNoteHistory } from '@/hooks/useNoteHistory';
import { useDeletedNotes } from '@/hooks/useDeletedNotes';
import { NoteEditorPanel } from './NoteEditorPanel';
import { PostponeDialog } from './PostponeDialog';
import { useNoteFilters } from './hooks/useNoteFilters';
import { useNoteSelection } from './hooks/useNoteSelection';
import { useNoteOperations } from './hooks/useNoteOperations';
import { NoteListToolbar } from './NoteListToolbar';
import { NoteListContent } from './NoteListContent';

// Re-export types if needed
export interface NoteListHandle {
  focusFirstTaskTitle: (column?: number) => void;
}

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

export const NoteList = forwardRef<NoteListHandle, NoteListProps>(function NoteList({ notes, onEdit, onDelete, onRestore, onToggleCompleted, onTogglePinned, onUpdateDeadline, onUpdateAssignee, onReorderNotes, onPostponeNote, selectedNote, onSelectNote, onNavigateToEditor, onCreateNoteAfter, onCreateTask, externalLabelFilter, externalCategoryFilter, externalAssigneeFilter, onLabelFilterChange, onCategoryFilterChange, onAssigneeFilterChange, externalViewMode, onViewModeChange, externalSelectedDate, onSelectedDateChange, sidebarTrigger }, ref) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettings();
  const { contacts } = useContacts();
  const { deletedNotes } = useDeletedNotes();
  const isMobile = useIsMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Labels logic
  const { labels: rawLabels, getLabelsForNote, addLabelToNote, removeLabelFromNote, createLabel, updateLabel, noteLabelVersion } = useLabels();
  const labelsKey = rawLabels.map(l => l.id).join(',');
  const labels = useMemo(() => rawLabels, [labelsKey]);
  const EMPTY_LABELS: Label[] = useMemo(() => [], []);

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
    for (const note of notesRef.current) {
      const noteLabels = getLabelsForNote(note.id);
      cache.set(note.id, noteLabels.length > 0 ? noteLabels : EMPTY_LABELS);
    }
    return cache;
  }, [noteIdsKey, getLabelsForNote, noteLabelVersion, EMPTY_LABELS]);

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
    noteLabelsCache,
  });

  const selection = useNoteSelection({
    selectedNote,
  });

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
    labelFilter: filters.labelFilter,
  });

  // --- UI State ---
  const showSidebar = settings.showSidebar;
  const setShowSidebar = (value: boolean) => updateSettings({ showSidebar: value });

  const compactTaskView = settings.compactTaskView;
  const setCompactTaskView = (value: boolean) => updateSettings({ compactTaskView: value });

  // Fixed Note State
  const fixedNoteId = settings.fixedNoteId;
  const setFixedNoteId = (value: string | null) => updateSettings({ fixedNoteId: value });
  const fixedNote = useMemo(() => {
    if (!fixedNoteId) return null;
    return notes.find(n => n.id === fixedNoteId) ?? null;
  }, [notes, fixedNoteId]);

  const handleToggleFixInSidebarById = useCallback((noteId: string) => {
    if (fixedNoteId === noteId) {
      setFixedNoteId(null);
      setShowSidebar(false);
    } else {
      setFixedNoteId(noteId);
      setShowSidebar(true);
    }
  }, [fixedNoteId, setFixedNoteId, setShowSidebar]);

  // History
  const noteForSidebar = fixedNote ?? selectedNote;
  const { history, deleteHistoryEntry, updateHistoryReason, reload: reloadHistory } = useNoteHistory(noteForSidebar?.id ?? null);
  const [historyEntryToDelete, setHistoryEntryToDelete] = useState<string | null>(null);
  const [editingHistoryEntry, setEditingHistoryEntry] = useState<{ id: string; reason: string } | null>(null);

  const { history: fixedNoteHistory, deleteHistoryEntry: deleteFixedNoteHistoryEntry, updateHistoryReason: updateFixedNoteHistoryReason } = useNoteHistory(fixedNote?.id ?? null);
  const [fixedNoteHistoryEntryToDelete, setFixedNoteHistoryEntryToDelete] = useState<string | null>(null);
  const [editingFixedNoteHistoryEntry, setEditingFixedNoteHistoryEntry] = useState<{ id: string; reason: string } | null>(null);

  // Dialogs & Local State
  const [noteLabels, setNoteLabels] = useState<Label[]>([]);
  const [fixedNoteLabels, setFixedNoteLabels] = useState<Label[]>([]);
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
  const [showPostponeHistory, setShowPostponeHistory] = useState(false);
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
  const [fixedNoteDescriptionValue, setFixedNoteDescriptionValue] = useState('');
  const [fixedNoteShowPostponeHistory, setFixedNoteShowPostponeHistory] = useState(false);
  const fixedNoteDescriptionRef = useRef<any>(null);

  // --- Effects & Handlers ---
  useEffect(() => {
    if (selectedNote) setNoteLabels(getLabelsForNote(selectedNote.id));
    else setNoteLabels([]);
  }, [selectedNote, getLabelsForNote]);

  useEffect(() => {
    if (fixedNote) setFixedNoteLabels(getLabelsForNote(fixedNote.id));
    else setFixedNoteLabels([]);
  }, [fixedNote, getLabelsForNote]);

  useEffect(() => {
    setShowPostponeHistory(false);
  }, [selectedNote]);

  useEffect(() => {
    setFixedNoteDescriptionValue(fixedNote?.description || '');
    setFixedNoteShowPostponeHistory(false);
  }, [fixedNote]);

  // Label Handlers
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
    if (selectedNote) setNoteLabels(getLabelsForNote(selectedNote.id));
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
  const handleDeadlineChange = (date: Date | undefined) => {
    if (!selectedNote) return;
    onUpdateDeadline(selectedNote.id, date ? date.toISOString() : null);
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

  const handleFixedNoteDeadlineChange = (date: Date | undefined) => {
    if (!fixedNote) return;
    onUpdateDeadline(fixedNote.id, date ? date.toISOString() : null);
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
  const hotkeyOptions = { preventDefault: true, enableOnFormTags: true };
  useHotkeys('ctrl+f', () => { searchInputRef.current?.focus(); searchInputRef.current?.select(); }, hotkeyOptions);
  useHotkeys('alt+q', () => { filters.setCategoryFilter(filters.categoryFilter === 'todo' ? 'all' : 'todo'); filters.setCategoryJustChanged(true); }, hotkeyOptions, [filters.categoryFilter]);
  useHotkeys('alt+w', () => { filters.setCategoryFilter(filters.categoryFilter === 'followup' ? 'all' : 'followup'); filters.setCategoryJustChanged(true); }, hotkeyOptions, [filters.categoryFilter]);
  useHotkeys('alt+e', () => { filters.setCategoryFilter(filters.categoryFilter === 'meeting' ? 'all' : 'meeting'); filters.setCategoryJustChanged(true); }, hotkeyOptions, [filters.categoryFilter]);
  useHotkeys('alt+r', () => { filters.setCategoryFilter(filters.categoryFilter === 'notes' ? 'all' : 'notes'); filters.setCategoryJustChanged(true); }, hotkeyOptions, [filters.categoryFilter]);
  useHotkeys('alt+c', () => {
    filters.setCategoryFilter('all'); filters.setLabelFilter([]); filters.setAssigneeFilter([]);
    filters.setSortByDeadline(false); filters.setSortByAssignee(false); filters.setSortByCategory(false); filters.setShowOverdueOnly(false);
    filters.setCategoryJustChanged(true);
  }, hotkeyOptions);

  useHotkeys('down', () => {
    if ((filters.categoryJustChanged || !selectedNote) && filters.filteredNotes.length > 0) {
      onSelectNote(filters.filteredNotes[0]);
      selection.setFocusTarget('title');
      filters.setCategoryJustChanged(false);
    }
  }, hotkeyOptions, [filters.categoryJustChanged, selectedNote, filters.filteredNotes, onSelectNote]);
  useHotkeys('up', () => {
    if ((filters.categoryJustChanged || !selectedNote) && filters.filteredNotes.length > 0) {
      onSelectNote(filters.filteredNotes[filters.filteredNotes.length - 1]);
      selection.setFocusTarget('title');
      filters.setCategoryJustChanged(false);
    }
  }, hotkeyOptions, [filters.categoryJustChanged, selectedNote, filters.filteredNotes, onSelectNote]);
  useHotkeys('escape', () => { onSelectNote(null); filters.setCategoryJustChanged(false); }, { ...hotkeyOptions, enableOnFormTags: false }, [onSelectNote]);
  useHotkeys('tab', () => {
    if (selectedNote) {
      if (!selection.showDescriptionPanel) {
        selection.handleNavigateToDescription();
      }
      // When panel is already shown, Tab does nothing (preventDefault still applies)
    }
  }, { ...hotkeyOptions, enableOnFormTags: ['INPUT'], enableOnContentEditable: true }, [selectedNote, selection.showDescriptionPanel]);
  useHotkeys('alt+t', () => { if (selectedNote) setDeadlinePickerOpen(true); }, { ...hotkeyOptions, enableOnContentEditable: true }, [selectedNote]);
  useHotkeys('alt+v', () => { filters.setViewMode(filters.viewMode === 'list' ? 'calendar' : 'list'); }, hotkeyOptions, [filters.viewMode]);
  useHotkeys('alt+f', () => { setCompactTaskView(!compactTaskView); }, hotkeyOptions, [compactTaskView]);
  useHotkeys('alt+p', () => { setAssigneeFilterPopoverOpen(true); }, hotkeyOptions);


  // Editor Handlers wrapper
  const handleDescriptionBlur = () => {
    selection.setIsDescriptionFocused(false);
    if (selectedNote && selection.descriptionValue !== (selectedNote.description || '')) {
      onEdit(selectedNote.id, selectedNote.content, selectedNote.category, selection.descriptionValue || null);
    }
  };
  const handleDescriptionFocus = () => selection.setIsDescriptionFocused(true);

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'd' && e.ctrlKey && selectedNote) {
      e.preventDefault();
      if (selection.descriptionValue !== (selectedNote.description || '')) {
        onEdit(selectedNote.id, selectedNote.content, selectedNote.category, selection.descriptionValue || null);
      }
      operations.handleToggleCompletedWithNavigation(selectedNote.id, !selectedNote.completed);
    } else if (e.key === 'Escape' && selectedNote) {
      e.preventDefault();
      e.stopPropagation();
      if (selection.descriptionValue !== (selectedNote.description || '')) {
        onEdit(selectedNote.id, selectedNote.content, selectedNote.category, selection.descriptionValue || null);
      }
      selection.setDesiredColumn(selectedNote.content.length);
      selection.setFocusTarget('title');
    } else if (e.key === 'Tab' && e.shiftKey && selectedNote) {
      e.preventDefault();
      if (selection.descriptionValue !== (selectedNote.description || '')) {
        onEdit(selectedNote.id, selectedNote.content, selectedNote.category, selection.descriptionValue || null);
      }
      selection.setDesiredColumn(selectedNote.content.length);
      selection.setFocusTarget('title');
    }

    if (e.key === 'ArrowDown' && selectedNote) {
      const selectionInfo = selection.descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        const { cursorPosition, text } = selectionInfo;
        const textAfterCursor = text.substring(cursorPosition);
        if (!textAfterCursor.includes('\n')) {
          e.preventDefault();
          const column = selection.getColumnPosition(text, cursorPosition);
          selection.setDesiredColumn(column);
          if (selection.descriptionValue !== (selectedNote.description || '')) {
            onEdit(selectedNote.id, selectedNote.content, selectedNote.category, selection.descriptionValue || null);
          }
          operations.handleNavigateDownById(selectedNote.id, column);
        }
      }
    }
    if (e.key === 'ArrowUp' && selectedNote) {
      const selectionInfo = selection.descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        const { cursorPosition, text } = selectionInfo;
        const textBeforeCursor = text.substring(0, cursorPosition);
        if (!textBeforeCursor.includes('\n')) {
          e.preventDefault();
          const column = selection.getColumnPosition(text, cursorPosition);
          selection.setDesiredColumn(column);
          if (selection.descriptionValue !== (selectedNote.description || '')) {
            onEdit(selectedNote.id, selectedNote.content, selectedNote.category, selection.descriptionValue || null);
          }
          // Try to navigate to the previous task; if already at the first task, focus the title
          const navigated = operations.handleNavigateUpById(selectedNote.id, column);
          if (!navigated) {
            selection.setFocusTarget('title');
          }
        }
      }
    }
  };

  const handleFixedNoteDescriptionBlur = () => {
    if (fixedNote && fixedNoteDescriptionValue !== (fixedNote.description || '')) {
      onEdit(fixedNote.id, fixedNote.content, fixedNote.category, fixedNoteDescriptionValue || null);
    }
  };

  const handleFixedNoteDescriptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'd' && e.ctrlKey && fixedNote) {
      e.preventDefault();
      if (fixedNoteDescriptionValue !== (fixedNote.description || '')) {
        onEdit(fixedNote.id, fixedNote.content, fixedNote.category, fixedNoteDescriptionValue || null);
      }
      operations.handleToggleCompletedWithNavigation(fixedNote.id, !fixedNote.completed);
    } else if (e.key === 'Escape') {
      if (fixedNote && fixedNoteDescriptionValue !== (fixedNote.description || '')) {
        onEdit(fixedNote.id, fixedNote.content, fixedNote.category, fixedNoteDescriptionValue || null);
      }
      fixedNoteDescriptionRef.current?.blur();
    } else if (e.key === 'Tab' && e.shiftKey && fixedNote) {
      e.preventDefault();
      if (fixedNoteDescriptionValue !== (fixedNote.description || '')) {
        onEdit(fixedNote.id, fixedNote.content, fixedNote.category, fixedNoteDescriptionValue || null);
      }
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
    <div ref={containerRef} className="flex flex-col h-full outline-none" tabIndex={-1}>
      <NoteListToolbar
        isMobile={isMobile}
        selectedNote={selectedNote}
        sidebarTrigger={sidebarTrigger}
        onCreateTask={onCreateTask}
        viewMode={filters.viewMode}
        setViewMode={filters.setViewMode}
        compactTaskView={compactTaskView}
        setCompactTaskView={setCompactTaskView}
        searchQuery={filters.searchQuery}
        setSearchQuery={filters.setSearchQuery}
        searchInputRef={searchInputRef}
        categoryFilter={filters.categoryFilter}
        setCategoryFilter={filters.setCategoryFilter}
        labels={labels}
        labelFilter={filters.labelFilter}
        setLabelFilter={filters.setLabelFilter}
        sortConfig={filters.sortConfig}
        setSortConfig={filters.setSortConfig}
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
        assigneeFilter={filters.assigneeFilter}
        setAssigneeFilter={filters.setAssigneeFilter}
        assigneePopoverOpen={assigneeFilterPopoverOpen}
        setAssigneePopoverOpen={setAssigneeFilterPopoverOpen}
        taskStatusFilter={filters.taskStatusFilter}
        setTaskStatusFilter={filters.setTaskStatusFilter}
        hasCompletedTasks={filters.completedNotes.length > 0}
        hasDeletedTasks={deletedNotes.length > 0}
        fixedNoteId={fixedNoteId}
        showSidebar={showSidebar}
        setShowSidebar={setShowSidebar}
        setFixedNoteId={setFixedNoteId}
        onSearchKeyDown={(e) => {
          if (e.key === 'ArrowDown' && filters.filteredNotes.length > 0) {
            e.preventDefault();
            onSelectNote(filters.filteredNotes[0]);
            selection.setDesiredColumn(0);
            selection.setFocusTarget('title');
          } else if (e.key === 'Escape') {
            filters.setSearchQuery('');
            searchInputRef.current?.blur();
          }
        }}
      />

      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        <NoteListContent
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
          hasActiveFilters={filters.searchQuery.trim() !== '' || filters.categoryFilter !== 'all' || filters.labelFilter.length > 0 || filters.assigneeFilter.length > 0 || filters.showOverdueOnly}
          shouldShowNoResultsWithPinnedVisible={filters.notesMatchingFilters === 0 && filters.activeNotes.length > 0}

          handleSelectNoteById={(id) => { const n = notes.find(n => n.id === id); if (n) onSelectNote(n); }}
          handleDeleteWithToast={operations.handleDeleteWithToast}
          handleToggleCompletedWithNavigation={operations.handleToggleCompletedWithNavigation}
          onTogglePinned={onTogglePinned}
          onEdit={onEdit}
          handleNavigateDownById={operations.handleNavigateDownById}
          handleNavigateUpById={operations.handleNavigateUpById}
          handleNavigateToDescription={selection.handleNavigateToDescription}
          focusTarget={selection.focusTarget}
          desiredColumn={selection.desiredColumn}
          handleTitleFocused={selection.handleTitleFocused}
          handleCreateNoteAfterById={operations.handleCreateNoteAfterById}
          handleCreateTaskAtTime={operations.handleCreateTaskAtTime}
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
          onUpdateAssignee={onUpdateAssignee}
          fixedNoteId={fixedNoteId}
          handleToggleFixInSidebarById={handleToggleFixInSidebarById}
          handleContentChange={(c) => selection.setTitleValue(c)}
          compactTaskView={compactTaskView}
          isDescriptionFocused={selection.isDescriptionFocused}
          onRestore={onRestore}
          searchQuery={filters.searchQuery}
          labelFilter={filters.labelFilter}
          assigneeFilter={filters.assigneeFilter}
          showOverdueOnly={filters.showOverdueOnly}
          renderNoResultsContent={() => null}
        />

        {selectedNote && selection.showDescriptionPanel && (
          <div className={`${isMobile ? 'w-full' : 'flex-1'} min-w-0 ${isMobile ? '' : 'border-l border-muted-foreground/20 pl-4'} overflow-hidden flex flex-col`}>
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
              noteLabels={noteLabels}
              allLabels={labels}
              descriptionValue={selection.descriptionValue}
              titleValue={selection.titleValue}
              showPostponeHistory={showPostponeHistory}
              history={history}
              labelDropdownOpen={labelDropdownOpen}
              categoryDropdownOpen={categoryDropdownOpen}
              deadlinePickerOpen={deadlinePickerOpen}
              assigneePickerOpen={assigneePickerOpen}
              editingHistoryEntry={editingHistoryEntry}
              contacts={contacts}
              onEdit={onEdit}
              onDescriptionChange={selection.setDescriptionValue}
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
              onDelete={() => operations.handleDeleteWithToast(selectedNote)}
              onLabelDropdownOpenChange={handleLabelDropdownOpenChange}
              onCategoryDropdownOpenChange={handleCategoryDropdownOpenChange}
              onDeadlinePickerOpenChange={handleDeadlinePickerOpenChange}
              onAssigneePickerOpenChange={handleAssigneePickerOpenChange}
              onEditHistoryEntry={(entry) => setEditingHistoryEntry(entry)}
              onUpdateHistoryReason={updateHistoryReason}
              onDeleteHistoryEntry={(id) => setHistoryEntryToDelete(id)}
              onSetEditingHistoryEntry={setEditingHistoryEntry}
              onToggleComplete={(id) => operations.handleToggleCompletedWithNavigation(id, !selectedNote.completed)}
            />
          </div>
        )}

        {/* Fixed sidebar */}
        {showSidebar && !isMobile && (
          <div className="flex-1 min-w-0 border-l border-muted-foreground/20 pl-4 overflow-hidden flex flex-col">
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
                onDelete={() => operations.handleDeleteWithToast(fixedNote)}
                onLabelDropdownOpenChange={setFixedNoteLabelDropdownOpen}
                onCategoryDropdownOpenChange={setFixedNoteCategoryDropdownOpen}
                onDeadlinePickerOpenChange={handleFixedNoteDeadlinePickerOpenChange}
                onAssigneePickerOpenChange={setFixedNoteAssigneePickerOpen}
                onEditHistoryEntry={(entry) => setEditingFixedNoteHistoryEntry(entry)}
                onUpdateHistoryReason={updateFixedNoteHistoryReason}
                onDeleteHistoryEntry={(id) => setFixedNoteHistoryEntryToDelete(id)}
                onSetEditingHistoryEntry={setEditingFixedNoteHistoryEntry}
                onToggleComplete={(id) => operations.handleToggleCompletedWithNavigation(id, !fixedNote.completed)}
              />
            ) : (
              <p className="text-sm text-muted-foreground/50 italic">{t('selectNoteToEdit')}</p>
            )}
          </div>
        )}
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
