import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { NoteList, type NoteListHandle } from '@/components/notes/NoteList';
import { SettingsMenu } from '@/components/SettingsMenu';
import { useNotes } from '@/hooks/useNotes';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Note } from '@/types/note';

export function Home() {
  const { t, i18n } = useTranslation();
  const { isReady } = useDatabase();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const noteListRef = useRef<NoteListHandle>(null);

  const today = new Date();
  const dateKey = today.toISOString().split('T')[0];

  const { notes, loading, createNoteAfter, updateNote, toggleCompleted, togglePinned, deleteNote, restoreNote, reorderNotes } = useNotes(dateKey);

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  const handleDeleteNote = (id: string) => {
    if (selectedNote?.id === id) {
      setSelectedNote(null);
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
            onReorderNotes={reorderNotes}
            selectedNote={selectedNote}
            onSelectNote={setSelectedNote}
            onCreateNoteAfter={createNoteAfter}
          />
        </div>
      </div>
    </div>
  );
}
