import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  Check,
  Plus,
  Pickaxe,
  Forward,
  StickyNote,
  Users,
  ChevronLeft,
  ChevronRight,
  Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useNotes } from '@/hooks/useNotes';
import { useLabels } from '@/hooks/useLabels';
import { useContacts } from '@/hooks/useContacts';
import { formatLocalDate } from '@/utils/dateUtils';
import type { NoteCategory, Note, Label as LabelType } from '@/types/note';
import type { Contact } from '@/types/contact';

const categoryIcons: Record<NoteCategory, React.ElementType> = {
  todo: Pickaxe,
  followup: Forward,
  notes: StickyNote,
  meeting: Users,
};

const DAYS_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function MobileTaskCreate() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const isSpanish = i18n.language === 'es';
  const DAYS = isSpanish ? DAYS_ES : DAYS_EN;
  const MONTHS = isSpanish ? MONTHS_ES : MONTHS_EN;

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Get ALL notes (no date filter) - we'll filter by deadline client-side like CalendarView does
  const { notes, createNote, updateAssignee, toggleCompleted, updateDeadline } = useNotes();
  const { labels, getLabelsForNote } = useLabels();
  const { contacts } = useContacts();

  // Category filter state (like CalendarView)
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | 'all'>('all');

  // Task creation dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<NoteCategory>('todo');
  const [selectedLabels, setSelectedLabels] = useState<LabelType[]>([]);
  const [selectedAssigneeState, setSelectedAssigneeState] = useState<Contact | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calendar logic
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first of the month
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    // Add the days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [currentMonth]);

  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Task creation handlers
  const handleToggleLabel = (label: LabelType) => {
    setSelectedLabels((prev) => {
      const isLabelSelected = prev.some((l) => l.id === label.id);
      if (isLabelSelected) {
        return prev.filter((l) => l.id !== label.id);
      }
      return [...prev, label];
    });
  };

  const handleRemoveLabel = (labelId: string) => {
    setSelectedLabels((prev) => prev.filter((l) => l.id !== labelId));
  };

  const handleSelectAssignee = (contact: Contact) => {
    setSelectedAssigneeState(contact.id === selectedAssigneeState?.id ? null : contact);
    setAssigneeOpen(false);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('todo');
    setSelectedLabels([]);
    setSelectedAssigneeState(null);
  };

  const handleSubmit = async () => {
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const labelIds = selectedLabels.map((l) => l.id);
      const note = await createNote(title.trim(), category, description.trim() || null, labelIds);

      // Set deadline to the selected date so the task appears in the calendar view
      const deadlineDate = formatLocalDate(selectedDate);
      await updateDeadline(note.id, deadlineDate);

      if (selectedAssigneeState) {
        await updateAssignee(note.id, selectedAssigneeState.id);
      }

      resetForm();
      setIsCreateOpen(false);
    } catch (error) {
      console.error('Error creating task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTask = async (note: Note) => {
    await toggleCompleted(note.id, !note.completed);
  };

  const CategoryIcon = categoryIcons[category];

  // Filter notes by deadline date - same logic as CalendarView
  // Only show todos, followups, and meetings (not notes category)
  const filteredNotes = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateKey = `${year}-${month}-${day}`;

    return notes.filter((note) => {
      // Must have a deadline matching the selected date
      if (!note.deadline) return false;
      const noteDeadline = note.deadline.split('T')[0];
      if (noteDeadline !== dateKey) return false;

      // Only show todos, followups and meetings (not notes category)
      if (note.category !== 'todo' && note.category !== 'followup' && note.category !== 'meeting') return false;

      // Apply category filter if set
      if (categoryFilter !== 'all' && note.category !== categoryFilter) return false;

      return true;
    });
  }, [notes, selectedDate, categoryFilter]);

  // Separate active and completed notes
  const activeNotes = useMemo(() => {
    return filteredNotes
      .filter((note) => !note.completed)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [filteredNotes]);

  const completedNotes = useMemo(() => {
    return filteredNotes
      .filter((note) => note.completed)
      .sort((a, b) => {
        const aTime = a.completed_at ? new Date(a.completed_at).getTime() : 0;
        const bTime = b.completed_at ? new Date(b.completed_at).getTime() : 0;
        return bTime - aTime;
      });
  }, [filteredNotes]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background border-b px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">{t('mobile.calendar')}</h1>
        <div className="w-10" />
      </header>

      {/* Calendar */}
      <div className="p-4 border-b">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <Button variant="ghost" size="icon" onClick={goToPreviousMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-lg font-medium">
            {MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, index) => (
            <div key={index} className="aspect-square">
              {date && (
                <button
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    'w-full h-full flex items-center justify-center rounded-full text-sm transition-colors',
                    isSelected(date) && 'bg-primary text-primary-foreground',
                    isToday(date) && !isSelected(date) && 'bg-accent text-accent-foreground',
                    !isSelected(date) && !isToday(date) && 'hover:bg-muted'
                  )}
                >
                  {date.getDate()}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Date Header with Category Filter */}
      <div className="px-4 py-3 border-b bg-muted/50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">
            {selectedDate.toLocaleDateString(isSpanish ? 'es-ES' : 'en-US', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
          <p className="text-xs text-muted-foreground">
            {filteredNotes.length === 0
              ? t('mobile.noTasks')
              : t('mobile.tasksCount', { count: filteredNotes.length })}
          </p>
        </div>
        {/* Category Filter Chips */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              categoryFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {t('categoryAll')}
          </button>
          <button
            onClick={() => setCategoryFilter('todo')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              categoryFilter === 'todo'
                ? 'bg-red-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <Pickaxe className="h-3 w-3" />
            {t('categoryTodo')}
          </button>
          <button
            onClick={() => setCategoryFilter('followup')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              categoryFilter === 'followup'
                ? 'bg-yellow-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <Forward className="h-3 w-3" />
            {t('categoryFollowUp')}
          </button>
          <button
            onClick={() => setCategoryFilter('meeting')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              categoryFilter === 'meeting'
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <Users className="h-3 w-3" />
            {t('categoryMeeting')}
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-auto">
        {activeNotes.length === 0 && completedNotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Circle className="h-12 w-12 mb-3 opacity-50" />
            <p className="text-sm">{t('mobile.noTasksForDay')}</p>
          </div>
        ) : (
          <div className="divide-y">
            {activeNotes.map((note) => {
              const NoteIcon = categoryIcons[note.category];
              const noteLabels = getLabelsForNote(note.id);
              const assignee = contacts.find((c) => c.id === note.assignee_id);

              return (
                <div
                  key={note.id}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3',
                    note.completed && 'opacity-60'
                  )}
                >
                  <Checkbox
                    checked={note.completed}
                    onCheckedChange={() => handleToggleTask(note)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <NoteIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span
                        className={cn(
                          'text-sm font-medium truncate',
                          note.completed && 'line-through'
                        )}
                      >
                        {note.content}
                      </span>
                    </div>
                    {(noteLabels.length > 0 || assignee) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {noteLabels.map((label) => (
                          <Badge
                            key={label.id}
                            variant="secondary"
                            className="text-xs px-1.5 py-0"
                            style={{ backgroundColor: label.color, color: 'white' }}
                          >
                            {label.name}
                          </Badge>
                        ))}
                        {assignee && (
                          <Badge variant="outline" className="text-xs px-1.5 py-0">
                            {assignee.name}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Completed Tasks Section */}
            {completedNotes.length > 0 && (
              <>
                <div className="px-4 py-2 bg-muted/30">
                  <p className="text-xs text-muted-foreground font-medium">
                    {t('completedTasks')} ({completedNotes.length})
                  </p>
                </div>
                {completedNotes.map((note) => {
                  const NoteIcon = categoryIcons[note.category];
                  const noteLabels = getLabelsForNote(note.id);
                  const assignee = contacts.find((c) => c.id === note.assignee_id);

                  return (
                    <div
                      key={note.id}
                      className="flex items-start gap-3 px-4 py-3 opacity-60"
                    >
                      <Checkbox
                        checked={note.completed}
                        onCheckedChange={() => handleToggleTask(note)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <NoteIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <span className="text-sm font-medium truncate line-through">
                            {note.content}
                          </span>
                        </div>
                        {(noteLabels.length > 0 || assignee) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {noteLabels.map((label) => (
                              <Badge
                                key={label.id}
                                variant="secondary"
                                className="text-xs px-1.5 py-0"
                                style={{ backgroundColor: label.color, color: 'white' }}
                              >
                                {label.name}
                              </Badge>
                            ))}
                            {assignee && (
                              <Badge variant="outline" className="text-xs px-1.5 py-0">
                                {assignee.name}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <Button
        onClick={() => setIsCreateOpen(true)}
        size="icon"
        className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Create Task Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('mobile.createTask')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t('mobile.taskTitle')}</Label>
              <Input
                id="title"
                placeholder={t('mobile.taskTitlePlaceholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">{t('mobile.taskDescription')}</Label>
              <Textarea
                id="description"
                placeholder={t('mobile.taskDescriptionPlaceholder')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>{t('category')}</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as NoteCategory)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    <div className="flex items-center gap-2">
                      <CategoryIcon className="h-4 w-4" />
                      <span>
                        {t(`category${category.charAt(0).toUpperCase() + category.slice(1)}`)}
                      </span>
                    </div>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">
                    <div className="flex items-center gap-2">
                      <Pickaxe className="h-4 w-4" />
                      <span>{t('categoryTodo')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="followup">
                    <div className="flex items-center gap-2">
                      <Forward className="h-4 w-4" />
                      <span>{t('categoryFollowUp')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="notes">
                    <div className="flex items-center gap-2">
                      <StickyNote className="h-4 w-4" />
                      <span>{t('categoryNotes')}</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="meeting">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      <span>{t('categoryMeeting')}</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Labels */}
            <div className="space-y-2">
              <Label>{t('labels')}</Label>
              <Popover open={labelsOpen} onOpenChange={setLabelsOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={labelsOpen}
                    className="w-full justify-between h-auto min-h-10 py-2"
                  >
                    {selectedLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedLabels.map((label) => (
                          <Badge
                            key={label.id}
                            style={{ backgroundColor: label.color }}
                            className="text-white"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveLabel(label.id);
                            }}
                          >
                            {label.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{t('mobile.selectLabels')}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('searchLabels')} />
                    <CommandList>
                      <CommandEmpty>{t('noLabelsFound')}</CommandEmpty>
                      <CommandGroup>
                        {labels.map((label) => {
                          const isLabelSelected = selectedLabels.some((l) => l.id === label.id);
                          return (
                            <CommandItem
                              key={label.id}
                              value={label.name}
                              onSelect={() => handleToggleLabel(label)}
                            >
                              <div
                                className={cn(
                                  'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                                  isLabelSelected
                                    ? 'border-primary bg-primary text-primary-foreground'
                                    : 'border-muted-foreground'
                                )}
                              >
                                {isLabelSelected && <Check className="h-3 w-3" />}
                              </div>
                              <div
                                className="h-3 w-3 rounded-full mr-2"
                                style={{ backgroundColor: label.color }}
                              />
                              <span>{label.name}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Assignee */}
            <div className="space-y-2">
              <Label>{t('assignee.placeholder')}</Label>
              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={assigneeOpen}
                    className="w-full justify-between"
                  >
                    {selectedAssigneeState ? (
                      <span>
                        {selectedAssigneeState.name} {selectedAssigneeState.lastname}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t('mobile.selectAssignee')}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('assignee.search')} />
                    <CommandList>
                      <CommandEmpty>{t('assignee.noResults')}</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((contact) => {
                          const fullName = `${contact.name} ${contact.lastname}`.trim();
                          const isContactSelected = selectedAssigneeState?.id === contact.id;
                          return (
                            <CommandItem
                              key={contact.id}
                              value={fullName}
                              onSelect={() => handleSelectAssignee(contact)}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  isContactSelected ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <span>{fullName}</span>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Submit Button */}
            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? t('common.loading') : t('mobile.createTaskButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
