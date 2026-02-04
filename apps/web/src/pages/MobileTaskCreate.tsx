import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { es, enUS } from 'date-fns/locale';
import {
  Check,
  Plus,
  Pickaxe,
  Forward,
  StickyNote,
  Users,
  Circle,
  X,
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
import { WeekStrip } from '@/components/ui/week-strip';
import { cn } from '@/lib/utils';
import { useNotesWithCalendarSync } from '@/hooks/useNotesWithCalendarSync';
import { useLabels } from '@/hooks/useLabels';
import { useContacts } from '@/hooks/useContacts';
import { useAssignees } from '@/hooks/useAssignees';
import { formatLocalDate, getLocalDateKey } from '@/utils/dateUtils';
import type { NoteCategory, Note, Label as LabelType } from '@/types/note';
import type { Contact } from '@/types/contact';

const categoryIcons: Record<NoteCategory, React.ElementType> = {
  todo: Pickaxe,
  followup: Forward,
  notes: StickyNote,
  meeting: Users,
};

export function MobileTaskCreate() {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === 'es';
  const locale = isSpanish ? es : enUS;

  // Date selection state
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Get ALL notes (no date filter) - we'll filter by deadline client-side like CalendarView does
  const { notes, createNote, toggleCompleted, updateDeadline } = useNotesWithCalendarSync();
  const { labels, getLabelsForNote } = useLabels();
  const { contacts } = useContacts();
  const { setAssigneesForNote, getAssigneesForNote } = useAssignees();

  // Category filter state (like CalendarView)
  const [categoryFilter, setCategoryFilter] = useState<NoteCategory | 'all'>('all');

  // Task creation dialog state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<NoteCategory>('todo');
  const [selectedLabels, setSelectedLabels] = useState<LabelType[]>([]);
  const [selectedAssignees, setSelectedAssignees] = useState<Contact[]>([]);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleToggleAssignee = (contact: Contact) => {
    setSelectedAssignees((prev) => {
      const isSelected = prev.some((c) => c.id === contact.id);
      if (isSelected) {
        return prev.filter((c) => c.id !== contact.id);
      }
      return [...prev, contact];
    });
    // Don't close the popover for multi-select
  };

  const handleRemoveAssignee = (contactId: string) => {
    setSelectedAssignees((prev) => prev.filter((c) => c.id !== contactId));
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setCategory('todo');
    setSelectedLabels([]);
    setSelectedAssignees([]);
  };

  const handleSubmit = async () => {
    if (!title.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const labelIds = selectedLabels.map((l) => l.id);
      const note = await createNote(title.trim(), category, description.trim() || null, labelIds);

      // Set deadline to the selected date so the task appears in the calendar view
      const deadlineDate = formatLocalDate(selectedDate);
      await updateDeadline(note.id, deadlineDate, true);

      // Set assignees if any selected
      if (selectedAssignees.length > 0) {
        const assigneeIds = selectedAssignees.map((a) => a.id);
        await setAssigneesForNote(note.id, assigneeIds);
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
      const noteDeadline = getLocalDateKey(note.deadline);
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

  // Calculate modifiers for WeekStrip indicators
  const weekStripModifiers = useMemo(() => {
    const hasTodo: Date[] = [];
    const hasMeeting: Date[] = [];
    const hasFollowup: Date[] = [];

    notes.forEach((note) => {
      if (!note.deadline || note.completed) return;
      const deadlineDate = new Date(note.deadline);

      if (note.category === 'todo') {
        hasTodo.push(deadlineDate);
      } else if (note.category === 'meeting') {
        hasMeeting.push(deadlineDate);
      } else if (note.category === 'followup') {
        hasFollowup.push(deadlineDate);
      }
    });

    return { hasTodo, hasMeeting, hasFollowup };
  }, [notes]);

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Category Filter */}
      <div className="px-4 py-3 border-b bg-muted/50">
        {/* Category Filter Chips - icon only */}
        <div className="flex gap-2">
          <button
            onClick={() => setCategoryFilter('all')}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium transition-colors',
              categoryFilter === 'all'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            title={t('categoryAll')}
          >
            {t('all')}
          </button>
          <button
            onClick={() => setCategoryFilter('todo')}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
              categoryFilter === 'todo'
                ? 'bg-red-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            title={t('categoryTodo')}
          >
            <Pickaxe className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCategoryFilter('followup')}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
              categoryFilter === 'followup'
                ? 'bg-yellow-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            title={t('categoryFollowUp')}
          >
            <Forward className="h-4 w-4" />
          </button>
          <button
            onClick={() => setCategoryFilter('meeting')}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
              categoryFilter === 'meeting'
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
            title={t('categoryMeeting')}
          >
            <Users className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 min-h-0 overflow-y-auto">
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
              const noteAssignees = getAssigneesForNote(note.id);
              const assignee = noteAssignees[0];

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
                  const noteAssignees = getAssigneesForNote(note.id);
              const assignee = noteAssignees[0];

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

      {/* Week Strip - Bottom */}
      <div className="px-2 py-3 border-t bg-background">
        <WeekStrip
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          modifiers={weekStripModifiers}
          locale={locale}
          className="justify-center"
        />
      </div>

      {/* Floating Action Button */}
      <Button
        onClick={() => setIsCreateOpen(true)}
        size="icon"
        className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-lg"
      >
        <Plus className="h-6 w-6" />
      </Button>

      {/* Create Task Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
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
              <Label>{t('assignees')}</Label>
              <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={assigneeOpen}
                    className="w-full justify-between"
                  >
                    {selectedAssignees.length > 0 ? (
                      <span>
                        {selectedAssignees.length} {t('selectAssignees')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">{t('selectAssignees')}</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('searchAssignees')} />
                    <CommandList>
                      <CommandEmpty>{t('noAssigneesFound')}</CommandEmpty>
                      <CommandGroup>
                        {contacts.map((contact) => {
                          const fullName = `${contact.name} ${contact.lastname}`.trim();
                          const isContactSelected = selectedAssignees.some((c) => c.id === contact.id);
                          return (
                            <CommandItem
                              key={contact.id}
                              value={fullName}
                              onSelect={() => handleToggleAssignee(contact)}
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

              {/* Display selected assignees as badges */}
              {selectedAssignees.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedAssignees.map((assignee) => (
                    <Badge key={assignee.id} variant="outline" className="flex items-center gap-1">
                      {`${assignee.name} ${assignee.lastname}`.trim()}
                      <button
                        type="button"
                        onClick={() => handleRemoveAssignee(assignee.id)}
                        className="hover:bg-muted rounded-full p-0.5 ml-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
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
