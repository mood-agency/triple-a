import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';

interface EditableTitleProps {
  noteId: string;
  content: string;
  completed: boolean;
  onEdit: (id: string, content: string) => void;
  onToggleComplete: (id: string) => void;
  onDelete: () => void;
  titleValue?: string;
}

export function EditableTitle({
  noteId,
  content,
  completed,
  onEdit,
  onToggleComplete,
  onDelete,
  titleValue,
}: EditableTitleProps) {
  const { t } = useTranslation();
  // Don't auto-start editing - let the NoteRow handle focus for new tasks
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(titleValue ?? content);
  const inputRef = useRef<HTMLInputElement>(null);
  const clickXRef = useRef<number | null>(null);
  const ignoreBlurRef = useRef(false);

  // Sync editedTitle when note changes
  useEffect(() => {
    setEditedTitle(titleValue ?? content);
    setIsEditing(false);
  }, [noteId, content, titleValue]);

  // Focus input when user clicks to edit (not on mount)
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleTitleClick = (e: React.MouseEvent<HTMLHeadingElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    clickXRef.current = e.clientX - rect.left;
    setIsEditing(true);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (clickXRef.current !== null) {
      const clickX = clickXRef.current;
      clickXRef.current = null;
      const input = e.target as HTMLInputElement;
      const text = input.value;

      if (text.length === 0 || clickX <= 0) {
        input.setSelectionRange(0, 0);
        return;
      }

      // Create canvas with input's font to measure text
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const style = window.getComputedStyle(input);
        ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

        // Find the position where click occurred
        let pos = text.length;
        for (let i = 1; i <= text.length; i++) {
          const width = ctx.measureText(text.substring(0, i)).width;
          if (width >= clickX) {
            const prevWidth = ctx.measureText(text.substring(0, i - 1)).width;
            pos = (clickX - prevWidth) <= (width - clickX) ? i - 1 : i;
            break;
          }
        }
        input.setSelectionRange(pos, pos);
      }
    }
  };

  const handleSave = () => {
    if (editedTitle.trim() && editedTitle !== content) {
      onEdit(noteId, editedTitle.trim());
    } else {
      setEditedTitle(content);
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
              handleSave();
            }}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            placeholder={t('newTaskPlaceholder')}
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
      </div>
    </div>
  );
}
