import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { Loader2 } from 'lucide-react';
import { NoteList, type NoteListHandle } from '@/components/notes/NoteList';
import { CommandPalette } from '@/components/CommandPalette';
import { CreateProjectDialog } from '@/components/projects/CreateProjectDialog';
import { HotkeysHelper } from '@/components/HotkeysHelper';
import { useNotesWithCalendarSync } from '@/hooks/useNotesWithCalendarSync';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import { useLabels } from '@/hooks/useLabels';
import { useSettings } from '@/hooks/useSettings';
import { useContacts } from '@/hooks/useContacts';
import { useSidebar } from '@/components/ui/sidebar';
import { useActiveProject } from '@/contexts/ProjectContext';
import type { Note, NoteCategory } from '@/types/note';
import { parseLocalDate, formatLocalDate } from '@/utils/dateUtils';

interface OutletContext {
  sidebarTrigger: React.ReactNode;
}

export function Home() {
  useTranslation();
  const { sidebarTrigger } = useOutletContext<OutletContext>();
  const { isReady } = useTinyBase();
  const { toggleSidebar } = useSidebar();
  const { projects, activeProjectId, setActiveProjectId, createProject } = useActiveProject();

  // Alt+S to toggle left sidebar
  useHotkeys('alt+s', () => { toggleSidebar(); }, { preventDefault: true, enableOnFormTags: true, enableOnContentEditable: true });
  const [searchParams, setSearchParams] = useSearchParams();
  // Optimized: Store only the ID to avoid unnecessary re-renders when note object changes
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => searchParams.get('note'));
  const noteListRef = useRef<NoteListHandle>(null);
  const { labels } = useLabels();
  const { contacts } = useContacts();
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
      // Use parseLocalDate to avoid timezone issues (e.g., 2026-01-26 showing as Jan 25)
      const parsed = parseLocalDate(dateParam);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    return new Date();
  }, [searchParams]);

  const [selectedDate, setSelectedDateState] = useState<Date>(getInitialSelectedDate);

  // Update URL when selected date changes (only in calendar view)
  const setSelectedDate = useCallback((newDate: Date | undefined) => {
    const dateToSet = newDate ?? new Date();
    setSelectedDateState(dateToSet);
    // Only update URL date param when in calendar view
    if (viewMode === 'calendar') {
      setSearchParams(prev => {
        const newParams = new URLSearchParams(prev);
        // Use formatLocalDate to avoid timezone issues
        const dateStr = formatLocalDate(dateToSet);
        const today = formatLocalDate(new Date());
        if (dateStr !== today) {
          newParams.set('date', dateStr);
        } else {
          newParams.delete('date');
        }
        return newParams;
      }, { replace: true });
    }
  }, [setSearchParams, viewMode]);

  // Initialize filters from URL params
  const getInitialLabelFilter = useCallback(() => {
    const labelsParam = searchParams.get('labels');
    return labelsParam ? labelsParam.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const getInitialCategoryFilter = useCallback((): NoteCategory | 'all' => {
    const categoryParam = searchParams.get('category');
    if (categoryParam === 'todo' || categoryParam === 'followup' || categoryParam === 'notes') {
      return categoryParam;
    }
    return 'all';
  }, [searchParams]);

  const getInitialAssigneeFilter = useCallback(() => {
    const assigneesParam = searchParams.get('assignees');
    return assigneesParam ? assigneesParam.split(',').filter(Boolean) : [];
  }, [searchParams]);

  const [labelFilter, setLabelFilter] = useState<string[]>(getInitialLabelFilter);
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | 'all'>(getInitialCategoryFilter);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>(getInitialAssigneeFilter);
  const [taskStatusFilter, setTaskStatusFilter] = useState<'active' | 'completed' | 'deleted'>('active');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ deadline: 'asc' | 'desc' | null; assignee: 'asc' | 'desc' | null; category: 'asc' | 'desc' | null }>({
    deadline: null,
    assignee: null,
    category: null,
  });
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false);

  // Update URL when view mode changes
  const setViewMode = useCallback((newViewMode: 'list' | 'calendar') => {
    setViewModeState(newViewMode);
    updateSettings({ viewMode: newViewMode });

    // Reset category filter if switching to calendar view with 'notes' filter active
    // (notes don't have deadlines, so they don't make sense in calendar view)
    if (newViewMode === 'calendar' && categoryFilter === 'notes') {
      setCategoryFilter('all');
    }

    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('view', newViewMode);
      if (newViewMode === 'list') {
        // Clear date param when switching to list view (date is only for calendar)
        newParams.delete('date');
      }
      // Also clear category param if switching to calendar with notes filter
      if (newViewMode === 'calendar' && categoryFilter === 'notes') {
        newParams.delete('category');
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams, updateSettings, categoryFilter]);

  const toggleViewMode = useCallback(() => {
    setViewMode(viewMode === 'list' ? 'calendar' : 'list');
  }, [viewMode, setViewMode]);

  // Load ALL notes without date filtering (filtered by active project)
  // Uses calendar sync enabled hook to auto-sync meetings to Google Calendar
  const { notes, loading, createNote, createNoteAfter, updateNote, updateDeadline, updateAssignee, toggleCompleted, togglePinned, deleteNote, restoreNote, reorderNotes, postponeNote } = useNotesWithCalendarSync();

  // Derive the full note object from the ID (memoized)
  // This prevents re-renders when the note object reference changes but ID stays the same
  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    return notes.find(n => n.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  // Sync selected note ID from URL param when notes load or URL changes
  useEffect(() => {
    const noteId = searchParams.get('note');

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
  // Optimized: Work with note ID instead of full object
  const handleSelectNote = useCallback((note: Note | null) => {
    const noteId = note?.id ?? null;
    setSelectedNoteId(noteId);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (noteId) {
        newParams.set('note', noteId);
      } else {
        newParams.delete('note');
      }
      // Ensure view mode is preserved (use current state, not prev params)
      newParams.set('view', viewMode);
      // Clear date param in list view (date is only for calendar)
      if (viewMode === 'list') {
        newParams.delete('date');
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams, viewMode]);

  // Update URL when label filter changes
  const handleLabelFilterChange = useCallback((newLabels: string[]) => {
    setLabelFilter(newLabels);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newLabels.length > 0) {
        newParams.set('labels', newLabels.join(','));
      } else {
        newParams.delete('labels');
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Update URL when category filter changes
  const handleCategoryFilterChange = useCallback((newCategory: NoteCategory | 'all') => {
    setCategoryFilter(newCategory);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newCategory !== 'all') {
        newParams.set('category', newCategory);
      } else {
        newParams.delete('category');
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Update URL when assignee filter changes
  const handleAssigneeFilterChange = useCallback((newAssignees: string[]) => {
    setAssigneeFilter(newAssignees);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (newAssignees.length > 0) {
        newParams.set('assignees', newAssignees.join(','));
      } else {
        newParams.delete('assignees');
      }
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  const handleCreateTask = useCallback(() => {
    // Use category filter if set, otherwise default to 'todo'
    const category = categoryFilter !== 'all' ? categoryFilter : 'todo';
    // Pass label filter so new task is visible with current filters
    const result = createNote('', category, null, labelFilter);
    // Handle both Promise and synchronous returns (TinyBase returns string ID, legacy returns Promise<Note>)
    Promise.resolve(result).then((newNoteOrId) => {
      if (newNoteOrId) {
        // If it's a string (ID from TinyBase), create minimal Note object; otherwise use as-is (Note from legacy)
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

  const handleUpdateDeadline = useCallback(async (id: string, deadline: string | null) => {
    await updateDeadline(id, deadline);
    // Note: selectedNote will automatically update via useMemo when notes array changes
  }, [updateDeadline]);

  const handlePostponeNote = useCallback(async (id: string, newDeadline: string, reason: string) => {
    await postponeNote(id, newDeadline, reason);
    // Note: selectedNote will automatically update via useMemo when notes array changes
  }, [postponeNote]);

  // Only block on TinyBase not ready - never unmount NoteList due to loading
  // This prevents React hooks count mismatch when project changes
  // Only block on TinyBase not ready - never unmount NoteList due to loading
  // This prevents React hooks count mismatch when project changes
  if (!isReady || (loading && !notes.length)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <NoteList
        ref={noteListRef}
        notes={notes}
        onEdit={handleUpdateNote}
        onDelete={handleDeleteNote}
        onRestore={restoreNote}
        onToggleCompleted={toggleCompleted}
        onTogglePinned={togglePinned}
        onUpdateDeadline={handleUpdateDeadline}
        onUpdateAssignee={updateAssignee}
        onReorderNotes={reorderNotes}
        onPostponeNote={handlePostponeNote}
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
        onTaskStatusFilterChange={setTaskStatusFilter}
        externalShowOverdueOnly={showOverdueOnly}
        onShowOverdueOnlyChange={setShowOverdueOnly}
        externalSortConfig={sortConfig}
        onSortConfigChange={setSortConfig}
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
        onTaskStatusFilterChange={setTaskStatusFilter}
        showOverdueOnly={showOverdueOnly}
        onShowOverdueOnlyChange={setShowOverdueOnly}
        hasCompletedTasks={notes.some(n => n.completed)}
        hasDeletedTasks={notes.some(n => n.deleted_at)}
        sortConfig={sortConfig}
        onSortChange={setSortConfig}
      />

      <HotkeysHelper />

      <CreateProjectDialog
        open={showCreateProjectDialog}
        onOpenChange={setShowCreateProjectDialog}
        onCreateProject={async (data) => {
          await createProject(data, true);
        }}
      />
    </>
  );
}
