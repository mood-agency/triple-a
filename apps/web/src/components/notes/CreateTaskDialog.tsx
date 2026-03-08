import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { parseHashtags, type HashtagParseResult } from '@/utils/hashtagParser';

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with parsed result from hashtag/mention parsing */
  onCreateTask: (parsed: HashtagParseResult) => void;
  labels: Label[];
  contacts: Contact[];
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onCreateTask,
  labels,
  contacts,
}: CreateTaskDialogProps) {
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset and focus when dialog opens
  useEffect(() => {
    if (open) {
      setContent('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed) return;

    // Parse @mentions and #hashtags from the title
    const parsed = parseHashtags(trimmed, { labels, contacts });

    onCreateTask(parsed);
    setContent('');
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Prevent keyboard events inside the dialog from reaching global hotkeys
  // (e.g. Tab triggering useHotkeys navigation, which would close the dialog)
  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.stopPropagation();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()} onKeyDown={handleDialogKeyDown}>
        <DialogHeader>
          <DialogTitle>{t('createTaskDialog.title')}</DialogTitle>
          <DialogDescription>{t('createTaskDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('createTaskDialog.placeholder')}
            className="w-full px-3 py-2 text-sm border border-muted-foreground/20 rounded-md bg-transparent focus:outline-none focus:border-muted-foreground/40 text-foreground caret-foreground"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={!content.trim()}>
            {t('create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
