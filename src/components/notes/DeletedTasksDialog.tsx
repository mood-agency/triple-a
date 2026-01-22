import * as React from 'react';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDeletedNotes } from '@/hooks/useDeletedNotes';
import { useDatabase } from '@/contexts/DatabaseContext';
import { persistDatabase } from '@/db';
import { useSync } from '@/contexts/SyncContext';
import type { Note } from '@/types/note';

interface DeletedTasksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestore: (note: Note) => Promise<void>;
}

// PERFORMANCE: Memoize to prevent unnecessary re-renders
export const DeletedTasksDialog = memo(function DeletedTasksDialog({
  open,
  onOpenChange,
  onRestore,
}: DeletedTasksDialogProps) {
  const { t } = useTranslation();
  const { db } = useDatabase();
  const { queueOperation } = useSync();
  const { deletedNotes, refresh } = useDeletedNotes();
  const [confirmDelete, setConfirmDelete] = React.useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = React.useState(false);

  // Refresh list when dialog opens
  React.useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  const handleRestore = async (note: Note) => {
    await onRestore(note);
    refresh();
  };

  const handlePermanentDelete = async (id: string) => {
    if (!db) return;

    db.run('DELETE FROM notes WHERE id = ?', [id]);
    await persistDatabase();
    await queueOperation('notes', 'delete', id);
    refresh();
    setConfirmDelete(null);
  };

  const handleDeleteAll = async () => {
    if (!db) return;

    for (const note of deletedNotes) {
      db.run('DELETE FROM notes WHERE id = ?', [note.id]);
      await queueOperation('notes', 'delete', note.id);
    }
    await persistDatabase();
    refresh();
    setConfirmDeleteAll(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {t('trash.title')}
            </DialogTitle>
            <DialogDescription>
              {deletedNotes.length > 0
                ? `${deletedNotes.length} ${deletedNotes.length === 1 ? 'task' : 'tasks'}`
                : t('trash.empty')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
            {deletedNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Trash2 className="h-12 w-12 mb-2 opacity-20" />
                <p>{t('trash.empty')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {deletedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{note.content || '(empty)'}</p>
                      {note.deleted_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t('trash.deletedAt')}: {format(new Date(note.deleted_at), 'PPp')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRestore(note)}
                        title={t('trash.restore')}
                      >
                        <RotateCcw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setConfirmDelete(note.id)}
                        title={t('trash.deletePermanently')}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {deletedNotes.length > 0 && (
            <div className="flex justify-end pt-4 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDeleteAll(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('trash.deleteAll')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm single delete */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('trash.deletePermanently')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('trash.confirmDeletePermanently')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && handlePermanentDelete(confirmDelete)}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm delete all */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {t('trash.deleteAll')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('trash.confirmDeleteAll')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteAll}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
