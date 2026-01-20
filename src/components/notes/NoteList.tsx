import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
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
  onNavigateToEditor?: (column: number) => void;
}

interface NoteRowProps {
  note: Note;
  onDelete: (id: string) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onNavigateDown: (column: number) => void;
  onNavigateUp: (column: number) => void;
  onNavigateToDescription: () => void;
  shouldFocusTitle: boolean;
  desiredColumn: number;
  onTitleFocused: () => void;
}

function NoteRow({
  note,
  onDelete,
  onToggleCompleted,
  isSelected,
  onSelect,
  onEdit,
  onNavigateDown,
  onNavigateUp,
  onNavigateToDescription,
  shouldFocusTitle,
  desiredColumn,
  onTitleFocused,
}: NoteRowProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [contentValue, setContentValue] = useState(note.content);
  const rowRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const clickCaretPosRef = useRef<number | null>(null);

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  useEffect(() => {
    setContentValue(note.content);
  }, [note.content]);

  useEffect(() => {
    if (isEditingContent && contentInputRef.current) {
      contentInputRef.current.focus();
      // If we have a click position stored, apply it immediately
      if (clickCaretPosRef.current !== null) {
        contentInputRef.current.setSelectionRange(clickCaretPosRef.current, clickCaretPosRef.current);
        clickCaretPosRef.current = null;
      }
    }
  }, [isEditingContent]);

  // Focus externo desde el padre (navegación con flechas)
  useEffect(() => {
    if (shouldFocusTitle && isSelected) {
      setIsEditingContent(true);
      // Apply desired column position after focus
      setTimeout(() => {
        if (contentInputRef.current) {
          const pos = Math.min(desiredColumn, contentInputRef.current.value.length);
          contentInputRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
      onTitleFocused();
    }
  }, [shouldFocusTitle, isSelected, desiredColumn, onTitleFocused]);

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

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();

    // Calculate approximate caret position from click
    const target = e.currentTarget;
    const span = target.querySelector('span');
    if (span) {
      // Get click position relative to the text
      const rect = span.getBoundingClientRect();
      const clickX = e.clientX - rect.left;

      // Measure character positions using canvas for accuracy
      const text = note.content;
      const computedStyle = window.getComputedStyle(span);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let clickPos = text.length;
      if (ctx) {
        ctx.font = `${computedStyle.fontStyle} ${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;

        // Find position by checking midpoint of each character
        for (let i = 0; i < text.length; i++) {
          const widthBefore = ctx.measureText(text.substring(0, i)).width;
          const widthAfter = ctx.measureText(text.substring(0, i + 1)).width;
          const charMidpoint = (widthBefore + widthAfter) / 2;

          if (clickX < charMidpoint) {
            clickPos = i;
            break;
          }
        }
      }

      // Store position in ref so useEffect can apply it immediately after focus
      clickCaretPosRef.current = clickPos;
      setIsEditingContent(true);
    } else {
      setIsEditingContent(true);
    }
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
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      handleContentBlur();
      // Jump to description (always, even if empty)
      onNavigateToDescription();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const column = contentInputRef.current?.selectionStart ?? 0;
      handleContentBlur();
      onNavigateDown(column);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const column = contentInputRef.current?.selectionStart ?? 0;
      handleContentBlur();
      onNavigateUp(column);
    } else if (e.key === 'Escape') {
      setContentValue(note.content);
      setIsEditingContent(false);
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

type FocusTarget = 'title' | 'description-start' | 'description-end' | null;

// Helper to get column position (position within current line)
function getColumnPosition(text: string, cursorPos: number): number {
  const textBeforeCursor = text.substring(0, cursorPos);
  const lastNewline = textBeforeCursor.lastIndexOf('\n');
  return lastNewline === -1 ? cursorPos : cursorPos - lastNewline - 1;
}

export interface NoteListHandle {
  focusFirstTaskTitle: (column?: number) => void;
}

export const NoteList = forwardRef<NoteListHandle, NoteListProps>(function NoteList({ notes, onEdit, onDelete, onToggleCompleted, selectedNote, onSelectNote, onNavigateToEditor }, ref) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [desiredColumn, setDesiredColumn] = useState<number>(0);

  // Expose method to focus first task from parent
  useImperativeHandle(ref, () => ({
    focusFirstTaskTitle: (column?: number) => {
      if (notes.length > 0) {
        onSelectNote(notes[0]);
        setDesiredColumn(column ?? 0);
        setFocusTarget('title');
      }
    },
  }), [notes, onSelectNote]);

  // Update description value when selected note changes
  useEffect(() => {
    setDescriptionValue(selectedNote?.description || '');
  }, [selectedNote]);

  // Aplicar focus según focusTarget
  useEffect(() => {
    if (!focusTarget || !selectedNote) return;

    if (focusTarget === 'description-start' || focusTarget === 'description-end') {
      setTimeout(() => {
        descriptionRef.current?.focus();
        if (descriptionRef.current) {
          const value = descriptionRef.current.value;
          if (focusTarget === 'description-start') {
            // Use desired column on first line
            const firstLineLength = value.indexOf('\n') === -1 ? value.length : value.indexOf('\n');
            const pos = Math.min(desiredColumn, firstLineLength);
            descriptionRef.current.setSelectionRange(pos, pos);
          } else {
            // Use desired column on last line
            const lines = value.split('\n');
            const lastLineLength = lines[lines.length - 1].length;
            const lastLineStart = value.length - lastLineLength;
            const pos = lastLineStart + Math.min(desiredColumn, lastLineLength);
            descriptionRef.current.setSelectionRange(pos, pos);
          }
        }
        setFocusTarget(null);
      }, 0);
    }
    // 'title' se maneja via prop shouldFocusTitle en NoteRow
  }, [focusTarget, selectedNote, desiredColumn]);

  // ↓ desde título
  const handleNavigateDownFromTitle = (noteId: string, column: number) => {
    setDesiredColumn(column);
    const note = notes.find((n) => n.id === noteId);
    if (note?.description) {
      // Ir a descripción de la misma tarea
      setFocusTarget('description-start');
    } else {
      // Ir a siguiente tarea
      const idx = notes.findIndex((n) => n.id === noteId);
      if (idx < notes.length - 1) {
        onSelectNote(notes[idx + 1]);
        setFocusTarget('title');
      }
    }
  };

  // ↑ desde título
  const handleNavigateUpFromTitle = (noteId: string, column: number) => {
    setDesiredColumn(column);
    const idx = notes.findIndex((n) => n.id === noteId);
    if (idx > 0) {
      const prevNote = notes[idx - 1];
      onSelectNote(prevNote);
      setFocusTarget(prevNote.description ? 'description-end' : 'title');
    } else if (idx === 0 && onNavigateToEditor) {
      // On first task, navigate to the editor's description
      onSelectNote(null);
      onNavigateToEditor(column);
    }
  };

  const handleTitleFocused = () => {
    if (focusTarget === 'title') {
      setFocusTarget(null);
    }
  };

  // Tab from title - always go to description (even if empty)
  const handleNavigateToDescription = () => {
    setDesiredColumn(0);
    setFocusTarget('description-start');
  };

  // Save description when it changes and user stops typing
  const handleDescriptionBlur = () => {
    if (selectedNote && descriptionValue !== (selectedNote.description || '')) {
      onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setDescriptionValue(selectedNote?.description || '');
      descriptionRef.current?.blur();
    } else if (e.key === 'ArrowDown' && selectedNote) {
      const textarea = descriptionRef.current;
      if (textarea) {
        const { selectionStart, value } = textarea;
        const textAfterCursor = value.substring(selectionStart);
        const isOnLastLine = !textAfterCursor.includes('\n');

        if (isOnLastLine) {
          e.preventDefault();
          // Capture column position before navigating
          const column = getColumnPosition(value, selectionStart);
          setDesiredColumn(column);
          // Save current description
          if (descriptionValue !== (selectedNote.description || '')) {
            onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
          }
          // Move to next note's title
          const currentIndex = notes.findIndex((n) => n.id === selectedNote.id);
          if (currentIndex < notes.length - 1) {
            onSelectNote(notes[currentIndex + 1]);
            setFocusTarget('title');
          }
        }
      }
    } else if (e.key === 'ArrowUp' && selectedNote) {
      const textarea = descriptionRef.current;
      if (textarea) {
        const { selectionStart, value } = textarea;
        const textBeforeCursor = value.substring(0, selectionStart);
        const isOnFirstLine = !textBeforeCursor.includes('\n');

        if (isOnFirstLine) {
          e.preventDefault();
          // Capture column position before navigating
          const column = getColumnPosition(value, selectionStart);
          setDesiredColumn(column);
          // Save current description
          if (descriptionValue !== (selectedNote.description || '')) {
            onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
          }
          // Go to title of the SAME task (not previous)
          setFocusTarget('title');
        }
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if we're typing in any text input (INPUT or TEXTAREA)
      const activeEl = document.activeElement;
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!selectedNote && notes.length > 0) {
          onSelectNote(notes[0]);
          setFocusTarget('title');
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!selectedNote && notes.length > 0) {
          onSelectNote(notes[notes.length - 1]);
          setFocusTarget('title');
        }
      } else if (e.key === 'Escape') {
        onSelectNote(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNote, notes, onSelectNote]);

  if (notes.length === 0) {
    return (
      <p className="text-center text-muted-foreground/60 py-8 text-sm italic">
        {t('noNotes')}
      </p>
    );
  }

  return (
    <div ref={containerRef} className="grid grid-cols-[1fr_1fr] gap-4 h-full" tabIndex={0}>
      <div className="overflow-y-auto pr-2">
        {notes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            onDelete={onDelete}
            onToggleCompleted={onToggleCompleted}
            isSelected={selectedNote?.id === note.id}
            onSelect={() => onSelectNote(note)}
            onEdit={onEdit}
            onNavigateDown={(column) => handleNavigateDownFromTitle(note.id, column)}
            onNavigateUp={(column) => handleNavigateUpFromTitle(note.id, column)}
            onNavigateToDescription={handleNavigateToDescription}
            shouldFocusTitle={focusTarget === 'title' && selectedNote?.id === note.id}
            desiredColumn={desiredColumn}
            onTitleFocused={handleTitleFocused}
          />
        ))}
      </div>

      <div className="border-l border-dashed border-muted-foreground/20 pl-4">
        {selectedNote ? (
          <textarea
            ref={descriptionRef}
            value={descriptionValue}
            onChange={(e) => setDescriptionValue(e.target.value)}
            onBlur={handleDescriptionBlur}
            onKeyDown={handleDescriptionKeyDown}
            placeholder={t('writeDescription')}
            className="h-full w-full text-sm bg-transparent border-none outline-none resize-none text-muted-foreground"
          />
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">
            {t('selectNoteToEdit')}
          </p>
        )}
      </div>
    </div>
  );
});
