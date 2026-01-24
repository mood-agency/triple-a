import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { NoteList, type NoteListHandle } from '@/components/notes/NoteList';
import { CommandPalette } from '@/components/CommandPalette';
import { HotkeysHelper } from '@/components/HotkeysHelper';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { useNotes } from '@/hooks/useNotes';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useLabels } from '@/hooks/useLabels';
import { useSettings } from '@/hooks/useSettings';
import type { Note, NoteCategory } from '@/types/note';

export function Home() {
  useTranslation();
  const { isReady } = useDatabase();
  const [searchParams, setSearchParams] = useSearchParams();
  // Optimized: Store only the ID to avoid unnecessary re-renders when note object changes
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(() => searchParams.get('note'));
  const noteListRef = useRef<NoteListHandle>(null);
  const { labels } = useLabels();
  const { settings, updateSettings } = useSettings();

  const viewMode = settings.viewMode;
  const toggleViewMode = useCallback(() => {
    updateSettings({ viewMode: viewMode === 'list' ? 'calendar' : 'list' });
  }, [viewMode, updateSettings]);

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

  // Load ALL notes without date filtering
  const { notes, loading, createNote, createNoteAfter, updateNote, updateDeadline, updateAssignee, toggleCompleted, togglePinned, deleteNote, restoreNote, reorderNotes, postponeNote } = useNotes();

  // Derive the full note object from the ID (memoized)
  // This prevents re-renders when the note object reference changes but ID stays the same
  const selectedNote = useMemo(() => {
    if (!selectedNoteId) return null;
    return notes.find(n => n.id === selectedNoteId) ?? null;
  }, [notes, selectedNoteId]);

  // Sync selected note ID from URL param when notes load
  useEffect(() => {
    if (!loading && notes.length > 0) {
      const noteId = searchParams.get('note');
      if (noteId && noteId !== selectedNoteId) {
        const note = notes.find(n => n.id === noteId);
        if (note) {
          setSelectedNoteId(noteId);
        }
      }
    }
  }, [loading, notes, searchParams, selectedNoteId]);

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
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

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

  const handleDeleteNote = useCallback((id: string) => {
    if (selectedNoteId === id) {
      handleSelectNote(null);
    }
    deleteNote(id);
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

  if (!isReady || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-screen flex flex-col py-8 px-4">
        <div className="w-full px-4 flex flex-col flex-1 min-h-0">
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
            sidebarTrigger={<SidebarTrigger className="h-8 w-8 shadow-none" />}
          />
        </div>

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
        />

        <HotkeysHelper />
      </SidebarInset>
    </SidebarProvider>
  );
}
