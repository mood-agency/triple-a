import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { Loader2 } from 'lucide-react';
import { NotesWorkspace, type NotesWorkspaceHandle } from '@/components/notes/NotesWorkspace';
import { CommandPalette } from '@/components/CommandPalette';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { HotkeysHelper } from '@/components/HotkeysHelper';
import { useNotes } from '@/hooks/useNotes';
import { useLabels } from '@/hooks/useLabels';
import { useSettings } from '@/hooks/useSettings';
import { useContacts } from '@/hooks/useContacts';
import { useAssignees } from '@/hooks/useAssignees';
import { useSidebar } from '@/components/ui/sidebar';
import { useActiveProject } from '@/contexts/ProjectContext';
import { useFilterCommands } from '@/components/notes/hooks/useFilterCommands';
import { FilterCommandsProvider } from '@/components/notes/FilterCommandsContext';
import type { Note, NoteCategory } from '@/types/note';
import { parseLocalDate, formatLocalDate } from '@/utils/dateUtils';

interface OutletContext {
  sidebarTrigger: React.ReactNode;
}

export function Home() {
  useTranslation();
  const { sidebarTrigger } = useOutletContext<OutletContext>();
  const { toggleSidebar } = useSidebar();
  const { projects, activeProjectId, setActiveProjectId, createProject } = useActiveProject();

  // Alt+S to toggle left sidebar
  useHotkeys('alt+s', () => { toggleSidebar(); }, { preventDefault: true, enableOnFormTags: true, enableOnContentEditable: true });
  const [searchParams, setSearchParams] = useSearchParams();
  // Optimized: Store only the ID to avoid unnecessary re-renders when note object changes
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => searchParams.get('note'));
  const noteListRef = useRef<NotesWorkspaceHandle>(null);
  const { labels } = useLabels();
  const { contacts } = useContacts();
  const { addAssigneeToNote, removeAssigneeFromNote } = useAssignees();
  const { settings, updateSettings } = useSettings();

  // View mode from URL (fallback to settings)
  const getInitialViewMode = useCallback((): 'list' | 'calendar' => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'list' || viewParam === 'calendar') {
      return viewParam;
    }
    return settings.viewMode;
  }, [searchParams, settings.viewMode]);

  const [viewMode, setViewModeState] = useState<'list' | 'calendar'>(getInitialViewMode);

  // Selected date from URL (for calendar view)
  const getInitialSelectedDate = useCallback((): Date => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsed = parseLocalDate(dateParam);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  }, [searchParams]);

  const [selectedDate, setSelectedDateState] = useState<Date>(getInitialSelectedDate);

  // Initialize filters from URL params
  const getInitialLabelFilter = useCallback(() => {
    const labelsParam = searchParams.get('labels');
    return labelsParam ? labelsParam.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const getInitialCategoryFilter = useCallback((): NoteCategory | 'all' => {
    const categoryParam = searchParams.get('category');
    if (categoryParam === 'todo' || categoryParam === 'followup' || categoryParam === 'notes' || categoryParam === 'meeting') {
      return categoryParam;
    }
    return 'all';
  }, [searchParams]);

  const getInitialAssigneeFilter = useCallback(() => {
    const assigneesParam = searchParams.get('assignees');
    return assigneesParam ? assigneesParam.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const getInitialTaskStatusFilter = useCallback((): 'active' | 'completed' | 'deleted' => {
    const statusParam = searchParams.get('status');
    if (statusParam === 'active' || statusParam === 'completed' || statusParam === 'deleted') {
      return statusParam;
    }
    return 'active';
  }, [searchParams]);

  const getInitialSortConfig = useCallback(() => {
    const deadline = searchParams.get('sortDeadline') as 'asc' | 'desc' | null;
    const assignee = searchParams.get('sortAssignee') as 'asc' | 'desc' | null;
    const category = searchParams.get('sortCategory') as 'asc' | 'desc' | null;
    const createdAt = searchParams.get('sortCreatedAt') as 'asc' | 'desc' | null;

    // Only one sort can be active at a time - prioritize deadline > assignee > category > createdAt
    const validDeadline = deadline === 'asc' || deadline === 'desc' ? deadline : null;
    const validAssignee = assignee === 'asc' || assignee === 'desc' ? assignee : null;
    const validCategory = category === 'asc' || category === 'desc' ? category : null;
    const validCreatedAt = createdAt === 'asc' || createdAt === 'desc' ? createdAt : null;

    if (validDeadline) {
      return { deadline: validDeadline, assignee: null, category: null, createdAt: null };
    }
    if (validAssignee) {
      return { deadline: null, assignee: validAssignee, category: null, createdAt: null };
    }
    if (validCategory) {
      return { deadline: null, assignee: null, category: validCategory, createdAt: null };
    }
    if (validCreatedAt) {
      return { deadline: null, assignee: null, category: null, createdAt: validCreatedAt };
    }
    return { deadline: null, assignee: null, category: null, createdAt: null };
  }, [searchParams]);

  const [labelFilter, setLabelFilter] = useState<string[]>(getInitialLabelFilter);
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | 'all'>(getInitialCategoryFilter);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>(getInitialAssigneeFilter);
  const [taskStatusFilter, setTaskStatusFilter] = useState<'active' | 'completed' | 'deleted'>(getInitialTaskStatusFilter);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [showPublicOnly, setShowPublicOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null; createdAt: 'asc' | 'desc' | null }>(getInitialSortConfig);
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);

  // Keep a ref of the current state values to avoid stale closures in syncStateToURL
  // when multiple rapid updates occur (e.g. category filter change -> auto-note selection).
  // We include activeProjectId to ensure project switching doesn't conflict.
  const stateRef = useRef({
    viewMode,
    selectedDate,
    selectedNoteId,
    categoryFilter,
    labelFilter,
    assigneeFilter,
    sortConfig,
    activeProjectId,
    taskStatusFilter
  });

  // Keep ref in sync with latest state for next renders
  useEffect(() => {
    stateRef.current = {
      viewMode,
      selectedDate,
      selectedNoteId,
      categoryFilter,
      labelFilter,
      assigneeFilter,
      sortConfig,
      activeProjectId,
      taskStatusFilter
    };
  }, [viewMode, selectedDate, selectedNoteId, categoryFilter, labelFilter, assigneeFilter, sortConfig, activeProjectId, taskStatusFilter]);

  // Canonical function to update URL from current state
  const syncStateToURL = useCallback((overrides: Record<string, any> = {}) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      // Use the ref for latest values if not overridden
      const s = { ...stateRef.current, ...overrides };

      // 1. View Mode
      newParams.set('view', s.viewMode);

      // 2. Selected Date (Calendar only)
      if (s.viewMode === 'calendar') {
        const dateStr = formatLocalDate(s.selectedDate);
        const today = formatLocalDate(new Date());
        if (dateStr !== today) newParams.set('date', dateStr);
        else newParams.delete('date');
      } else {
        newParams.delete('date');
      }

      // 3. Selected Note
      const noteId = 'noteId' in overrides ? overrides.noteId : s.selectedNoteId;
      if (noteId) newParams.set('note', noteId);
      else newParams.delete('note');

      // 4. Category Filter
      if (s.categoryFilter !== 'all') newParams.set('category', s.categoryFilter);
      else newParams.delete('category');

      // 5. Label Filter
      if (s.labelFilter && s.labelFilter.length > 0) newParams.set('labels', s.labelFilter.join(','));
      else newParams.delete('labels');

      // 6. Assignee Filter
      if (s.assigneeFilter && s.assigneeFilter.length > 0) newParams.set('assignees', s.assigneeFilter.join(','));
      else newParams.delete('assignees');

      // 7. Sort Configuration
      const sort = overrides.sort || s.sortConfig;
      if (sort.deadline) newParams.set('sortDeadline', sort.deadline);
      else newParams.delete('sortDeadline');

      if (sort.assignee) newParams.set('sortAssignee', sort.assignee);
      else newParams.delete('sortAssignee');

      if (sort.category) newParams.set('sortCategory', sort.category);
      else newParams.delete('sortCategory');

      if (sort.createdAt) newParams.set('sortCreatedAt', sort.createdAt);
      else newParams.delete('sortCreatedAt');

      // 8. Task Status Filter
      if (s.taskStatusFilter && s.taskStatusFilter !== 'active') newParams.set('status', s.taskStatusFilter);
      else newParams.delete('status');

      // 9. Project (Preserve from context if not in URL, but ProjectContext usually handles this)
      if (s.activeProjectId && !newParams.has('project')) {
        newParams.set('project', s.activeProjectId);
      }

      // Only update if something changed to avoid unnecessary re-renders
      if (newParams.toString() === prev.toString()) return prev;
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Update URL when selected date changes (only in calendar view)
  const setSelectedDate = useCallback((newDate: Date | undefined) => {
    const dateToSet = newDate ?? new Date();
    setSelectedDateState(dateToSet);
    stateRef.current.selectedDate = dateToSet;
    syncStateToURL({ date: dateToSet });
  }, [syncStateToURL]);

  // Update URL when view mode changes
  const setViewMode = useCallback((newViewMode: 'list' | 'calendar') => {
    setViewModeState(newViewMode);
    updateSettings({ viewMode: newViewMode });

    // Reset category filter if switching to calendar view with 'notes' filter active
    const newCategory = (newViewMode === 'calendar' && categoryFilter === 'notes') ? 'all' : categoryFilter;
    if (newCategory !== categoryFilter) {
      setCategoryFilter(newCategory);
      stateRef.current.categoryFilter = newCategory;
    }

    stateRef.current.viewMode = newViewMode;
    syncStateToURL({ viewMode: newViewMode, category: newCategory });
  }, [updateSettings, categoryFilter, syncStateToURL]);

  const toggleViewMode = useCallback(() => {
    setViewMode(viewMode === 'list' ? 'calendar' : 'list');
  }, [viewMode, setViewMode]);

  // Load ALL notes without date filtering (filtered by active project)
  // Uses calendar sync enabled hook to auto-sync meetings to Google Calendar
  const { notes, loading, createNote, createNoteAfter, updateNote, updateDeadline, toggleCompleted, togglePinned, deleteNote, restoreNote, reorderNotes, postponeNote, togglePublic } = useNotes();

  // Derive the full note object from the ID (memoized)
  // This prevents re-renders when the note object reference changes but ID stays the same
  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    return notes.find(n => n.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  // Track URL note param and loading state to avoid re-syncing on unrelated changes.
  // Without these guards, a `notes` content update (e.g. processNoteBlock saving typed text)
  // would re-trigger this effect with a stale URL and revert selectedNoteId.
  const lastUrlNoteParamRef = useRef<string | null | undefined>(undefined);
  const wasLoadingRef = useRef(true);

  // Sync selected note ID from URL param when URL changes or loading completes
  useEffect(() => {
    const noteId = searchParams.get('note') ?? null;
    const urlNoteChanged = noteId !== lastUrlNoteParamRef.current;
    const loadingJustFinished = wasLoadingRef.current && !loading;

    lastUrlNoteParamRef.current = noteId;
    wasLoadingRef.current = loading;

    // Only react when the URL note param actually changed or loading just completed.
    // This prevents notes-content updates from triggering a stale-URL sync that
    // would revert selectedNoteId (root cause of the double-Tab bug).
    if (!urlNoteChanged && !loadingJustFinished) return;

    // If URL has no note param, clear selection
    if (!noteId) {
      if (selectedNoteId !== null) {
        setSelectedNoteId(null);
      }
      return;
    }

    // If we're still loading notes, wait for them to load
    if (loading) {
      // But ensure selectedNoteId is set from URL so it's ready when notes load
      if (selectedNoteId !== noteId) {
        setSelectedNoteId(noteId);
      }
      return;
    }

    // URL has a note param and notes have loaded - try to find and select it
    const note = notes.find(n => n.id === noteId);
    if (note) {
      // Note exists - make sure it's selected
      if (selectedNoteId !== noteId) {
        setSelectedNoteId(noteId);
      }
    } else if (notes.length > 0) {
      // Notes have loaded but note not found
      // Keep the selectedNoteId to show note not found state
      if (selectedNoteId !== noteId) {
        setSelectedNoteId(noteId);
      }
      console.warn(`Note ${noteId} from URL not found in project ${activeProjectId}`);
    }
  }, [loading, notes, searchParams, selectedNoteId, activeProjectId]);

  // Update URL when selected note changes
  const handleSelectNote = useCallback((note: Note | null) => {
    const noteId = note?.id ?? null;

    // Skip if already selected (prevents duplicate calls)
    if (stateRef.current.selectedNoteId === noteId) {
      return;
    }

    console.log('[Home] handleSelectNote:', noteId);
    setSelectedNoteId(noteId);
    stateRef.current.selectedNoteId = noteId;
    syncStateToURL({ noteId });
  }, [syncStateToURL]);

  // Update URL when label filter changes
  const handleLabelFilterChange = useCallback((newLabels: string[]) => {
    setLabelFilter(newLabels);
    stateRef.current.labelFilter = newLabels;
    syncStateToURL({ labels: newLabels });
  }, [syncStateToURL]);

  // Debug: Log URL changes
  useEffect(() => {
    console.log('[URL Debug] searchParams changed:', {
      category: searchParams.get('category'),
      project: searchParams.get('project'),
      note: searchParams.get('note'),
      view: searchParams.get('view'),
      fullURL: searchParams.toString(),
    });
  }, [searchParams]);

  // Update URL when category filter changes
  const handleCategoryFilterChange = useCallback((newCategory: NoteCategory | 'all') => {
    console.log('[Home] handleCategoryFilterChange:', newCategory);
    setCategoryFilter(newCategory);
    stateRef.current.categoryFilter = newCategory;
    syncStateToURL({ category: newCategory });
  }, [syncStateToURL]);

  // Update URL when assignee filter changes
  const handleAssigneeFilterChange = useCallback((newAssignees: string[]) => {
    setAssigneeFilter(newAssignees);
    stateRef.current.assigneeFilter = newAssignees;
    syncStateToURL({ assignees: newAssignees });
  }, [syncStateToURL]);

  // Update URL when task status filter changes
  const handleTaskStatusFilterChange = useCallback((newStatus: 'active' | 'completed' | 'deleted') => {
    setTaskStatusFilter(newStatus);
    stateRef.current.taskStatusFilter = newStatus;
    syncStateToURL({ taskStatusFilter: newStatus });
  }, [syncStateToURL]);

  // Update URL when sort config changes
  const handleSortConfigChange = useCallback((newSortConfig: { deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null; createdAt: 'asc' | 'desc' | null }) => {
    setSortConfig(newSortConfig);
    stateRef.current.sortConfig = newSortConfig;
    syncStateToURL({ sort: newSortConfig });
  }, [syncStateToURL]);

  const handleCreateTask = useCallback(() => {
    // Use category filter if set, otherwise default to 'todo'
    const category = categoryFilter !== 'all' ? categoryFilter : 'todo';
    // Pass label filter so new task is visible with current filters
    const result = createNote('', category, null, labelFilter);
    // Handle both Promise and synchronous returns
    Promise.resolve(result).then((newNoteOrId) => {
      if (newNoteOrId) {
        // If it's a string (ID), create minimal Note object; otherwise use as-is (Note)
        const newNote: Note = typeof newNoteOrId === 'string'
          ? { id: newNoteOrId } as unknown as Note
          : newNoteOrId;
        handleSelectNote(newNote);
      }
    });
  }, [createNote, categoryFilter, labelFilter, handleSelectNote]);

  const handleDeleteNote = useCallback((id: string, reason: string) => {
    if (selectedNoteId === id) {
      handleSelectNote(null);
    }
    deleteNote(id, reason);
  }, [selectedNoteId, handleSelectNote, deleteNote]);

  const handleUpdateNote = useCallback(async (id: string, content: string, category?: import('@/types/note').NoteCategory, description?: string | null) => {
    await updateNote(id, content, category, description);
    // Note: selectedNote will automatically update via useMemo when notes array changes
  }, [updateNote]);

  const handlePostponeNote = useCallback(async (id: string, newDeadline: string, reason: string) => {
    await postponeNote(id, newDeadline, reason);
    // Note: selectedNote will automatically update via useMemo when notes array changes
  }, [postponeNote]);

  // Placeholder for dateRangeFilter and searchQuery (these are managed in useNoteFilters)
  const [dateRangeFilter, setDateRangeFilter] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [searchQuery, setSearchQuery] = useState('');

  // Filter Commands hook for undo/redo support
  const filterCommands = useFilterCommands({
    categoryFilter,
    labelFilter,
    assigneeFilter,
    searchQuery,
    sortConfig,
    dateRangeFilter,
    taskStatusFilter,
    showOverdueOnly,
    showPublicOnly,
    setCategoryFilter: handleCategoryFilterChange,
    setLabelFilter: handleLabelFilterChange as any,
    setAssigneeFilter: handleAssigneeFilterChange as any,
    setSearchQuery,
    setSortConfig: handleSortConfigChange as any,
    setDateRangeFilter,
    setTaskStatusFilter: handleTaskStatusFilterChange,
    setShowOverdueOnly,
    setShowPublicOnly,
    labels,
    contacts,
  });

  // Show loading spinner only when loading and no notes yet
  // This prevents React hooks count mismatch when project changes
  if (loading && !notes.length) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <FilterCommandsProvider
      value={{
        canUndo: filterCommands.canUndo,
        canRedo: filterCommands.canRedo,
        lastCommand: filterCommands.lastCommand,
        undo: filterCommands.undo,
        redo: filterCommands.redo,
        commands: filterCommands.commands,
      }}
    >
      <NotesWorkspace
        ref={noteListRef}
        notes={notes}
        onEdit={handleUpdateNote}
        onDelete={handleDeleteNote}
        onRestore={restoreNote}
        onToggleCompleted={toggleCompleted}
        onTogglePinned={togglePinned}
        onUpdateDeadline={updateDeadline}
        onAddAssignee={addAssigneeToNote}
        onRemoveAssignee={removeAssigneeFromNote}
        onReorderNotes={reorderNotes}
        onPostponeNote={handlePostponeNote}
        onTogglePublic={togglePublic}
        selectedNote={selectedNote}
        onSelectNote={handleSelectNote}
        onCreateNoteAfter={createNoteAfter}
        onCreateTask={handleCreateTask}
        externalLabelFilter={labelFilter}
        externalCategoryFilter={categoryFilter}
        externalAssigneeFilter={assigneeFilter}
        onLabelFilterChange={handleLabelFilterChange}
        onCategoryFilterChange={handleCategoryFilterChange}
        onAssigneeFilterChange={handleAssigneeFilterChange}
        externalViewMode={viewMode}
        onViewModeChange={setViewMode}
        externalSelectedDate={selectedDate}
        onSelectedDateChange={setSelectedDate}
        externalTaskStatusFilter={taskStatusFilter}
        onTaskStatusFilterChange={handleTaskStatusFilterChange}
        externalShowOverdueOnly={showOverdueOnly}
        onShowOverdueOnlyChange={setShowOverdueOnly}
        externalShowPublicOnly={showPublicOnly}
        onShowPublicOnlyChange={setShowPublicOnly}
        externalSortConfig={sortConfig}
        onSortConfigChange={handleSortConfigChange}
        sidebarTrigger={sidebarTrigger}
      />

      <CommandPalette
        labels={labels}
        selectedLabels={labelFilter}
        onSelectLabel={(labelId) => {
          handleLabelFilterChange(
            labelFilter.includes(labelId)
              ? labelFilter.filter((id) => id !== labelId)
              : [...labelFilter, labelId]
          );
        }}
        onClearLabels={() => handleLabelFilterChange([])}
        categoryFilter={categoryFilter}
        onSelectCategory={handleCategoryFilterChange}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onRequestCreateProject={() => setShowCreateProjectDialog(true)}
        contacts={contacts}
        selectedAssignees={assigneeFilter}
        onSelectAssignee={(assigneeId) => {
          handleAssigneeFilterChange(
            assigneeFilter.includes(assigneeId)
              ? assigneeFilter.filter((id) => id !== assigneeId)
              : [...assigneeFilter, assigneeId]
          );
        }}
        onClearAssignees={() => handleAssigneeFilterChange([])}
        taskStatusFilter={taskStatusFilter}
        onTaskStatusFilterChange={handleTaskStatusFilterChange}
        showOverdueOnly={showOverdueOnly}
        onShowOverdueOnlyChange={setShowOverdueOnly}
        showPublicOnly={showPublicOnly}
        onShowPublicOnlyChange={setShowPublicOnly}
        hasCompletedTasks={notes.some(n => n.completed)}
        sortConfig={sortConfig}
        onSortChange={handleSortConfigChange}
      />

      <HotkeysHelper />

      <CreateProjectDialog
        open={showCreateProjectDialog}
        onOpenChange={setShowCreateProjectDialog}
        onCreateProject={async (data) => {
          await createProject(data, true);
        }}
      />
    </FilterCommandsProvider>
  );
}
