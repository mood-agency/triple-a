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
import { Checkbox } from '@/components/ui/checkbox';

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
  const [skipReason, setSkipReason] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Focus textarea when dialog opens
  React.useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open]);

  const handlePostpone = () => {
    if (!initialDate) return;
    // Allow empty reason if skipReason is checked
    if (!skipReason && !reason.trim()) return;
    // Use ISO string to preserve both date and time
    onPostpone(initialDate.toISOString(), skipReason ? '' : reason.trim());
    handleClose();
  };

  const handleClose = () => {
    setReason('');
    setSkipReason(false);
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
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
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

          {/* Reason */}
          <div>
            <label className="text-sm text-muted-foreground" htmlFor="postpone-reason">
              {t('postponeReason')}
            </label>
            <textarea
              ref={textareaRef}
              id="postpone-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('postponeReasonPlaceholder')}
              className="mt-1 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground caret-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
              disabled={skipReason}
            />
          </div>

          {/* Checkbox to skip reason */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="skip-reason"
              checked={skipReason}
              onCheckedChange={(checked) => setSkipReason(checked === true)}
            />
            <label
              htmlFor="skip-reason"
              className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              {t('skipPostponeReason')}
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handlePostpone} disabled={!initialDate || (!skipReason && !reason.trim())}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
