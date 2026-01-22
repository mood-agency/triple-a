import { useState, useRef, useEffect, forwardRef, useImperativeHandle, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check, Pickaxe, Forward, StickyNote, Users } from 'lucide-react';
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
  onNavigateDown?: (column: number) => void;
}

// Helper to get column position (position within current line)
function getColumnPosition(text: string, cursorPos: number): number {
  const textBeforeCursor = text.substring(0, cursorPos);
  const lastNewline = textBeforeCursor.lastIndexOf('\n');
  return lastNewline === -1 ? cursorPos : cursorPos - lastNewline - 1;
}

// Combina título y descripción en un solo texto (título en primera línea)
function combineText(title: string, description: string | null): string {
  if (description) {
    return `${title}\n${description}`;
  }
  return title;
}

// Separa el texto en título (primera línea) y descripción (resto)
function splitText(text: string): { title: string; description: string | null } {
  const lines = text.split('\n');
  const title = lines[0] || '';
  const description = lines.slice(1).join('\n').trim() || null;
  return { title, description };
}

// Get icon for category
function getCategoryIcon(category: NoteCategory) {
  switch (category) {
    case 'todo':
      return <Pickaxe className="h-4 w-4" />;
    case 'followup':
      return <Forward className="h-4 w-4" />;
    case 'notes':
      return <StickyNote className="h-4 w-4" />;
    case 'meeting':
      return <Users className="h-4 w-4" />;
  }
}

export interface NoteEditorHandle {
  focusDescription: (column?: number) => void;
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(function NoteEditor({
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
}, ref) {
  const { t } = useTranslation();
  const [text, setText] = useState(() => combineText(initialContent, initialDescription));
  const [category, setCategory] = useState<NoteCategory>(initialCategory);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Expose focusDescription method to parent
  useImperativeHandle(ref, () => ({
    focusDescription: (column?: number) => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Move cursor to second line (description area) at desired column
        const firstLineEnd = text.indexOf('\n');
        if (firstLineEnd !== -1) {
          // Description exists, go to last line at desired column
          const lines = text.split('\n');
          const lastLineLength = lines[lines.length - 1].length;
          const lastLineStart = text.length - lastLineLength;
          const pos = lastLineStart + Math.min(column ?? 0, lastLineLength);
          textareaRef.current.setSelectionRange(pos, pos);
        } else {
          // If no description yet, add newline and focus there
          setText(text + '\n');
          setTimeout(() => {
            if (textareaRef.current) {
              const pos = text.length + 1;
              textareaRef.current.setSelectionRange(pos, pos);
            }
          }, 0);
        }
      }
    },
  }), [text]);

  useEffect(() => {
    if (autoFocus) {
      if (inline && inputRef.current) {
        inputRef.current.focus();
      } else if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [autoFocus, inline]);

  const handleSave = () => {
    const { title, description } = splitText(text);
    if (title.trim()) {
      onSave(title.trim(), category, description);
      if (!inline) {
        setText('');
        setCategory('todo');
      }
    } else if (inline && onCancel) {
      onCancel();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'ArrowUp' && onNavigateUp) {
      // Only navigate up if on the first line
      const textarea = textareaRef.current;
      if (textarea) {
        const { selectionStart, value } = textarea;
        const textBeforeCursor = value.substring(0, selectionStart);
        const isOnFirstLine = !textBeforeCursor.includes('\n');
        if (isOnFirstLine) {
          e.preventDefault();
          handleSave();
          onNavigateUp();
        }
      }
    } else if (e.key === 'ArrowDown' && onNavigateDown) {
      // Only navigate down if on the last line
      const textarea = textareaRef.current;
      if (textarea) {
        const { selectionStart, value } = textarea;
        const textAfterCursor = value.substring(selectionStart);
        const isOnLastLine = !textAfterCursor.includes('\n');
        if (isOnLastLine) {
          e.preventDefault();
          const column = getColumnPosition(value, selectionStart);
          handleSave();
          onNavigateDown(column);
        }
      }
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
      const column = inputRef.current?.selectionStart ?? 0;
      handleSave();
      onNavigateDown(column);
    }
  };

  if (inline) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleInputKeyDown}
        onBlur={handleSave}
        className="flex-1 bg-transparent text-sm leading-relaxed outline-none border-none focus:ring-0 p-0 m-0 w-full"
        placeholder={t('writeNote')}
      />
    );
  }

  const { title } = splitText(text);

  const categories: { value: NoteCategory; label: string }[] = [
    { value: 'todo', label: t('categoryTodo') },
    { value: 'followup', label: t('categoryFollowUp') },
    { value: 'notes', label: t('categoryNotes') },
    { value: 'meeting', label: t('categoryMeeting') },
  ];

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">{t('newTask')}</h1>
      {showCategorySelector && (
        <Popover open={showCategoryDropdown} onOpenChange={(open) => {
          setShowCategoryDropdown(open);
          if (!open) {
            textareaRef.current?.focus();
          }
        }}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-[200px] justify-start text-left font-normal"
            >
              <span className="flex items-center gap-2">
                {getCategoryIcon(category)}
                {categories.find(cat => cat.value === category)?.label}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandInput placeholder={t('searchCategory')} className="h-9" />
              <CommandList>
                <CommandEmpty>{t('noCategoriesFound')}</CommandEmpty>
                <CommandGroup>
                  {categories.map((cat) => (
                    <CommandItem
                      key={cat.value}
                      value={cat.value}
                      onSelect={() => {
                        setCategory(cat.value);
                        setShowCategoryDropdown(false);
                      }}
                      className="flex items-center gap-2"
                    >
                      {getCategoryIcon(cat.value)}
                      {cat.label}
                      {category === cat.value && <Check className="h-4 w-4 ml-auto" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}
      <Textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`${t('writeNote')}\n${t('writeDescription')}`}
        className="min-h-[100px] resize-none text-sm"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSave} disabled={!title.trim()}>
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
});
