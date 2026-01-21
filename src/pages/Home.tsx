import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NoteList, type NoteListHandle } from '@/components/notes/NoteList';
import { SettingsMenu } from '@/components/SettingsMenu';
import { SyncStatus } from '@/components/sync/SyncStatus';
import { UserMenu } from '@/components/auth/UserMenu';
import { CommandPalette } from '@/components/CommandPalette';
import { HotkeysHelper } from '@/components/HotkeysHelper';
import { useNotes } from '@/hooks/useNotes';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useLabels } from '@/hooks/useLabels';
import type { Note, NoteCategory } from '@/types/note';

export function Home() {
  const { t, i18n } = useTranslation();
  const { isReady } = useDatabase();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const noteListRef = useRef<NoteListHandle>(null);
  const { labels } = useLabels();

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

  const [labelFilter, setLabelFilter] = useState<string[]>(getInitialLabelFilter);
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | 'all'>(getInitialCategoryFilter);

  const today = new Date();
  const dateKey = today.toISOString().split('T')[0];

  const { notes, loading, createNote, createNoteAfter, updateNote, updateDeadline, toggleCompleted, togglePinned, deleteNote, restoreNote, reorderNotes, postponeNote } = useNotes(dateKey);

  // Sync selected note from URL param when notes load
  useEffect(() => {
    if (!loading && notes.length > 0) {
      const noteId = searchParams.get('note');
      if (noteId) {
        const note = notes.find(n => n.id === noteId);
        if (note && (!selectedNote || selectedNote.id !== noteId)) {
          setSelectedNote(note);
        }
      }
    }
  }, [loading, notes, searchParams, selectedNote]);

  // Update URL when selected note changes
  const handleSelectNote = useCallback((note: Note | null) => {
    setSelectedNote(note);
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (note) {
        newParams.set('note', note.id);
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

  const handleCreateTask = () => {
    createNote('Mi tarea aquí', 'todo');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  const handleDeleteNote = (id: string) => {
    if (selectedNote?.id === id) {
      handleSelectNote(null);
    }
    deleteNote(id);
  };

  const handleUpdateNote = async (id: string, content: string, category?: import('@/types/note').NoteCategory, description?: string | null) => {
    const updatedNote = await updateNote(id, content, category, description);
    // Update selectedNote if it's the one being edited
    if (selectedNote?.id === id) {
      setSelectedNote(updatedNote);
    }
  };

  const handleUpdateDeadline = async (id: string, deadline: string | null) => {
    await updateDeadline(id, deadline);
    // Update selectedNote if it's the one being edited
    if (selectedNote?.id === id) {
      setSelectedNote({ ...selectedNote, deadline });
    }
  };

  if (!isReady || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col py-8 px-4">
      <div className="w-full px-4 flex flex-col flex-1 min-h-0">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h1 className="text-2xl font-bold">Triple A</h1>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button onClick={handleCreateTask} size="icon" variant="outline">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('newTask')}</p>
              </TooltipContent>
            </Tooltip>
            <SyncStatus />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="secondary" size="sm" onClick={toggleLanguage}>
                  {i18n.language.toUpperCase()}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('toggleLanguage')}</p>
              </TooltipContent>
            </Tooltip>
            <ThemeToggle />
            <SettingsMenu />
            <UserMenu />
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <NoteList
            ref={noteListRef}
            notes={notes}
            onEdit={handleUpdateNote}
            onDelete={handleDeleteNote}
            onRestore={restoreNote}
            onToggleCompleted={toggleCompleted}
            onTogglePinned={togglePinned}
            onUpdateDeadline={handleUpdateDeadline}
            onReorderNotes={reorderNotes}
            onPostponeNote={postponeNote}
            selectedNote={selectedNote}
            onSelectNote={handleSelectNote}
            onCreateNoteAfter={createNoteAfter}
            externalLabelFilter={labelFilter}
            externalCategoryFilter={categoryFilter}
            onLabelFilterChange={handleLabelFilterChange}
            onCategoryFilterChange={handleCategoryFilterChange}
          />
        </div>
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
      />

      <HotkeysHelper />
    </div>
  );
}
