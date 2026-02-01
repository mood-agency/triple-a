import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import type { FilterCommand } from './commands/types';

interface UndoRedoIndicatorProps {
  canUndo: boolean;
  canRedo: boolean;
  lastCommand: FilterCommand | null;
  onUndo: () => void;
  onRedo: () => void;
}

export function UndoRedoIndicator({
  canUndo,
  canRedo,
  lastCommand,
  onUndo,
  onRedo,
}: UndoRedoIndicatorProps) {
  const { t } = useTranslation();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Show toast when last command changes
  useEffect(() => {
    if (lastCommand) {
      setToastMessage(lastCommand.description);
      setShowToast(true);
      const timeout = setTimeout(() => setShowToast(false), 3000);
      return () => clearTimeout(timeout);
    }
  }, [lastCommand?.timestamp]);

  return (
    <>
      {/* Undo/Redo buttons */}
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onUndo}
              disabled={!canUndo}
              aria-label={t('undo')}
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            <p>{t('undoFilterChange')}</p>
            <span className="flex items-center gap-0.5">
              <Kbd>Ctrl</Kbd>
              <Kbd>Z</Kbd>
            </span>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRedo}
              disabled={!canRedo}
              aria-label={t('redo')}
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            <p>{t('redoFilterChange')}</p>
            <span className="flex items-center gap-0.5">
              <Kbd>Ctrl</Kbd>
              <Kbd>Shift</Kbd>
              <Kbd>Z</Kbd>
            </span>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Toast notification for filter changes */}
      <AnimatePresence>
        {showToast && canUndo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-3 px-4 py-2 bg-background border rounded-lg shadow-lg">
              <span className="text-sm text-muted-foreground">{toastMessage}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onUndo();
                  setShowToast(false);
                }}
                className="text-primary hover:text-primary"
              >
                <Undo2 className="h-3 w-3 mr-1" />
                {t('undo')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
