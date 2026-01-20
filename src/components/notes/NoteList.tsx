import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Clock, Calendar, Search, ClipboardList, Forward } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EditableDescription, type EditableDescriptionHandle } from '@/components/ui/EditableDescription';
import { useNoteHistory } from '@/hooks/useNoteHistory';
import type { Note, NoteCategory } from '@/types/note';

interface NoteListProps {
  notes: Note[];
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDelete: (id: string) => void;
  onRestore: (note: Note) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  selectedNote: Note | null;
  onSelectNote: (note: Note | null) => void;
  onNavigateToEditor?: (column: number) => void;
  onCreateNoteAfter?: (afterNoteId: string, category: NoteCategory) => Promise<Note>;
}

interface NoteRowProps {
  note: Note;
  onDeleteWithToast: (note: Note) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onNavigateDown: (column: number) => boolean;
  onNavigateUp: (column: number) => boolean;
  onNavigateToDescription: () => void;
  shouldFocusTitle: boolean;
  desiredColumn: number;
  onTitleFocused: () => void;
  onCreateNoteAfter?: () => void;
}

function NoteRow({
  note,
  onDeleteWithToast,
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
  onCreateNoteAfter,
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
    onDeleteWithToast(note);
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
    if (contentValue.trim() && contentValue !== note.content) {
      const trimmedValue = contentValue.trim();
      setContentValue(trimmedValue);
      onEdit(note.id, trimmedValue, note.category, note.description);
    } else if (!contentValue.trim()) {
      setContentValue(note.content);
    }
    setIsEditingContent(false);
  };

  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Save current content first
      if (contentValue.trim() && contentValue !== note.content) {
        onEdit(note.id, contentValue.trim(), note.category, note.description);
      }
      setIsEditingContent(false);
      // Create new note after this one
      onCreateNoteAfter?.();
    } else if (e.key === 'Backspace' && contentValue === '') {
      e.preventDefault();
      setIsEditingContent(false);
      onDeleteWithToast(note);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      handleContentBlur();
      // Jump to description (always, even if empty)
      onNavigateToDescription();
    } else if (e.key === 'ArrowDown') {
      const column = contentInputRef.current?.selectionStart ?? 0;
      const didNavigate = onNavigateDown(column);
      if (didNavigate) {
        e.preventDefault();
        handleContentBlur();
      }
    } else if (e.key === 'ArrowUp') {
      const column = contentInputRef.current?.selectionStart ?? 0;
      const didNavigate = onNavigateUp(column);
      if (didNavigate) {
        e.preventDefault();
        handleContentBlur();
      }
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
        className={`group grid grid-cols-[24px_1fr_24px] py-0.5 hover:bg-muted/30 transition-colors cursor-pointer ${note.completed ? 'opacity-50' : ''} ${isSelected ? 'bg-muted/50' : ''}`}
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

        <div className={`px-2 select-none h-8 flex items-center gap-1.5 ${isEditingContent ? '' : 'overflow-hidden'}`} onClick={handleContentClick}>
          {note.category === 'todo' ? (
            <ClipboardList className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          ) : (
            <Forward className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          )}
          {isEditingContent ? (
            <input
              ref={contentInputRef}
              type="text"
              value={contentValue}
              onChange={(e) => setContentValue(e.target.value)}
              onBlur={handleContentBlur}
              onKeyDown={handleContentKeyDown}
              className="w-full text-sm leading-normal bg-transparent border-none outline-none p-0 m-0"
            />
          ) : (
            <span className={`block text-sm leading-normal truncate ${note.completed ? 'line-through text-muted-foreground' : ''} ${isSelected ? 'cursor-text' : ''}`}>
              {contentValue}
            </span>
          )}
        </div>

        <div className="flex items-center justify-center select-none">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-destructive p-1.5 cursor-pointer"
                onClick={handleDeleteClick}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('deleteTask')}</p>
            </TooltipContent>
          </Tooltip>
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

