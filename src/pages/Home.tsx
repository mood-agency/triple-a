import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { DateDisplay } from '@/components/notes/DateDisplay';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { NoteList } from '@/components/notes/NoteList';
import { useNotes } from '@/hooks/useNotes';
import { useDatabase } from '@/contexts/DatabaseContext';
import type { Note } from '@/types/note';

export function Home() {
  const { t, i18n } = useTranslation();
  const { isReady } = useDatabase();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const today = new Date();
  const dateKey = today.toISOString().split('T')[0];

  const { notes, loading, createNote, updateNote, toggleCompleted, deleteNote } = useNotes(dateKey);

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

  if (!isReady || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-xl">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <Button asChild variant="outline" size="sm">
            <Link to="/about">{t('about')}</Link>
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={toggleLanguage}>
              {t('language')}: {i18n.language.toUpperCase()}
            </Button>
            <ThemeToggle />
          </div>
        </div>

        <DateDisplay date={today} />

        <div className="mb-8">
          <NoteEditor onSave={createNote} />
        </div>

        <NoteList
          notes={notes}
          onEdit={updateNote}
          onDelete={handleDeleteNote}
          onToggleCompleted={toggleCompleted}
          selectedNote={selectedNote}
          onSelectNote={setSelectedNote}
        />
      </div>
    </div>
  );
}
