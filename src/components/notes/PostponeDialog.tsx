import * as React from 'react';
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

interface PostponeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostpone: (newDeadline: string, reason: string) => void;
  taskContent: string;
  initialDate?: Date | null;
}

export function PostponeDialog({
  open,
  onOpenChange,
  onPostpone,
  taskContent,
  initialDate,
}: PostponeDialogProps) {
  const { t, i18n } = useTranslation();
  const [reason, setReason] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Focus textarea when dialog opens
  React.useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [open]);

  const handlePostpone = () => {
    if (!initialDate || !reason.trim()) return;
    // Use date-fns format to ensure the saved date matches the displayed date
    const dateStr = format(initialDate, 'yyyy-MM-dd');
    onPostpone(dateStr, reason.trim());
    handleClose();
  };

  const handleClose = () => {
    setReason('');
    onOpenChange(false);
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
                {format(initialDate, 'EEEE, d MMMM yyyy', { locale: i18n.language === 'es' ? undefined : undefined })}
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
              placeholder={t('postponeReasonPlaceholder')}
              className="mt-1 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handlePostpone} disabled={!initialDate || !reason.trim()}>
            {t('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
