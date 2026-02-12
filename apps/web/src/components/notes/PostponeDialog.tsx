import * as React from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { CalendarClock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

interface PostponeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostpone: (newDeadline: string, reason: string) => void;
  taskContent: string;
  initialDate?: Date | null;
}

// PERFORMANCE: Memoize to prevent unnecessary re-renders
export const PostponeDialog = memo(function PostponeDialog({
  open,
  onOpenChange,
  onPostpone,
  taskContent,
  initialDate,
}: PostponeDialogProps) {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = React.useState('');
  const [hasReason, setHasReason] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Focus textarea when switch is turned on
  React.useEffect(() => {
    if (hasReason && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [hasReason]);

  const handlePostpone = () => {
    if (!initialDate) return;
    if (hasReason && !reason.trim()) return;
    onPostpone(initialDate.toISOString(), hasReason ? reason.trim() : '');
    handleClose();
  };

  const handleClose = () => {
    setReason('');
    setHasReason(false);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handlePostpone();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md [&>button:last-child]:hidden" onInteractOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            {t('postponeTask')}
          </DialogTitle>
          <DialogDescription className="truncate" title={taskContent}>
            {taskContent}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Show the new deadline as read-only info */}
          {initialDate && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
              <CalendarClock className="h-4 w-4" />
              <span>{t('newDeadline')}:</span>
              <span className="font-medium text-foreground">
                {format(initialDate, 'EEEE, d MMMM yyyy, HH:mm', { locale: i18n.language === 'es' ? undefined : undefined })}
              </span>
            </div>
          )}

          {/* Switch to toggle reason */}
          <div className="flex items-center justify-between">
            <label
              htmlFor="has-reason"
              className="text-sm cursor-pointer"
            >
              {t('hasPostponeReason')}
            </label>
            <Switch
              id="has-reason"
              checked={hasReason}
              onCheckedChange={setHasReason}
            />
          </div>

          {/* Reason textarea (visible only when switch is on) */}
          {hasReason && (
            <div>
              <textarea
                ref={textareaRef}
                id="postpone-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('postponeReasonPlaceholder')}
                className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground caret-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handlePostpone} disabled={!initialDate || (hasReason && !reason.trim())}>
            {t('accept')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
