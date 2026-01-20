import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Textarea } from '@/components/ui/textarea';
import type { NoteCategory } from '@/types/note';

interface NoteEditorProps {
  onSave: (content: string, category?: NoteCategory, description?: string | null) => void;
  initialContent?: string;
  initialDescription?: string | null;
  initialCategory?: NoteCategory;
  onCancel?: () => void;
  autoFocus?: boolean;
  showCategorySelector?: boolean;
  inline?: boolean;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
}

export function NoteEditor({
  onSave,
  initialContent = '',
  initialDescription = null,
  initialCategory = 'todo',
  onCancel,
  autoFocus = false,
  showCategorySelector = true,
  inline = false,
  onNavigateUp,
  onNavigateDown,
}: NoteEditorProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState(initialContent);
  const [description, setDescription] = useState(initialDescription || '');
  const [category, setCategory] = useState<NoteCategory>(initialCategory);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      if (inline && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      } else if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.select();
      }
    }
  }, [autoFocus, inline]);

  const handleSave = () => {
    if (content.trim()) {
      onSave(content.trim(), category, description.trim() || null);
      if (!inline) {
        setContent('');
        setDescription('');
        setCategory('todo');
      }
    } else if (inline && onCancel) {
      onCancel();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'ArrowUp' && onNavigateUp) {
      e.preventDefault();
      handleSave();
      onNavigateUp();
    } else if (e.key === 'ArrowDown' && onNavigateDown) {
      e.preventDefault();
      handleSave();
      onNavigateDown();
    }
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'ArrowUp' && onNavigateUp) {
      e.preventDefault();
      handleSave();
      onNavigateUp();
    } else if (e.key === 'ArrowDown' && onNavigateDown) {
      e.preventDefault();
      handleSave();
      onNavigateDown();
    }
  };

  if (inline) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleInputKeyDown}
        onBlur={handleSave}
        className="flex-1 bg-transparent text-sm leading-relaxed outline-none border-none focus:ring-0 p-0 m-0 w-full"
        placeholder={t('writeNote')}
      />
    );
  }

  return (
    <div className="space-y-3">
      {showCategorySelector && (
        <div className="flex gap-2">
          <Chip
            type="button"
            variant={category === 'todo' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory('todo')}
          >
            {t('categoryTodo')}
          </Chip>
          <Chip
            type="button"
            variant={category === 'followup' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategory('followup')}
          >
            {t('categoryFollowUp')}
          </Chip>
        </div>
      )}
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('writeNote')}
        className="min-h-[60px] resize-none text-sm"
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('writeDescription')}
        className="min-h-[40px] resize-none text-sm text-muted-foreground"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={!content.trim()}>
          {t('save')}
        </Button>
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t('cancel')}
          </Button>
        )}
      </div>
    </div>
  );
}