// Helper to format date/time
function formatDateTime(isoString: string, locale: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(isoString: string, locale: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}


export interface NoteListHandle {
  focusFirstTaskTitle: (column?: number) => void;
}

// Helper to get column position (position within current line)
function getColumnPosition(text: string, cursorPos: number): number {
  const textBeforeCursor = text.substring(0, cursorPos);
  const lastNewline = textBeforeCursor.lastIndexOf('\n');
  return lastNewline === -1 ? cursorPos : cursorPos - lastNewline - 1;
}

export const NoteList = forwardRef<NoteListHandle, NoteListProps>(function NoteList({ notes, onEdit, onDelete, onRestore, onToggleCompleted, selectedNote, onSelectNote, onNavigateToEditor, onCreateNoteAfter }, ref) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<EditableDescriptionHandle>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [desiredColumn, setDesiredColumn] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | 'all'>('all');
  const { history } = useNoteHistory(selectedNote?.id ?? null);

  // Filter notes based on search query and category
  const filteredNotes = notes.filter((note) => {
    // Filter by category
    if (categoryFilter !== 'all' && note.category !== categoryFilter) {
      return false;
    }
    // Filter by search query
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = note.content.toLowerCase().includes(query);
    const descriptionMatch = note.description?.toLowerCase().includes(query) ?? false;
    return titleMatch || descriptionMatch;
  });

  const handleCreateNoteAfter = async (afterNoteId: string) => {
    if (!onCreateNoteAfter) return;
    const afterNote = filteredNotes.find((n) => n.id === afterNoteId);
    if (!afterNote) return;

    const newNote = await onCreateNoteAfter(afterNoteId, afterNote.category);
    // Select and focus the new note
    onSelectNote(newNote);
    setDesiredColumn(0);
    setFocusTarget('title');
  };

  const handleDeleteWithToast = (note: Note) => {
    const currentIndex = filteredNotes.findIndex((n) => n.id === note.id);

    // Determine where to navigate after deletion
    let targetNote: Note | null = null;
    let shouldNavigateToEditor = false;

    if (filteredNotes.length === 1) {
      // Last task, navigate to editor
      shouldNavigateToEditor = true;
    } else if (currentIndex > 0) {
      // Has task above, navigate to it
      targetNote = filteredNotes[currentIndex - 1];
    } else {
      // First task (no task above), navigate to task below
      targetNote = filteredNotes[currentIndex + 1];
    }

    // Delete first, then navigate
    onDelete(note.id);

    // Navigate after deletion
    if (shouldNavigateToEditor) {
      onSelectNote(null);
      onNavigateToEditor?.(0);
    } else if (targetNote) {
      onSelectNote(targetNote);
      // Position caret at end of text when navigating up, start when navigating down
      setDesiredColumn(currentIndex > 0 ? targetNote.content.length : 0);
      setFocusTarget('title');
    }

    toast(t('taskDeleted'), {
      action: {
        label: t('undo'),
        onClick: () => onRestore(note),
      },
    });
  };

  // Expose method to focus first task from parent
  useImperativeHandle(ref, () => ({
    focusFirstTaskTitle: (column?: number) => {
      if (filteredNotes.length > 0) {
        onSelectNote(filteredNotes[0]);
        setDesiredColumn(column ?? 0);
        setFocusTarget('title');
      }
    },
  }), [filteredNotes, onSelectNote]);

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
          const value = descriptionValue;
          if (focusTarget === 'description-start') {
            // Use desired column on first line
            const firstLineLength = value.indexOf('\n') === -1 ? value.length : value.indexOf('\n');
            const pos = Math.min(desiredColumn, firstLineLength);
            descriptionRef.current.setCursorPosition(pos);
          } else {
            // Use desired column on last line
            const lines = value.split('\n');
            const lastLineLength = lines[lines.length - 1].length;
            const lastLineStart = value.length - lastLineLength;
            const pos = lastLineStart + Math.min(desiredColumn, lastLineLength);
            descriptionRef.current.setCursorPosition(pos);
          }
        }
        setFocusTarget(null);
      }, 0);
    }
    // 'title' se maneja via prop shouldFocusTitle en NoteRow
  }, [focusTarget, selectedNote, desiredColumn, descriptionValue]);

  // ↓ desde título - returns true if navigation occurred
  const handleNavigateDownFromTitle = (noteId: string, column: number): boolean => {
    const note = filteredNotes.find((n) => n.id === noteId);
    if (note?.description) {
      // Ir a descripción de la misma tarea
      setDesiredColumn(column);
      setFocusTarget('description-start');
      return true;
    } else {
      // Ir a siguiente tarea
      const idx = filteredNotes.findIndex((n) => n.id === noteId);
      if (idx < filteredNotes.length - 1) {
        setDesiredColumn(column);
        onSelectNote(filteredNotes[idx + 1]);
        setFocusTarget('title');
        return true;
      }
    }
    return false;
  };

  // ↑ desde título - returns true if navigation occurred
  const handleNavigateUpFromTitle = (noteId: string, column: number): boolean => {
    const idx = filteredNotes.findIndex((n) => n.id === noteId);
    if (idx > 0) {
      setDesiredColumn(column);
      const prevNote = filteredNotes[idx - 1];
      onSelectNote(prevNote);
      setFocusTarget(prevNote.description ? 'description-end' : 'title');
      return true;
    } else if (idx === 0 && onNavigateToEditor) {
      // On first task, navigate to the editor's description
      setDesiredColumn(column);
      onSelectNote(null);
      onNavigateToEditor(column);
      return true;
    }
    return false;
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

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setDescriptionValue(selectedNote?.description || '');
      descriptionRef.current?.blur();
    } else if (e.key === 'ArrowDown' && selectedNote) {
      const selectionInfo = descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        const { cursorPosition, text } = selectionInfo;
        const textAfterCursor = text.substring(cursorPosition);
        const isOnLastLine = !textAfterCursor.includes('\n');

        if (isOnLastLine) {
          e.preventDefault();
          // Capture column position before navigating
          const column = getColumnPosition(text, cursorPosition);
          setDesiredColumn(column);
          // Save current description
          if (descriptionValue !== (selectedNote.description || '')) {
            onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
          }
          // Move to next note's title
          const currentIndex = filteredNotes.findIndex((n) => n.id === selectedNote.id);
          if (currentIndex < filteredNotes.length - 1) {
            onSelectNote(filteredNotes[currentIndex + 1]);
            setFocusTarget('title');
          }
        }
      }
    } else if (e.key === 'ArrowUp' && selectedNote) {
      const selectionInfo = descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        const { cursorPosition, text } = selectionInfo;
        const textBeforeCursor = text.substring(0, cursorPosition);
        const isOnFirstLine = !textBeforeCursor.includes('\n');

        if (isOnFirstLine) {
          e.preventDefault();
          // Capture column position before navigating
          const column = getColumnPosition(text, cursorPosition);
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
      // Don't handle if we're typing in any text input (INPUT, TEXTAREA, or contenteditable)
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable) {
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!selectedNote && filteredNotes.length > 0) {
          onSelectNote(filteredNotes[0]);
          setFocusTarget('title');
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!selectedNote && filteredNotes.length > 0) {
          onSelectNote(filteredNotes[filteredNotes.length - 1]);
          setFocusTarget('title');
        }
      } else if (e.key === 'Escape') {
        onSelectNote(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNote, filteredNotes, onSelectNote]);

  if (notes.length === 0) {
    return (
      <p className="text-center text-muted-foreground/60 py-8 text-sm italic">
        {t('noNotes')}
      </p>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden" tabIndex={0}>
      <div className="flex gap-2 mb-3 flex-shrink-0">
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchNotes')}
            className="w-full pl-7 h-7 text-xs bg-transparent border border-muted-foreground/20 rounded-md outline-none focus:border-muted-foreground/40 transition-colors"
          />
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === 'todo' ? 'all' : 'todo')}
            className={`flex items-center gap-1.5 px-2.5 h-8 text-xs rounded-md border transition-colors ${
              categoryFilter === 'todo'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
            }`}
            title={t('categoryTodo')}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>{t('categoryTodo')}</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === 'followup' ? 'all' : 'followup')}
            className={`flex items-center gap-1.5 px-2.5 h-8 text-xs rounded-md border transition-colors ${
              categoryFilter === 'followup'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
            }`}
            title={t('categoryFollowUp')}
          >
            <Forward className="h-3.5 w-3.5" />
            <span>{t('categoryFollowUp')}</span>
          </button>
        </div>
      </div>
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="w-[32rem] shrink-0 flex flex-col overflow-hidden">
          <div className="overflow-y-auto pr-2 flex-1">
        {filteredNotes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            onDeleteWithToast={handleDeleteWithToast}
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
            onCreateNoteAfter={() => handleCreateNoteAfter(note.id)}
          />
        ))}
        </div>
      </div>

      <div className="flex-1 min-w-0 border-l border-dashed border-muted-foreground/20 pl-4 overflow-hidden flex flex-col">
        {selectedNote ? (
          <>
            <h3 className={`text-sm font-medium mb-2 flex-shrink-0 ${selectedNote.completed ? 'line-through text-muted-foreground' : ''}`}>
              {selectedNote.content}
            </h3>
            <div className="flex gap-1 mb-2 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onEdit(selectedNote.id, selectedNote.content, 'todo', selectedNote.description)}
                    className={`p-1.5 rounded-md transition-colors ${
                      selectedNote.category === 'todo'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <ClipboardList className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('categoryTodo')}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onEdit(selectedNote.id, selectedNote.content, 'followup', selectedNote.description)}
                    className={`p-1.5 rounded-md transition-colors ${
                      selectedNote.category === 'followup'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Forward className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('categoryFollowUp')}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <EditableDescription
              ref={descriptionRef}
              value={descriptionValue}
              onChange={setDescriptionValue}
              onBlur={handleDescriptionBlur}
              onKeyDown={handleDescriptionKeyDown}
              placeholder={t('writeDescription')}
              className="flex-1 min-h-0 w-full text-sm bg-transparent text-muted-foreground overflow-y-auto"
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">
            {t('selectNoteToEdit')}
          </p>
        )}
      </div>

      <div className="w-48 shrink-0 border-l border-dashed border-muted-foreground/20 pl-4 overflow-y-auto">
        {selectedNote ? (
          <div className="space-y-4">
            {/* Creation date */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-1">
                <Calendar className="h-3 w-3" />
                <span>{t('createdAt')}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(selectedNote.created_at, i18n.language)}
              </p>
            </div>

            {/* Modification history */}
            {history.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-2">
                  <Clock className="h-3 w-3" />
                  <span>{t('history')}</span>
                </div>
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="text-xs border-l-2 border-muted-foreground/20 pl-2 py-1"
                    >
                      <p className="text-muted-foreground/60 mb-0.5">
                        {formatDateTime(entry.changed_at, i18n.language)}
                      </p>
                      <p className="text-muted-foreground truncate" title={entry.content}>
                        {entry.content}
                      </p>
                      {entry.description && (
                        <p className="text-muted-foreground/50 truncate text-[10px]" title={entry.description}>
                          {entry.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {history.length === 0 && (
              <p className="text-xs text-muted-foreground/50 italic">
                {t('noHistory')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">
            {t('selectNoteToEdit')}
          </p>
        )}
      </div>
      </div>
    </div>
  );
});
