import { forwardRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { Trash2, Pickaxe, Forward, StickyNote, Plus, X, Pencil, CalendarClock, Users, Check, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { DatePicker } from '@/components/ui/date-picker';
import { EditableDescription, type EditableDescriptionHandle } from '@/components/ui/EditableDescription';
import { AssigneePicker } from '@/components/notes/AssigneePicker';
import type { Note, NoteCategory, Label, NoteHistory } from '@/types/note';
import type { Contact } from '@/types/contact';
import { parseLocalDate } from '@/utils/dateUtils';

interface NoteEditorPanelProps {
  note: Note;
  noteLabels: Label[];
  allLabels: Label[];
  descriptionValue: string;
  titleValue?: string;
  showPostponeHistory: boolean;
  history: NoteHistory[];
  labelDropdownOpen: boolean;
  categoryDropdownOpen: boolean;
  deadlinePickerOpen: boolean;
  editingHistoryEntry: { id: string; reason: string } | null;
  // Contacts for assignee picker
  contacts: Contact[];
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDescriptionChange: (value: string) => void;
  onDescriptionBlur: () => void;
  onDescriptionKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onTogglePostponeHistory: () => void;
  onAddLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onEditLabel: (label: Label) => void;
  onCreateLabel: () => void;
  onDeadlineChange: (date: Date | undefined) => void;
  onUpdateAssignee: (id: string, assigneeId: string | null) => void;
  onDelete: () => void;
  onLabelDropdownOpenChange: (open: boolean) => void;
  onCategoryDropdownOpenChange: (open: boolean) => void;
  onDeadlinePickerOpenChange: (open: boolean) => void;
  onEditHistoryEntry: (entry: { id: string; reason: string }) => void;
  onUpdateHistoryReason: (id: string, reason: string) => void;
  onDeleteHistoryEntry: (id: string) => void;
  onSetEditingHistoryEntry: (entry: { id: string; reason: string } | null) => void;
  onToggleComplete: (id: string) => void;
}

export const NoteEditorPanel = forwardRef<EditableDescriptionHandle, NoteEditorPanelProps>(function NoteEditorPanel({
  note,
  noteLabels,
  allLabels,
  descriptionValue,
  titleValue,
  showPostponeHistory,
  history,
  labelDropdownOpen,
  categoryDropdownOpen,
  deadlinePickerOpen,
  editingHistoryEntry,
  contacts,
  onEdit,
  onDescriptionChange,
  onDescriptionBlur,
  onDescriptionKeyDown,
  onTogglePostponeHistory,
  onAddLabel,
  onRemoveLabel,
  onEditLabel,
  onCreateLabel,
  onDeadlineChange,
  onUpdateAssignee,
  onDelete,
  onLabelDropdownOpenChange,
  onCategoryDropdownOpenChange,
  onDeadlinePickerOpenChange,
  onEditHistoryEntry,
  onUpdateHistoryReason,
  onDeleteHistoryEntry,
  onSetEditingHistoryEntry,
  onToggleComplete,
}, ref) {
  const { t, i18n } = useTranslation();

  // Ctrl+D to toggle task completion (only for non-notes categories)
  useHotkeys('ctrl+d, meta+d', () => {
    if (note.category !== 'notes') {
      onToggleComplete(note.id);
    }
  }, { preventDefault: true, enableOnFormTags: true }, [note.id, note.category, onToggleComplete]);

  return (
    <>
      <div className="flex items-start gap-3 flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="pt-1.5">
              <Checkbox
                checked={note.completed}
                onCheckedChange={() => onToggleComplete(note.id)}
                className="h-5 w-5"
              />
            </div>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            <p>{note.completed ? t('markIncomplete') : t('markComplete')}</p>
            <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>D</Kbd></span>
          </TooltipContent>
        </Tooltip>
        <h1 className={`text-2xl font-semibold ${note.completed ? 'line-through text-muted-foreground' : ''}`}>
          {titleValue ?? note.content}
        </h1>
      </div>
      {note.created_at && (
        <p className="text-xs text-muted-foreground/60 mt-1 mb-2">
          {t('createdAt')}: {new Date(note.created_at).toLocaleString()}
        </p>
      )}
      {note.last_postpone_reason && (
        <button
          type="button"
          onClick={onTogglePostponeHistory}
          className="flex items-center gap-2 text-sm text-muted-foreground/80 italic mb-2 hover:text-muted-foreground transition-colors text-left w-full"
        >
          <CalendarClock className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{note.last_postpone_reason}</span>
          {history.filter(h => h.action_type === 'postponed').length > 0 && (
            <span className="text-xs text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full shrink-0">
              {history.filter(h => h.action_type === 'postponed').length}
            </span>
          )}
        </button>
      )}
      {!note.last_postpone_reason && <div className="mb-2" />}

      <div className="flex flex-wrap gap-1 mb-2 flex-shrink-0 items-center">
        {/* Category dropdown */}
        <Popover open={categoryDropdownOpen} onOpenChange={onCategoryDropdownOpenChange}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                >
                  {note.category === 'todo' && <Pickaxe className="h-4 w-4" />}
                  {note.category === 'followup' && <Forward className="h-4 w-4" />}
                  {note.category === 'notes' && <StickyNote className="h-4 w-4" />}
                  {note.category === 'meeting' && <Users className="h-4 w-4" />}
                  <span className="text-sm">
                    {note.category === 'todo' && t('categoryTodo')}
                    {note.category === 'followup' && t('categoryFollowUp')}
                    {note.category === 'notes' && t('categoryNotes')}
                    {note.category === 'meeting' && t('categoryMeeting')}
                  </span>
                  <ChevronDown className="h-3 w-3" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
              <p>{t('changeCategory')}</p>
              <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>C</Kbd></span>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-44 p-0" align="start">
            <Command>
              <CommandInput placeholder={t('searchCategory')} className="h-9" />
              <CommandList>
                <CommandEmpty>{t('noCategoriesFound')}</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="todo"
                    onSelect={() => {
                      onEdit(note.id, note.content, 'todo', note.description);
                      onCategoryDropdownOpenChange(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Pickaxe className="h-4 w-4" />
                    {t('categoryTodo')}
                    {note.category === 'todo' && <Check className="h-4 w-4 ml-auto" />}
                  </CommandItem>
                  <CommandItem
                    value="followup"
                    onSelect={() => {
                      onEdit(note.id, note.content, 'followup', note.description);
                      onCategoryDropdownOpenChange(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Forward className="h-4 w-4" />
                    {t('categoryFollowUp')}
                    {note.category === 'followup' && <Check className="h-4 w-4 ml-auto" />}
                  </CommandItem>
                  <CommandItem
                    value="notes"
                    onSelect={() => {
                      onEdit(note.id, note.content, 'notes', note.description);
                      onCategoryDropdownOpenChange(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <StickyNote className="h-4 w-4" />
                    {t('categoryNotes')}
                    {note.category === 'notes' && <Check className="h-4 w-4 ml-auto" />}
                  </CommandItem>
                  <CommandItem
                    value="meeting"
                    onSelect={() => {
                      onEdit(note.id, note.content, 'meeting', note.description);
                      onCategoryDropdownOpenChange(false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Users className="h-4 w-4" />
                    {t('categoryMeeting')}
                    {note.category === 'meeting' && <Check className="h-4 w-4 ml-auto" />}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Separator between category and labels */}
        <div className="h-5 w-px bg-muted-foreground/20 mx-1" />

        {/* Labels */}
        {noteLabels.map((label) => (
          <span
            key={label.id}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full text-white"
            style={{ backgroundColor: label.color }}
          >
            {label.name}
            <button
              type="button"
              onClick={() => onRemoveLabel(label.id)}
              className="hover:bg-white/20 rounded-full p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Popover open={labelDropdownOpen} onOpenChange={onLabelDropdownOpenChange}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="p-1 text-muted-foreground hover:bg-muted rounded-md"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
              <p>{t('addLabel')}</p>
              <span className="flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>L</Kbd></span>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-52 p-0" align="start">
            <Command>
              <CommandInput placeholder={t('searchLabels')} className="h-9" />
              <CommandList>
                <CommandEmpty>{t('noLabelsFound')}</CommandEmpty>
                <CommandGroup>
                  {allLabels.filter(l => !noteLabels.some(nl => nl.id === l.id)).map((label) => (
                    <CommandItem
                      key={label.id}
                      value={label.name}
                      onSelect={() => {
                        onAddLabel(label.id);
                        onLabelDropdownOpenChange(false);
                      }}
                      className="group flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: label.color }} />
                        {label.name}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditLabel(label);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                      >
                        <Pencil className="h-3 w-3 text-muted-foreground" />
                      </button>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => {
                      onCreateLabel();
                      onLabelDropdownOpenChange(false);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-2" />
                    {t('createLabel')}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {/* Separator between labels and deadline */}
        <div className="h-5 w-px bg-muted-foreground/20 mx-1" />

        {/* Deadline picker */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div>
              <DatePicker
                date={note.deadline ? parseLocalDate(note.deadline) : undefined}
                onDateChange={onDeadlineChange}
                placeholder={t('setDeadline')}
                className="h-7 text-xs w-auto"
                open={deadlinePickerOpen}
                onOpenChange={onDeadlinePickerOpenChange}
              />
            </div>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            <p>{t('setDeadline')}</p>
            <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>T</Kbd></span>
          </TooltipContent>
        </Tooltip>

        {/* Separator between deadline and assignee */}
        <div className="h-5 w-px bg-muted-foreground/20 mx-1" />

        {/* Assignee picker */}
        <AssigneePicker
          contacts={contacts}
          value={note.assignee_id}
          onChange={(assigneeId) => onUpdateAssignee(note.id, assigneeId)}
          compact
          className="h-7 text-xs w-auto"
        />

        {/* Separator between assignee and delete */}
        <div className="h-5 w-px bg-muted-foreground/20 mx-1" />

        {/* Delete button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('deleteTask')}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      <EditableDescription
        ref={ref}
        value={descriptionValue}
        onChange={onDescriptionChange}
        onBlur={onDescriptionBlur}
        onKeyDown={onDescriptionKeyDown}
        placeholder={t('writeDescription')}
        className="flex-1 min-h-0 w-full text-base bg-transparent text-muted-foreground overflow-y-auto"
      />

      {/* Postpone history section */}
      {showPostponeHistory && history.filter(h => h.action_type === 'postponed').length > 0 && (
        <div className="border-t border-dashed border-muted-foreground/20 pt-3 mt-3 max-h-[25%] flex flex-col shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-2 shrink-0">
            <CalendarClock className="h-3 w-3" />
            <span>{t('postponeReasons')}</span>
            <span className="text-muted-foreground/50">
              ({history.filter(h => h.action_type === 'postponed').length})
            </span>
          </div>
          <div className="space-y-2 overflow-y-auto">
            {history
              .filter(h => h.action_type === 'postponed')
              .map((entry) => (
                <div
                  key={entry.id}
                  className="group text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2 relative flex items-start justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    {editingHistoryEntry?.id === entry.id && editingHistoryEntry ? (
                      <input
                        type="text"
                        value={editingHistoryEntry.reason}
                        onChange={(e) => onSetEditingHistoryEntry({ id: editingHistoryEntry.id, reason: e.target.value })}
                        onBlur={() => {
                          if (editingHistoryEntry.reason.trim()) {
                            onUpdateHistoryReason(entry.id, editingHistoryEntry.reason.trim());
                          }
                          onSetEditingHistoryEntry(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingHistoryEntry.reason.trim()) {
                              onUpdateHistoryReason(entry.id, editingHistoryEntry.reason.trim());
                            }
                            onSetEditingHistoryEntry(null);
                          } else if (e.key === 'Escape') {
                            onSetEditingHistoryEntry(null);
                          }
                        }}
                        className="w-full text-sm italic bg-transparent border-b border-muted-foreground/40 outline-none focus:border-primary"
                        autoFocus
                      />
                    ) : entry.reason ? (
                      <p className="italic">"{entry.reason}"</p>
                    ) : (
                      <p className="italic text-muted-foreground/50">{t('noPostponeReasons')}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground/60 whitespace-nowrap">
                      {new Date(entry.changed_at).toLocaleDateString(i18n.language, {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() => onEditHistoryEntry({ id: entry.id, reason: entry.reason || '' })}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground/60 hover:text-foreground"
                      title={t('editPostponeReason')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteHistoryEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground/60 hover:text-destructive"
                      title={t('deletePostponeReason')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
});
