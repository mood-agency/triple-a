import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, X, CloudUpload, CloudDownload, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSync } from '@/contexts/SyncContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface HotkeyItem {
  keys: string[];
  action: string;
}

interface HotkeySection {
  title: string;
  items: HotkeyItem[];
}

export function HotkeysHelper() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { pushAllToSupabase, pullAllFromSupabase, isPushingAll, isPullingAll, connectionStatus } = useSync();
  const [isOpen, setIsOpen] = useState(false);
  const [showPushConfirmDialog, setShowPushConfirmDialog] = useState(false);
  const [showPullConfirmDialog, setShowPullConfirmDialog] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; item: string } | null>(null);
  const [pushComplete, setPushComplete] = useState(false);
  const [pullComplete, setPullComplete] = useState(false);

  const handlePushAll = async () => {
    setShowPushConfirmDialog(false);
    setSyncProgress({ current: 0, total: 0, item: '' });
    setPushComplete(false);

    const result = await pushAllToSupabase((progress) => {
      setSyncProgress(progress);
    });

    setSyncProgress(null);

    if (result.success) {
      setPushComplete(true);
      setTimeout(() => setPushComplete(false), 2000);
      toast.success(t('sync.pushAll'), {
        description: t('sync.pushSuccess', {
          notes: result.pushed.notes,
          labels: result.pushed.labels,
          noteLabels: result.pushed.noteLabels,
          history: result.pushed.noteHistory,
        }),
      });
    } else {
      toast.error(t('sync.pushError'), {
        description: result.error,
      });
    }
  };

  const handlePullAll = async () => {
    setShowPullConfirmDialog(false);
    setSyncProgress({ current: 0, total: 0, item: '' });
    setPullComplete(false);

    const result = await pullAllFromSupabase((progress) => {
      setSyncProgress(progress);
    });

    setSyncProgress(null);

    if (result.success) {
      setPullComplete(true);
      setTimeout(() => {
        setPullComplete(false);
        // Reload to show new data
        window.location.reload();
      }, 1500);
      toast.success(t('sync.pullAll'), {
        description: t('sync.pullSuccess', {
          notes: result.pulled.notes,
          labels: result.pulled.labels,
          noteLabels: result.pulled.noteLabels,
        }),
      });
    } else {
      toast.error(t('sync.pullError'), {
        description: result.error,
      });
    }
  };

  const canPush = user && connectionStatus === 'online' && !isPushingAll && !isPullingAll;
  const canPull = user && connectionStatus === 'online' && !isPushingAll && !isPullingAll;

  const sections: HotkeySection[] = [
    {
      title: t('hotkeys.global'),
      items: [
        { keys: ['Ctrl', 'K'], action: t('hotkeys.openCommandPalette') },
        { keys: ['Ctrl', 'F'], action: t('hotkeys.focusSearch') },
        { keys: ['Alt', 'Q'], action: t('hotkeys.filterTodo') },
        { keys: ['Alt', 'W'], action: t('hotkeys.filterFollowup') },
        { keys: ['Alt', 'E'], action: t('hotkeys.filterNotes') },
        { keys: ['Alt', 'R'], action: t('hotkeys.filterMeeting') },
        { keys: ['Alt', 'C'], action: t('hotkeys.clearFilters') },
        { keys: ['Esc'], action: t('hotkeys.deselectTask') },
      ],
    },
    {
      title: t('hotkeys.taskTitle'),
      items: [
        { keys: ['↑', '↓'], action: t('hotkeys.navigateTasks') },
        { keys: ['Enter'], action: t('hotkeys.createTask') },
        { keys: ['Tab'], action: t('hotkeys.goToDescription') },
        { keys: ['Backspace'], action: t('hotkeys.deleteEmpty') },
        { keys: ['Ctrl', 'D'], action: t('hotkeys.toggleComplete') },
        { keys: ['Ctrl', 'Backspace'], action: t('hotkeys.deleteTask') },
        { keys: ['Ctrl', 'L'], action: t('hotkeys.openLabels') },
        { keys: ['Ctrl', 'C'], action: t('hotkeys.openCategories') },
        { keys: ['Ctrl', 'T'], action: t('hotkeys.openDeadline') },
      ],
    },
    {
      title: t('hotkeys.description'),
      items: [
        { keys: ['Shift', 'Tab'], action: t('hotkeys.backToTitle') },
      ],
    },
  ];

  return (
    <>
      {/* Floating buttons container */}
      <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
        {/* Pull from cloud button - only show if user is logged in */}
        {user && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowPullConfirmDialog(true)}
            disabled={!canPull}
            className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            title={t('sync.pullAll')}
          >
            {isPullingAll ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : pullComplete ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <CloudDownload className="h-5 w-5" />
            )}
          </Button>
        )}

        {/* Push to cloud button - only show if user is logged in */}
        {user && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowPushConfirmDialog(true)}
            disabled={!canPush}
            className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
            title={t('sync.pushAll')}
          >
            {isPushingAll ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : pushComplete ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : (
              <CloudUpload className="h-5 w-5" />
            )}
          </Button>
        )}

        {/* Hotkeys button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
          title={t('hotkeys.title')}
        >
          <Keyboard className="h-5 w-5" />
        </Button>
      </div>

      {/* Hotkeys panel */}
      {isOpen && (
        <div className="fixed bottom-28 right-4 w-80 max-h-[70vh] overflow-y-auto rounded-lg border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-lg z-50">
          <div className="sticky top-0 flex items-center justify-between p-3 border-b bg-background/95 backdrop-blur">
            <h3 className="font-semibold text-sm">{t('hotkeys.title')}</h3>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-md hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-3 space-y-4">
            {sections.map((section) => (
              <div key={section.title}>
                <h4 className="text-xs font-medium text-muted-foreground mb-2">
                  {section.title}
                </h4>
                <div className="space-y-1.5">
                  {section.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-muted-foreground">{item.action}</span>
                      <div className="flex gap-1">
                        {item.keys.map((key, keyIndex) => (
                          <kbd
                            key={keyIndex}
                            className="px-1.5 py-0.5 text-xs font-mono bg-muted rounded border border-muted-foreground/20"
                          >
                            {key}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sync progress indicator */}
      {syncProgress && (
        <div className="fixed bottom-28 right-4 w-64 rounded-lg border bg-background/95 backdrop-blur shadow-lg z-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">
              {isPushingAll ? t('sync.pushing') : t('sync.pulling')}
            </span>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {syncProgress.item}
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {syncProgress.current} / {syncProgress.total}
          </div>
        </div>
      )}

      {/* Push confirmation dialog */}
      <Dialog open={showPushConfirmDialog} onOpenChange={setShowPushConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sync.pushAll')}</DialogTitle>
            <DialogDescription>
              {t('sync.pushAllConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPushConfirmDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handlePushAll}>
              {t('sync.pushAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pull confirmation dialog */}
      <Dialog open={showPullConfirmDialog} onOpenChange={setShowPullConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sync.pullAll')}</DialogTitle>
            <DialogDescription>
              {t('sync.pullAllConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPullConfirmDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handlePullAll}>
              {t('sync.pullAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
