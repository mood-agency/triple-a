import { useState, useRef, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotes } from '@/hooks/useNotes';
import { useLabels } from '@/hooks/useLabels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import {
  Plus,
  Check,
  ListTodo,
  Clock,
  FileText,
  Users,
  ChevronLeft,
  Calendar,
  Tag,
  Trash2,
  X,
  ArrowLeft,
} from 'lucide-react';
import type { Note, NoteCategory } from '@/types/note';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const CATEGORY_ICONS: Record<NoteCategory, React.ReactNode> = {
  todo: <ListTodo className="h-4 w-4" />,
  followup: <Clock className="h-4 w-4" />,
  notes: <FileText className="h-4 w-4" />,
  meeting: <Users className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<NoteCategory, string> = {
  todo: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  followup: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
  notes: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  meeting: 'bg-green-500/10 text-green-600 dark:text-green-400',
};

export function Tasks() {
  const { t } = useTranslation();
  const {
    notes,
    loading,
    createNote,
    updateNote,
    toggleCompleted,
    deleteNote,
  } = useNotes();
  const { labels, getLabelsForNote } = useLabels();

  // State
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory | 'all'>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [newTaskContent, setNewTaskContent] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState<NoteCategory>('todo');

  const inputRef = useRef<HTMLInputElement>(null);

  // Filter notes
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      // Filter by category
      if (selectedCategory !== 'all' && note.category !== selectedCategory) {
        return false;
      }
      // Filter completed
      if (!showCompleted && note.completed) {
        return false;
      }
      return true;
    });
  }, [notes, selectedCategory, showCompleted]);

  // Group notes: pinned first, then by completion
  const groupedNotes = useMemo(() => {
    const pinned = filteredNotes.filter((n) => n.pinned && !n.completed);
    const active = filteredNotes.filter((n) => !n.pinned && !n.completed);
    const completed = filteredNotes.filter((n) => n.completed);
    return { pinned, active, completed };
  }, [filteredNotes]);

  // Focus input when creating
  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Create task handler
  const handleCreateTask = async () => {
    if (!newTaskContent.trim()) return;

    await createNote(newTaskContent.trim(), selectedCategory === 'all' ? 'todo' : selectedCategory);
    setNewTaskContent('');
    setIsCreating(false);
    toast.success(t('toast.noteCreated'));
  };

  // Toggle completion handler
  const handleToggleComplete = async (note: Note) => {
    await toggleCompleted(note.id, !note.completed);
    toast.success(note.completed ? t('taskReopened') : t('taskCompleted'));
  };

  // Open edit dialog
  const openEditDialog = (note: Note) => {
    setEditingNote(note);
    setEditContent(note.content);
    setEditDescription(note.description || '');
    setEditCategory(note.category);
  };

  // Save edited note
  const handleSaveEdit = async () => {
    if (!editingNote || !editContent.trim()) return;

    await updateNote(
      editingNote.id,
      editContent.trim(),
      editCategory,
      editDescription || null
    );
    setEditingNote(null);
    toast.success(t('toast.noteUpdated'));
  };

  // Delete note handler
  const handleDeleteNote = async (id: string) => {
    await deleteNote(id);
    setEditingNote(null);
    toast.success(t('taskDeleted'));
  };

  // Render task item
  const renderTaskItem = (note: Note) => {
    const noteLabels = getLabelsForNote(note.id);

    return (
      <Card
        key={note.id}
        className={`p-3 mb-2 cursor-pointer transition-all active:scale-[0.98] ${
          note.completed ? 'opacity-60' : ''
        }`}
        onClick={() => openEditDialog(note)}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <div
            className="pt-0.5"
            onClick={(e) => {
              e.stopPropagation();
              handleToggleComplete(note);
            }}
          >
            <Checkbox
              checked={note.completed}
              className="h-5 w-5 rounded-full"
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p
              className={`text-sm font-medium leading-tight ${
                note.completed ? 'line-through text-muted-foreground' : ''
              }`}
            >
              {note.content}
            </p>

            {/* Labels and metadata */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {/* Category badge */}
              <Badge
                variant="secondary"
                className={`text-xs px-1.5 py-0 h-5 ${CATEGORY_COLORS[note.category]}`}
              >
                {CATEGORY_ICONS[note.category]}
                <span className="ml-1">{t(`category${note.category.charAt(0).toUpperCase() + note.category.slice(1)}`)}</span>
              </Badge>

              {/* Labels */}
              {noteLabels.slice(0, 2).map((label) => (
                <Badge
                  key={label.id}
                  variant="outline"
                  className="text-xs px-1.5 py-0 h-5"
                  style={{ borderColor: label.color, color: label.color }}
                >
                  {label.name}
                </Badge>
              ))}
              {noteLabels.length > 2 && (
                <Badge variant="outline" className="text-xs px-1.5 py-0 h-5">
                  +{noteLabels.length - 2}
                </Badge>
              )}

              {/* Deadline */}
              {note.deadline && (
                <Badge
                  variant="secondary"
                  className="text-xs px-1.5 py-0 h-5 gap-1"
                >
                  <Calendar className="h-3 w-3" />
                  {new Date(note.deadline).toLocaleDateString()}
                </Badge>
              )}
            </div>

            {/* Description preview */}
            {note.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {note.description.replace(/<[^>]*>/g, '')}
              </p>
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-muted-foreground">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <h1 className="text-lg font-semibold">{t('mobile.tasks')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 mt-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
          <Button
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-8 px-3 shrink-0"
            onClick={() => setSelectedCategory('all')}
          >
            {t('allCategories')}
          </Button>
          {(['todo', 'followup', 'notes', 'meeting'] as NoteCategory[]).map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              className="h-8 px-3 shrink-0 gap-1"
              onClick={() => setSelectedCategory(cat)}
            >
              {CATEGORY_ICONS[cat]}
              {t(`category${cat.charAt(0).toUpperCase() + cat.slice(1)}`)}
            </Button>
          ))}
        </div>
      </header>

      {/* Task list */}
      <main className="flex-1 overflow-y-auto px-4 py-3">
        {/* Show completed toggle */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">
            {filteredNotes.length} {t('mobile.tasksCount')}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? t('mobile.hideCompleted') : t('mobile.showCompleted')}
          </Button>
        </div>

        {/* Pinned tasks */}
        {groupedNotes.pinned.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t('mobile.pinned')}
            </h2>
            {groupedNotes.pinned.map(renderTaskItem)}
          </div>
        )}

        {/* Active tasks */}
        {groupedNotes.active.length > 0 && (
          <div className="mb-4">
            {groupedNotes.pinned.length > 0 && (
              <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {t('mobile.active')}
              </h2>
            )}
            {groupedNotes.active.map(renderTaskItem)}
          </div>
        )}

        {/* Completed tasks */}
        {showCompleted && groupedNotes.completed.length > 0 && (
          <div className="mb-4">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              {t('completedTasks')}
            </h2>
            {groupedNotes.completed.map(renderTaskItem)}
          </div>
        )}

        {/* Empty state */}
        {filteredNotes.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <ListTodo className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">{t('noNotes')}</p>
            <Button
              variant="link"
              className="mt-2"
              onClick={() => setIsCreating(true)}
            >
              {t('mobile.createFirst')}
            </Button>
          </div>
        )}

        {/* Spacer for FAB */}
        <div className="h-20" />
      </main>

      {/* Quick add input (shown when creating) */}
      {isCreating && (
        <div className="fixed inset-x-0 bottom-0 bg-background border-t p-4 pb-6 z-20 animate-in slide-in-from-bottom">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={newTaskContent}
              onChange={(e) => setNewTaskContent(e.target.value)}
              placeholder={t('mobile.newTaskPlaceholder')}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTask();
                if (e.key === 'Escape') setIsCreating(false);
              }}
            />
            <Button
              size="icon"
              onClick={handleCreateTask}
              disabled={!newTaskContent.trim()}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                setIsCreating(false);
                setNewTaskContent('');
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      {!isCreating && (
        <Button
          size="lg"
          className="fixed bottom-6 right-4 h-14 w-14 rounded-full shadow-lg z-20"
          onClick={() => setIsCreating(true)}
        >
          <Plus className="h-6 w-6" />
        </Button>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingNote} onOpenChange={(open) => !open && setEditingNote(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('edit')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Task content */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('newTask')}</label>
              <Input
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder={t('writeNote')}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('category')}</label>
              <Select
                value={editCategory}
                onValueChange={(v) => setEditCategory(v as NoteCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['todo', 'followup', 'notes', 'meeting'] as NoteCategory[]).map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <div className="flex items-center gap-2">
                        {CATEGORY_ICONS[cat]}
                        {t(`category${cat.charAt(0).toUpperCase() + cat.slice(1)}`)}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('mobile.description')}</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder={t('writeDescription')}
                rows={4}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                variant="destructive"
                size="sm"
                className="gap-1"
                onClick={() => editingNote && handleDeleteNote(editingNote.id)}
              >
                <Trash2 className="h-4 w-4" />
                {t('delete')}
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={() => setEditingNote(null)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSaveEdit} disabled={!editContent.trim()}>
                {t('save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
