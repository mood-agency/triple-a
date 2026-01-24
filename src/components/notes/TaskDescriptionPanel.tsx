import { forwardRef, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { X, Pickaxe, Forward, StickyNote, Users, CalendarClock, Plus, Pencil, Trash2, Tag, ChevronDown, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { EditableDescription, type EditableDescriptionHandle } from '@/components/ui/EditableDescription';
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
import { AssigneePicker } from '@/components/notes/AssigneePicker';
import type { Note, NoteCategory, Label, NoteHistory } from '@/types/note';
import type { Contact } from '@/types/contact';
import { parseLocalDate, formatLocalDate } from '@/utils/dateUtils';

interface TaskDescriptionPanelProps {
  note: Note;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onToggleComplete: (id: string) => void;
  onClose?: () => void;
  onDescriptionKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  className?: string;
  showCloseButton?: boolean;
  // Labels
  labels: Label[];
  noteLabels: Label[];
  onAddLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onCreateLabel: () => void;
  onEditLabel: (label: Label) => void;
  // Deadline
  onUpdateDeadline: (id: string, deadline: string | null) => void;
  // Assignee
  contacts: Contact[];
  onUpdateAssignee: (id: string, assigneeId: string | null) => void;
  // Postpone history (optional - only main panel needs full history editing)
  history?: NoteHistory[];
  onUpdateHistoryReason?: (historyId: string, reason: string) => void;
  onDeleteHistoryEntry?: (historyId: string) => void;
}

export interface TaskDescriptionPanelHandle {
  focus: () => void;
  blur: () => void;
  getSelectionInfo: () => { cursorPosition: number; text: string } | null;
  setCursorPosition: (position: number) => void;
}

export const TaskDescriptionPanel = forwardRef<TaskDescriptionPanelHandle, TaskDescriptionPanelProps>(
  function TaskDescriptionPanel(
    {
      note,
      onEdit,
      onToggleComplete,
      onClose,
      onDescriptionKeyDown,
      className = '',
      showCloseButton = false,
      labels,
      noteLabels,
      onAddLabel,
      onRemoveLabel,
      onCreateLabel,
      onEditLabel,
      onUpdateDeadline,
      contacts,
      onUpdateAssignee,
      history,
      onUpdateHistoryReason,
      onDeleteHistoryEntry,
    },
    ref
  ) {
    const { t, i18n } = useTranslation();
    const [descriptionValue, setDescriptionValue] = useState(note.description ?? '');
    const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
    const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);
    const [showPostponeHistory, setShowPostponeHistory] = useState(false);
    const [editingHistoryEntry, setEditingHistoryEntry] = useState<{ id: string; reason: string } | null>(null);
    const descriptionRef = { current: null as EditableDescriptionHandle | null };

    // Filter postponed history entries
    const postponedHistory = history?.filter(h => h.action_type === 'postponed') ?? [];

    // Sync description value when note changes
    useEffect(() => {
      setDescriptionValue(note.description ?? '');
    }, [note.id, note.description]);

    // Expose methods via ref
    useEffect(() => {
      if (ref && typeof ref === 'object') {
        ref.current = {
          focus: () => descriptionRef.current?.focus(),
          blur: () => descriptionRef.current?.blur(),
          getSelectionInfo: () => descriptionRef.current?.getSelectionInfo() ?? null,
          setCursorPosition: (position: number) => descriptionRef.current?.setCursorPosition(position),
        };
      }
    }, [ref]);

    // Ctrl+D to toggle task completion (only for non-notes categories)
    useHotkeys('ctrl+d, meta+d', () => {
      if (note.category !== 'notes') {
        onToggleComplete(note.id);
      }
    }, { preventDefault: true, enableOnFormTags: true }, [note.id, note.category, onToggleComplete]);

    const handleDescriptionBlur = () => {
      if (descriptionValue !== (note.description || '')) {
        onEdit(note.id, note.content, note.category, descriptionValue || null);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        // Save changes before blurring
        if (descriptionValue !== (note.description || '')) {
          onEdit(note.id, note.content, note.category, descriptionValue || null);
        }
        descriptionRef.current?.blur();
        return;
      }
      onDescriptionKeyDown?.(e);
    };

    const handleDeadlineChange = (date: Date | undefined) => {
      if (date) {
        onUpdateDeadline(note.id, formatLocalDate(date));
      } else {
        onUpdateDeadline(note.id, null);
      }
    };

    return (
      <div className={`flex flex-col overflow-hidden ${className}`}>
        {/* Title with checkbox and close button */}
        <div className="flex items-start justify-between flex-shrink-0 gap-2">
          <div className="flex items-start gap-3">
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
              {note.content}
            </h1>
          </div>
          {showCloseButton && onClose && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('unpinFromPanel')}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Last postpone reason */}
        {note.last_postpone_reason && (
          <button
            type="button"
            onClick={() => setShowPostponeHistory(!showPostponeHistory)}
            className="flex items-center gap-2 text-sm text-muted-foreground/80 italic mb-2 hover:text-muted-foreground transition-colors text-left w-full"
          >
            <CalendarClock className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate">{note.last_postpone_reason}</span>
            {postponedHistory.length > 0 && (
              <span className="text-xs text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                {postponedHistory.length}
              </span>
            )}
          </button>
        )}
        {!note.last_postpone_reason && <div className="mb-2" />}

        {/* Categories, Labels, Deadline */}
        <div className="flex flex-wrap gap-2 mb-2 flex-shrink-0 items-center">
          {/* Category dropdown */}
          <Popover open={categoryDropdownOpen} onOpenChange={setCategoryDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1.5"
              >
                {note.category === 'todo' && <Pickaxe className="h-3.5 w-3.5" />}
                {note.category === 'followup' && <Forward className="h-3.5 w-3.5" />}
                {note.category === 'notes' && <StickyNote className="h-3.5 w-3.5" />}
                {note.category === 'meeting' && <Users className="h-3.5 w-3.5" />}
                <span>
                  {note.category === 'todo' && t('categoryTodo')}
                  {note.category === 'followup' && t('categoryFollowUp')}
                  {note.category === 'notes' && t('categoryNotes')}
                  {note.category === 'meeting' && t('categoryMeeting')}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-44 p-0" align="start">
              <Command>
                <CommandList>
                  <CommandGroup>
                    <CommandItem
                      value="todo"
                      onSelect={() => {
                        onEdit(note.id, note.content, 'todo', note.description);
                        setCategoryDropdownOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <Pickaxe className="h-4 w-4 mr-2" />
                        {t('categoryTodo')}
                      </div>
                      {note.category === 'todo' && <Check className="h-4 w-4" />}
                    </CommandItem>
                    <CommandItem
                      value="followup"
                      onSelect={() => {
                        onEdit(note.id, note.content, 'followup', note.description);
                        setCategoryDropdownOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <Forward className="h-4 w-4 mr-2" />
                        {t('categoryFollowUp')}
                      </div>
                      {note.category === 'followup' && <Check className="h-4 w-4" />}
                    </CommandItem>
                    <CommandItem
                      value="notes"
                      onSelect={() => {
                        onEdit(note.id, note.content, 'notes', note.description);
                        setCategoryDropdownOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <StickyNote className="h-4 w-4 mr-2" />
                        {t('categoryNotes')}
                      </div>
                      {note.category === 'notes' && <Check className="h-4 w-4" />}
                    </CommandItem>
                    <CommandItem
                      value="meeting"
                      onSelect={() => {
                        onEdit(note.id, note.content, 'meeting', note.description);
                        setCategoryDropdownOpen(false);
                      }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <Users className="h-4 w-4 mr-2" />
                        {t('categoryMeeting')}
                      </div>
                      {note.category === 'meeting' && <Check className="h-4 w-4" />}
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          {/* Labels dropdown */}
          <Popover open={labelDropdownOpen} onOpenChange={setLabelDropdownOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1.5"
              >
                <Tag className="h-3.5 w-3.5" />
                <span>{t('labels')}</span>
                <ChevronDown className="h-3.5 w-3.5 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-0" align="start">
              <Command>
                <CommandInput placeholder={t('searchLabels')} className="h-9" />
                <CommandList>
                  <CommandEmpty>{t('noLabelsFound')}</CommandEmpty>
                  {/* Applied labels */}
                  {noteLabels.length > 0 && (
                    <CommandGroup heading={t('applied')}>
                      {noteLabels.map((label) => (
                        <CommandItem
                          key={label.id}
                          value={`applied-${label.name}`}
                          onSelect={() => onRemoveLabel(label.id)}
                          className="group flex items-center justify-between"
                        >
                          <div className="flex items-center">
                            <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: label.color }} />
                            {label.name}
                          </div>
                          <X className="h-3 w-3 text-muted-foreground" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  {noteLabels.length > 0 && labels.filter(l => !noteLabels.some(nl => nl.id === l.id)).length > 0 && (
                    <CommandSeparator />
                  )}
                  {/* Available labels */}
                  {labels.filter(l => !noteLabels.some(nl => nl.id === l.id)).length > 0 && (
                    <CommandGroup heading={t('available')}>
                      {labels.filter(l => !noteLabels.some(nl => nl.id === l.id)).map((label) => (
                        <CommandItem
                          key={label.id}
                          value={label.name}
                          onSelect={() => {
                            onAddLabel(label.id);
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
                  )}
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        onCreateLabel();
                        setLabelDropdownOpen(false);
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

          {/* Deadline picker */}
          <DatePicker
            date={note.deadline ? parseLocalDate(note.deadline) : undefined}
            onDateChange={handleDeadlineChange}
            placeholder={t('setDeadline')}
            className="h-7 text-xs"
          />

          {/* Assignee picker */}
          <AssigneePicker
            contacts={contacts}
            value={note.assignee_id}
            onChange={(assigneeId) => onUpdateAssignee(note.id, assigneeId)}
            compact
            className="h-7 text-xs"
          />
        </div>

        {/* Description editor */}
        <EditableDescription
          ref={(el) => { descriptionRef.current = el; }}
          value={descriptionValue}
          onChange={setDescriptionValue}
          onBlur={handleDescriptionBlur}
          onKeyDown={handleKeyDown}
          placeholder={t('writeDescription')}
          className="flex-1 min-h-0 w-full text-base bg-transparent text-muted-foreground overflow-y-auto"
        />

        {/* Postpone history section */}
        {showPostponeHistory && postponedHistory.length > 0 && (
          <div className="border-t border-dashed border-muted-foreground/20 pt-3 mt-3 max-h-[25%] flex flex-col shrink-0">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-2 shrink-0">
              <CalendarClock className="h-3 w-3" />
              <span>{t('postponeReasons')}</span>
              <span className="text-muted-foreground/50">
                ({postponedHistory.length})
              </span>
            </div>
            <div className="space-y-2 overflow-y-auto">
              {postponedHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="group text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2 relative flex items-start justify-between gap-2"
                >
                  <div className="flex-1 min-w-0">
                    {editingHistoryEntry?.id === entry.id ? (
                      <input
                        type="text"
                        value={editingHistoryEntry.reason}
                        onChange={(e) => setEditingHistoryEntry({ ...editingHistoryEntry, reason: e.target.value })}
                        onBlur={() => {
                          if (editingHistoryEntry.reason.trim() && onUpdateHistoryReason) {
                            onUpdateHistoryReason(entry.id, editingHistoryEntry.reason.trim());
                          }
                          setEditingHistoryEntry(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingHistoryEntry.reason.trim() && onUpdateHistoryReason) {
                              onUpdateHistoryReason(entry.id, editingHistoryEntry.reason.trim());
                            }
                            setEditingHistoryEntry(null);
                          } else if (e.key === 'Escape') {
                            setEditingHistoryEntry(null);
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
                    {onUpdateHistoryReason && (
                      <button
                        type="button"
                        onClick={() => setEditingHistoryEntry({ id: entry.id, reason: entry.reason || '' })}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground/60 hover:text-foreground"
                        title={t('editPostponeReason')}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {onDeleteHistoryEntry && (
                      <button
                        type="button"
                        onClick={() => onDeleteHistoryEntry(entry.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground/60 hover:text-destructive"
                        title={t('deletePostponeReason')}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);
