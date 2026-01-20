import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NoteEditor } from './NoteEditor';
import type { Note, NoteCategory } from '@/types/note';

interface NoteListProps {
  notes: Note[];
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDelete: (id: string) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
}

interface NoteRowProps {
  note: Note;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDelete: (id: string) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: () => void;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
}

function NoteRow({
  note,
  onEdit,
  onDelete,
  onToggleCompleted,
  isSelected,
  isEditing,
  onSelect,
  onStartEditing,
  onStopEditing,
  onNavigateUp,
  onNavigateDown,
}: NoteRowProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  // Limpiar contenido pendiente cuando la nota se actualiza
  useEffect(() => {
    if (pendingContent !== null && note.content === pendingContent) {
      setPendingContent(null);
    }
  }, [note.content, pendingContent]);

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleCheckedChange = () => {
    onToggleCompleted(note.id, !note.completed);
  };

  const handleSave = (content: string, category?: NoteCategory, description?: string | null) => {
    setPendingContent(content);
    onEdit(note.id, content, category || note.category, description);
    onStopEditing();
  };

  const displayContent = pendingContent ?? note.content;

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onDelete(note.id);
    setShowDeleteDialog(false);
  };

  const handleClick = () => {
    if (!isEditing) {
      onSelect();
      onStartEditing();
    }
  };

  return (
    <>
      <div
        ref={rowRef}
        className={`group grid grid-cols-[24px_1fr_24px] py-1.5 border-b border-dashed border-muted-foreground/20 hover:bg-muted/30 transition-colors ${note.completed ? 'opacity-50' : ''}`}
      >
        <div
          className="flex items-center justify-center cursor-pointer select-none"
          onClick={handleToggle}
        >
          {note.completed ? (
            <Checkbox
              checked={true}
              onCheckedChange={handleCheckedChange}
            />
          ) : (
            <Checkbox
              checked={false}
              onCheckedChange={handleCheckedChange}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>

        <div
          className="px-2 cursor-pointer select-none"
          onClick={handleClick}
        >
          {isEditing ? (
            <NoteEditor
              initialContent={note.content}
              initialDescription={note.description}
              initialCategory={note.category}
              onSave={handleSave}
              onCancel={onStopEditing}
              onNavigateUp={onNavigateUp}
              onNavigateDown={onNavigateDown}
              autoFocus
              inline
            />
          ) : (
            <div className="flex flex-col">
              <span className={`text-sm leading-relaxed ${note.completed ? 'line-through text-muted-foreground' : ''}`}>
                {displayContent}
              </span>
              {note.description && (
                <span className={`text-xs text-muted-foreground mt-0.5 ${note.completed ? 'line-through' : ''}`}>
                  {note.description}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-center select-none">
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-destructive p-0.5"
            onClick={handleDeleteClick}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteNote')}</DialogTitle>
            <DialogDescription>{t('confirmDelete')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function NoteList({ notes, onEdit, onDelete, onToggleCompleted }: NoteListProps) {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { todoNotes, followupNotes } = useMemo(() => {
    const todo = notes.filter((note) => note.category === 'todo' || !note.category);
    const followup = notes.filter((note) => note.category === 'followup');
    return { todoNotes: todo, followupNotes: followup };
  }, [notes]);

  // Lista combinada para navegación (todo primero, luego followup)
  const allNotes = useMemo(() => [...todoNotes, ...followupNotes], [todoNotes, followupNotes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // No manejar si hay un editor activo
      if (editingId) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedIndex === null) {
          if (allNotes.length > 0) {
            setSelectedIndex(0);
            setEditingId(allNotes[0].id);
          }
        } else if (selectedIndex < allNotes.length - 1) {
          const newIndex = selectedIndex + 1;
          setSelectedIndex(newIndex);
          setEditingId(allNotes[newIndex].id);
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIndex === null) {
          if (allNotes.length > 0) {
            const lastIndex = allNotes.length - 1;
            setSelectedIndex(lastIndex);
            setEditingId(allNotes[lastIndex].id);
          }
        } else if (selectedIndex > 0) {
          const newIndex = selectedIndex - 1;
          setSelectedIndex(newIndex);
          setEditingId(allNotes[newIndex].id);
        }
      } else if (e.key === 'Escape') {
        setSelectedIndex(null);
        setEditingId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, editingId, allNotes]);

  // Resetear selección cuando cambian las notas
  useEffect(() => {
    if (selectedIndex !== null && selectedIndex >= allNotes.length) {
      setSelectedIndex(allNotes.length > 0 ? allNotes.length - 1 : null);
    }
  }, [allNotes.length, selectedIndex]);

  const handleSelect = (noteId: string) => {
    const index = allNotes.findIndex((n) => n.id === noteId);
    setSelectedIndex(index >= 0 ? index : null);
  };

  const handleStartEditing = (noteId: string) => {
    setEditingId(noteId);
  };

  const handleStopEditing = () => {
    setEditingId(null);
  };

  const handleNavigateUp = (currentIndex: number) => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setSelectedIndex(newIndex);
      setEditingId(allNotes[newIndex].id);
    }
  };

  const handleNavigateDown = (currentIndex: number) => {
    if (currentIndex < allNotes.length - 1) {
      const newIndex = currentIndex + 1;
      setSelectedIndex(newIndex);
      setEditingId(allNotes[newIndex].id);
    }
  };

  if (notes.length === 0) {
    return (
      <p className="text-center text-muted-foreground/60 py-8 text-sm italic">
        {t('noNotes')}
      </p>
    );
  }

  return (
    <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[calc(100vh-300px)]" tabIndex={0}>
      <section className="flex flex-col min-h-0">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3 font-medium">
          {t('categoryTodo')}
        </h2>
        <div className="overflow-y-auto flex-1 pr-2">
          {todoNotes.length > 0 ? (
            todoNotes.map((note) => {
              const globalIndex = allNotes.findIndex((n) => n.id === note.id);
              return (
                <NoteRow
                  key={note.id}
                  note={note}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleCompleted={onToggleCompleted}
                  isSelected={selectedIndex === globalIndex}
                  isEditing={editingId === note.id}
                  onSelect={() => handleSelect(note.id)}
                  onStartEditing={() => handleStartEditing(note.id)}
                  onStopEditing={handleStopEditing}
                  onNavigateUp={() => handleNavigateUp(globalIndex)}
                  onNavigateDown={() => handleNavigateDown(globalIndex)}
                />
              );
            })
          ) : (
            <p className="text-muted-foreground/50 text-sm italic py-2">
              {t('noNotes')}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col min-h-0 md:border-l md:border-dashed md:border-muted-foreground/20 md:pl-8">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3 font-medium">
          {t('categoryFollowUp')}
        </h2>
        <div className="overflow-y-auto flex-1 pr-2">
          {followupNotes.length > 0 ? (
            followupNotes.map((note) => {
              const globalIndex = allNotes.findIndex((n) => n.id === note.id);
              return (
                <NoteRow
                  key={note.id}
                  note={note}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleCompleted={onToggleCompleted}
                  isSelected={selectedIndex === globalIndex}
                  isEditing={editingId === note.id}
                  onSelect={() => handleSelect(note.id)}
                  onStartEditing={() => handleStartEditing(note.id)}
                  onStopEditing={handleStopEditing}
                  onNavigateUp={() => handleNavigateUp(globalIndex)}
                  onNavigateDown={() => handleNavigateDown(globalIndex)}
                />
              );
            })
          ) : (
            <p className="text-muted-foreground/50 text-sm italic py-2">
              {t('noNotes')}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
