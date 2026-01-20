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
import type { Note, NoteCategory } from '@/types/note';

interface NoteListProps {
  notes: Note[];
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDelete: (id: string) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  selectedNote: Note | null;
  onSelectNote: (note: Note | null) => void;
}

interface NoteRowProps {
  note: Note;
  onDelete: (id: string) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
}

function NoteRow({
  note,
  onDelete,
  onToggleCompleted,
  isSelected,
  onSelect,
  onEdit,
}: NoteRowProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [contentValue, setContentValue] = useState(note.content);
  const [descriptionValue, setDescriptionValue] = useState(note.description || '');
  const rowRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  useEffect(() => {
    setContentValue(note.content);
  }, [note.content]);

  useEffect(() => {
    setDescriptionValue(note.description || '');
  }, [note.description]);

  useEffect(() => {
    if (isEditingContent && contentInputRef.current) {
      contentInputRef.current.focus();
      contentInputRef.current.select();
    }
  }, [isEditingContent]);

  useEffect(() => {
    if (isEditingDescription && descriptionTextareaRef.current) {
      descriptionTextareaRef.current.focus();
    }
  }, [isEditingDescription]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleCheckedChange = () => {
    onToggleCompleted(note.id, !note.completed);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onDelete(note.id);
    setShowDeleteDialog(false);
  };

  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
    setIsEditingContent(true);
  };

  const handleContentBlur = () => {
    setIsEditingContent(false);
    if (contentValue.trim() && contentValue !== note.content) {
      onEdit(note.id, contentValue.trim(), note.category, note.description);
    } else {
      setContentValue(note.content);
    }
  };

  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleContentBlur();
    } else if (e.key === 'Escape') {
      setContentValue(note.content);
      setIsEditingContent(false);
    }
  };

  const handleDescriptionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingDescription(true);
  };

  const handleDescriptionBlur = () => {
    setIsEditingDescription(false);
    if (descriptionValue !== (note.description || '')) {
      onEdit(note.id, note.content, note.category, descriptionValue || null);
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setDescriptionValue(note.description || '');
      setIsEditingDescription(false);
    }
  };

  return (
    <>
      <div
        ref={rowRef}
        onClick={onSelect}
        className={`group grid grid-cols-[24px_1fr_24px] py-1.5 border-b border-dashed border-muted-foreground/20 hover:bg-muted/30 transition-colors cursor-pointer ${note.completed ? 'opacity-50' : ''} ${isSelected ? 'bg-muted/50' : ''}`}
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

        <div className="px-2 select-none" onClick={handleContentClick}>
          {isEditingContent ? (
            <input
              ref={contentInputRef}
              type="text"
              value={contentValue}
              onChange={(e) => setContentValue(e.target.value)}
              onBlur={handleContentBlur}
              onKeyDown={handleContentKeyDown}
              className="w-full text-sm leading-relaxed bg-transparent border-none outline-none"
            />
          ) : (
            <span className={`text-sm leading-relaxed ${note.completed ? 'line-through text-muted-foreground' : ''} ${isSelected ? 'cursor-text' : ''}`}>
              {note.content}
            </span>
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

      {isSelected && (
        <div
          className="py-2 px-8 bg-muted/30 border-b border-dashed border-muted-foreground/20 cursor-text"
          onClick={handleDescriptionClick}
        >
          {isEditingDescription ? (
            <textarea
              ref={descriptionTextareaRef}
              value={descriptionValue}
              onChange={(e) => setDescriptionValue(e.target.value)}
              onBlur={handleDescriptionBlur}
              onKeyDown={handleDescriptionKeyDown}
              placeholder={t('writeDescription')}
              className="w-full text-sm bg-transparent border-none outline-none resize-none text-muted-foreground"
              rows={2}
            />
          ) : (
            <p className={`text-sm ${note.description ? 'text-muted-foreground' : 'text-muted-foreground/50 italic'}`}>
              {note.description || t('writeDescription')}
            </p>
          )}
        </div>
      )}

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

export function NoteList({ notes, onEdit, onDelete, onToggleCompleted, selectedNote, onSelectNote }: NoteListProps) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const { todoNotes, followupNotes } = useMemo(() => {
    const todo = notes.filter((note) => note.category === 'todo' || !note.category);
    const followup = notes.filter((note) => note.category === 'followup');
    return { todoNotes: todo, followupNotes: followup };
  }, [notes]);

  const allNotes = useMemo(() => [...todoNotes, ...followupNotes], [todoNotes, followupNotes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!selectedNote) {
          if (allNotes.length > 0) {
            onSelectNote(allNotes[0]);
          }
        } else {
          const currentIndex = allNotes.findIndex((n) => n.id === selectedNote.id);
          if (currentIndex < allNotes.length - 1) {
            onSelectNote(allNotes[currentIndex + 1]);
          }
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!selectedNote) {
          if (allNotes.length > 0) {
            onSelectNote(allNotes[allNotes.length - 1]);
          }
        } else {
          const currentIndex = allNotes.findIndex((n) => n.id === selectedNote.id);
          if (currentIndex > 0) {
            onSelectNote(allNotes[currentIndex - 1]);
          }
        }
      } else if (e.key === 'Escape') {
        onSelectNote(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNote, allNotes, onSelectNote]);

  if (notes.length === 0) {
    return (
      <p className="text-center text-muted-foreground/60 py-8 text-sm italic">
        {t('noNotes')}
      </p>
    );
  }

  return (
    <div ref={containerRef} className="grid grid-cols-1 md:grid-cols-2 gap-8 h-full" tabIndex={0}>
      <section className="flex flex-col min-h-0">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground/70 mb-3 font-medium">
          {t('categoryTodo')}
        </h2>
        <div className="overflow-y-auto flex-1 pr-2">
          {todoNotes.length > 0 ? (
            todoNotes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                onDelete={onDelete}
                onToggleCompleted={onToggleCompleted}
                isSelected={selectedNote?.id === note.id}
                onSelect={() => onSelectNote(note)}
                onEdit={onEdit}
              />
            ))
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
            followupNotes.map((note) => (
              <NoteRow
                key={note.id}
                note={note}
                onDelete={onDelete}
                onToggleCompleted={onToggleCompleted}
                isSelected={selectedNote?.id === note.id}
                onSelect={() => onSelectNote(note)}
                onEdit={onEdit}
              />
            ))
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
