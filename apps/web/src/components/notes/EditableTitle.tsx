import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { getCursorPosition, getFontString } from '@/utils/cursorUtils';
import { useAutoSave } from '@/hooks/useAutoSave';

interface EditableTitleProps {
  noteId: string;
  content: string;
  completed: boolean;
  onEdit: (id: string, content: string) => void;
  onToggleComplete: (id: string) => void;
  onDelete?: () => void;
  titleValue?: string;
  autoSaveInterval?: number; // in seconds, 0 = disabled
}

export function EditableTitle({
  noteId,
  content,
  completed,
  onEdit,
  onToggleComplete,
  onDelete,
  titleValue,
  autoSaveInterval = 3,
}: EditableTitleProps) {
  const { t } = useTranslation();
  // Don't auto-start editing - let the NoteRow handle focus for new tasks
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(titleValue ?? content);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickXRef = useRef<number | null>(null);
  const ignoreBlurRef = useRef(false);

  // Auto-save for title while editing
  const autoSave = useAutoSave({
    value: editedTitle,
    originalValue: titleValue ?? content,
    onSave: (value) => {
      if (value.trim()) {
        onEdit(noteId, value.trim());
      }
    },
    debounceMs: autoSaveInterval * 1000,
    enabled: isEditing && autoSaveInterval > 0,
  });

  // Track noteId to detect when we switch notes
  const prevNoteIdRef = useRef(noteId);

  // Sync editedTitle when note changes (but not while editing)
  useEffect(() => {
    const noteIdChanged = prevNoteIdRef.current !== noteId;
    prevNoteIdRef.current = noteId;

    if (noteIdChanged) {
      // Note changed - reset everything
      setEditedTitle(titleValue ?? content);
      setIsEditing(false);
    } else if (!isEditing) {
      // Same note, not editing - sync with store
      setEditedTitle(titleValue ?? content);
    }
  }, [noteId, content, titleValue, isEditing]);

  // Focus input and set cursor position when user clicks to edit
  useEffect(() => {
    if (isEditing && inputRef.current) {
      const input = inputRef.current;
      const pos = clickXRef.current;
      clickXRef.current = null;

      // Focus first
      input.focus();

      // Set cursor position with multiple attempts to ensure it sticks
      if (pos !== null) {
        // Immediate attempt
        input.setSelectionRange(pos, pos);

        // Backup attempts with setTimeout
        setTimeout(() => {
          input.setSelectionRange(pos, pos);
        }, 0);

        setTimeout(() => {
          input.setSelectionRange(pos, pos);
        }, 10);
      }
    }
  }, [isEditing]);



  // ...

  const handleTitleClick = (e: React.MouseEvent<HTMLHeadingElement>) => {
    const h1 = e.currentTarget;
    const rect = h1.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const text = titleValue ?? content;

    const style = window.getComputedStyle(h1);
    const fontString = getFontString(style);

    // Use shared utility
    const calculatedPos = getCursorPosition(text, fontString, clickX);

    clickXRef.current = calculatedPos;
    setIsEditing(true);
  };

  const handleInputFocus = () => {
    // Position is now handled in useEffect after isEditing changes
  };

  const handleSave = () => {
    const originalValue = titleValue ?? content;
    if (editedTitle.trim() && editedTitle !== originalValue) {
      onEdit(noteId, editedTitle.trim());
    } else {
      setEditedTitle(originalValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Prevent Alt+key combinations from causing blur due to Windows menu activation
    if (e.altKey && e.key !== 'Alt') {
      e.preventDefault();
      e.stopPropagation();
      ignoreBlurRef.current = true;
      // Re-focus the input after a short delay to counteract any focus loss
      setTimeout(() => {
        ignoreBlurRef.current = false;
        inputRef.current?.focus();
      }, 10);
      return;
    }
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditedTitle(content);
      setIsEditing(false);
    }
  };

  return (
    <div className="group flex items-start gap-3 flex-shrink-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="pt-1.5">
            <Checkbox
              checked={completed}
              onCheckedChange={() => onToggleComplete(noteId)}
              className="h-5 w-5"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent className="flex items-center gap-2">
          <p>{completed ? t('markIncomplete') : t('markComplete')}</p>
          <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>D</Kbd></span>
        </TooltipContent>
      </Tooltip>
      <div className="flex items-start gap-1 flex-1 min-w-0">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={() => {
              // Ignore blur if it was caused by Alt+key combination
              if (ignoreBlurRef.current) return;
              // Flush any pending auto-save
              autoSave.handleBlur();
              handleSave();
            }}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}

            className={`w-full text-2xl font-semibold bg-transparent border-none outline-none placeholder:text-muted-foreground/50 ${completed ? 'line-through text-muted-foreground' : ''}`}
          />
        ) : (
          <h1
            onClick={handleTitleClick}
            className={`text-2xl font-semibold cursor-text ${completed ? 'line-through text-muted-foreground' : ''} ${!(titleValue ?? content) ? 'text-muted-foreground/50' : ''}`}
          >
            {(titleValue ?? content) || t('newTaskPlaceholder')}
          </h1>
        )}
        {onDelete && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all shrink-0"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('deleteTask')}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
