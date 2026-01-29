import * as React from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DeleteReason = 'not_relevant' | 'duplicate' | 'other';

interface DeleteTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  taskContent: string;
}

export const DeleteTaskDialog = memo(function DeleteTaskDialog({
  open,
  onOpenChange,
  onConfirm,
  taskContent,
}: DeleteTaskDialogProps) {
  const { t } = useTranslation();
  const [selectedReason, setSelectedReason] = React.useState<DeleteReason | null>(null);
  const [customReason, setCustomReason] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Reset selection when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedReason(null);
      setCustomReason('');
    }
  }, [open]);

  // Focus textarea when "other" is selected
  React.useEffect(() => {
    if (selectedReason === 'other' && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [selectedReason]);

  const handleConfirm = () => {
    if (!selectedReason) return;
    const reason = selectedReason === 'other' ? customReason.trim() : selectedReason;
    if (!reason) return;
    onConfirm(reason);
    handleClose();
  };

  const handleClose = () => {
    setSelectedReason(null);
    setCustomReason('');
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleConfirm();
    }
  };

  const reasons: { value: DeleteReason; label: string }[] = [
    { value: 'not_relevant', label: t('deleteTaskDialog.notRelevant') },
    { value: 'duplicate', label: t('deleteTaskDialog.duplicate') },
    { value: 'other', label: t('deleteTaskDialog.other') },
  ];

  const isConfirmDisabled = !selectedReason || (selectedReason === 'other' && !customReason.trim());

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            {t('deleteTaskDialog.title')}
          </DialogTitle>
          <DialogDescription className="truncate" title={taskContent}>
            {taskContent}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {reasons.map((reason) => (
            <button
              key={reason.value}
              type="button"
              onClick={() => setSelectedReason(reason.value)}
              className={cn(
                'w-full text-left px-4 py-3 rounded-md border transition-colors',
                'hover:bg-muted/50',
                selectedReason === reason.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-foreground'
              )}
            >
              {reason.label}
            </button>
          ))}

          {selectedReason === 'other' && (
            <textarea
              ref={textareaRef}
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('deleteTaskDialog.otherPlaceholder')}
              className="mt-2 w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground caret-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              rows={3}
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
          >
            {t('deleteTaskDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
