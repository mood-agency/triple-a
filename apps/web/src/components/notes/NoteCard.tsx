import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CATEGORY_CONFIG } from '@/constants/notes';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { NoteEditor } from './NoteEditor';
import type { Note, NoteCategory } from '@/types/note';

interface NoteCardProps {
  note: Note;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDelete: (id: string) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
}

export function NoteCard({ note, onEdit, onDelete, onToggleCompleted }: NoteCardProps) {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSave = (content: string, category?: NoteCategory, description?: string | null) => {
    onEdit(note.id, content, category, description);
    setIsEditing(false);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onDelete(note.id);
    setShowDeleteDialog(false);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCompleted(note.id, !note.completed);
  };

  const handleCardClick = () => {
    setIsEditing(true);
  };

  const time = new Date(note.created_at).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isEditing) {
    return (
      <Card>
        <CardContent className="pt-4">
          <NoteEditor
            initialContent={note.content}
            initialDescription={note.description}
            initialCategory={note.category}
            onSave={handleSave}
            onCancel={() => setIsEditing(false)}
            autoFocus
          />
        </CardContent>
      </Card>
    );
  }

  const isTask = CATEGORY_CONFIG[note.category].allowsCheckbox;

  return (
    <>
      <Card
        className={`group cursor-pointer transition-colors hover:bg-accent/50 ${note.completed && isTask ? 'opacity-60' : ''}`}
        onClick={handleCardClick}
      >
        <CardContent className="pt-4">
          <div className="flex gap-3">
            {isTask && (
              <Checkbox
                checked={note.completed}
                onClick={handleToggle}
                className="mt-1"
              />
            )}
            <div className="flex-1">
              <p className={`whitespace-pre-wrap ${note.completed && isTask ? 'line-through text-muted-foreground' : ''}`}>
                {note.content}
              </p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-muted-foreground">{time}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={handleDeleteClick}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteNote')}</DialogTitle>
            <DialogDescription>{t('confirmDelete')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
