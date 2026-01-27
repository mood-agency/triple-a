import { forwardRef, memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { Pickaxe, Forward, StickyNote, Plus, X, Pencil, CalendarClock, Users, Check, ChevronDown, Tag, User, Trash2, CalendarPlus, Calendar, Layers, PanelRightClose } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { EditableTitle } from '@/components/notes/EditableTitle';
import type { Note, NoteCategory, Label, NoteHistory } from '@/types/note';
import type { Contact } from '@/types/contact';
import { parseLocalDate } from '@/utils/dateUtils';
import { NoteMetaRow } from './editor/NoteMetaRow';

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
  assigneePickerOpen: boolean;
  editingHistoryEntry: { id: string; reason: string } | null;
  // Contacts for assignee picker
  contacts: Contact[];
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDescriptionChange: (value: string) => void;
  onDescriptionBlur: () => void;
  onDescriptionFocus?: () => void;
  onDescriptionKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onTogglePostponeHistory: () => void;
  onAddLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onEditLabel: (label: Label) => void;
  onCreateLabel: () => void;
  onDeadlineChange: (date: Date | undefined) => void;
  onDeadlineSave?: (date: Date) => void;
  onUpdateAssignee: (id: string, assigneeId: string | null) => void;
  onDelete: () => void;
  onLabelDropdownOpenChange: (open: boolean) => void;
  onCategoryDropdownOpenChange: (open: boolean) => void;
  onDeadlinePickerOpenChange: (open: boolean) => void;
  onAssigneePickerOpenChange: (open: boolean) => void;
  onEditHistoryEntry: (entry: { id: string; reason: string }) => void;
  onUpdateHistoryReason: (id: string, reason: string) => void;
  onDeleteHistoryEntry: (id: string) => void;
  onSetEditingHistoryEntry: (entry: { id: string; reason: string } | null) => void;
  onToggleComplete: (id: string) => void;
  onClose?: () => void;
}

export const NoteEditorPanel = memo(forwardRef<EditableDescriptionHandle, NoteEditorPanelProps>(function NoteEditorPanel({
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
  assigneePickerOpen,
  editingHistoryEntry,
  contacts,
  onEdit,
  onDescriptionChange,
  onDescriptionBlur,
  onDescriptionFocus,
  onDescriptionKeyDown,
  onTogglePostponeHistory,
  onAddLabel,
  onRemoveLabel,
  onEditLabel,
  onCreateLabel,
  onDeadlineChange,
  onDeadlineSave,
  onUpdateAssignee,
  onDelete,
  onLabelDropdownOpenChange,
  onCategoryDropdownOpenChange,
  onDeadlinePickerOpenChange,
  onAssigneePickerOpenChange,
  onEditHistoryEntry,
  onUpdateHistoryReason,
  onDeleteHistoryEntry,
  onSetEditingHistoryEntry,
  onToggleComplete,
  onClose,
}, ref) {
  const { t, i18n } = useTranslation();

  // Get assignee full name (e.g., "Liliana Ferro")
  const assigneeFullName = useMemo(() => {
    if (!note.assignee_id) return null;
    const contact = contacts.find(c => c.id === note.assignee_id);
    if (!contact) return null;
    return `${contact.name} ${contact.lastname}`.trim();
  }, [note.assignee_id, contacts]);

  // Ctrl+D to toggle task completion (only for non-notes categories)
  useHotkeys('ctrl+d, meta+d', () => {
    if (note.category !== 'notes') {
      onToggleComplete(note.id);
    }
  }, { preventDefault: true, enableOnFormTags: true }, [note.id, note.category, onToggleComplete]);

  const handleTitleEdit = (id: string, content: string) => {
    onEdit(id, content, note.category, note.description);
  };

  return (
    <>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <EditableTitle
            noteId={note.id}
            content={note.content}
            completed={note.completed}
            onEdit={handleTitleEdit}
            onToggleComplete={onToggleComplete}
            onDelete={onDelete}
            titleValue={titleValue}
          />
        </div>
        {onClose && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors mt-1"
              >
                <PanelRightClose className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('hideSidebar')}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Category row */}
      <NoteMetaRow icon={Layers}>
        <Popover open={categoryDropdownOpen} onOpenChange={onCategoryDropdownOpenChange}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-xs font-normal gap-1"
            >
              <span>
                {note.category === 'todo' && t('categoryTodo')}
                {note.category === 'followup' && t('categoryFollowUp')}
                {note.category === 'notes' && t('categoryNote')}
                {note.category === 'meeting' && t('categoryMeeting')}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-44 p-0" align="start">
            <Command>
              <CommandInput placeholder={t('searchCategory')} className="h-9" />
              <CommandList>
                <CommandEmpty>{t('noCategoriesFound')}</CommandEmpty>
                <CommandGroup>
                  <CommandItem value="todo" onSelect={() => { onEdit(note.id, note.content, 'todo', note.description); onCategoryDropdownOpenChange(false); }} className="flex items-center justify-between">
                    <div className="flex items-center"><Pickaxe className="h-4 w-4 mr-2" />{t('categoryTodo')}</div>
                    {note.category === 'todo' && <Check className="h-4 w-4" />}
                  </CommandItem>
                  <CommandItem value="followup" onSelect={() => { onEdit(note.id, note.content, 'followup', note.description); onCategoryDropdownOpenChange(false); }} className="flex items-center justify-between">
                    <div className="flex items-center"><Forward className="h-4 w-4 mr-2" />{t('categoryFollowUp')}</div>
                    {note.category === 'followup' && <Check className="h-4 w-4" />}
                  </CommandItem>
                  <CommandItem value="notes" onSelect={() => { onEdit(note.id, note.content, 'notes', note.description); onCategoryDropdownOpenChange(false); }} className="flex items-center justify-between">
                    <div className="flex items-center"><StickyNote className="h-4 w-4 mr-2" />{t('categoryNotes')}</div>
                    {note.category === 'notes' && <Check className="h-4 w-4" />}
                  </CommandItem>
                  <CommandItem value="meeting" onSelect={() => { onEdit(note.id, note.content, 'meeting', note.description); onCategoryDropdownOpenChange(false); }} className="flex items-center justify-between">
                    <div className="flex items-center"><Users className="h-4 w-4 mr-2" />{t('categoryMeeting')}</div>
                    {note.category === 'meeting' && <Check className="h-4 w-4" />}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </NoteMetaRow>

      {/* Deadline row */}
      <NoteMetaRow icon={Calendar}>
        <DatePicker
          date={note.deadline ? parseLocalDate(note.deadline) : undefined}
          onDateChange={onDeadlineChange}
          onSave={onDeadlineSave}
          placeholder={t('setDeadline')}
          open={deadlinePickerOpen}
          onOpenChange={onDeadlinePickerOpenChange}
          className="h-6 text-xs"
          showTime
          hideIcon
        />
      </NoteMetaRow>

      {/* Labels row */}
      <NoteMetaRow icon={Tag}>
        <Popover open={labelDropdownOpen} onOpenChange={onLabelDropdownOpenChange}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6">
                  <Plus className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent className="flex items-center gap-2">
              <p>{t('addLabel')}</p>
              <span className="flex items-center gap-0.5"><Kbd>Alt</Kbd><Kbd>L</Kbd></span>
            </TooltipContent>
          </Tooltip>
          <PopoverContent className="w-52 p-0" align="start">
            <Command>
              <CommandInput placeholder={t('searchLabels')} className="h-9" />
              <CommandList>
                <CommandEmpty>{t('noLabelsFound')}</CommandEmpty>
                {allLabels.filter(l => !noteLabels.some(nl => nl.id === l.id)).length > 0 && (
                  <CommandGroup heading={t('available')}>
                    {allLabels.filter(l => !noteLabels.some(nl => nl.id === l.id)).map((label) => (
                      <CommandItem key={label.id} value={label.name} onSelect={() => onAddLabel(label.id)} className="group flex items-center justify-between">
                        <div className="flex items-center">
                          <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: label.color }} />
                          {label.name}
                        </div>
                        <button type="button" onClick={(e) => { e.stopPropagation(); onEditLabel(label); }} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity">
                          <Pencil className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => { onCreateLabel(); onLabelDropdownOpenChange(false); }}>
                    <Plus className="h-3 w-3 mr-2" />
                    {t('createLabel')}
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {noteLabels.map((label) => (
          <span key={label.id} className="px-2 py-0.5 text-xs font-normal rounded-full text-white leading-none flex items-center gap-1" style={{ backgroundColor: label.color }}>
            {label.name}
            <button type="button" onClick={() => onRemoveLabel(label.id)} className="hover:bg-white/20 rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </NoteMetaRow>

      {/* Assignee row */}
      <NoteMetaRow icon={User}>
        <AssigneePicker
          contacts={contacts}
          value={note.assignee_id}
          onChange={(assigneeId) => onUpdateAssignee(note.id, assigneeId)}
          compact
          iconOnly
          open={assigneePickerOpen}
          onOpenChange={onAssigneePickerOpenChange}
          className="h-6 w-6"
          hideIcon
        />
        {assigneeFullName && (
          <span className="px-2 py-0.5 text-xs font-normal rounded-full border border-input bg-background text-foreground leading-none flex items-center gap-1">
            {assigneeFullName}
            <button type="button" onClick={() => onUpdateAssignee(note.id, null)} className="hover:bg-muted rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          </span>
        )}
      </NoteMetaRow>

      {/* Separator */}
      <div className="border-t border-muted-foreground/20 my-1.5" />

      <EditableDescription
        ref={ref}
        value={descriptionValue}
        onChange={onDescriptionChange}
        onBlur={onDescriptionBlur}
        onFocus={onDescriptionFocus}
        onKeyDown={onDescriptionKeyDown}
        placeholder={t('writeDescription')}
        className="flex-1 min-h-0 w-full text-base bg-transparent text-muted-foreground overflow-y-auto"
      />

      {/* Footer: Creation time and postpone reason */}
      {(note.created_at || note.last_postpone_reason) && (
        <div className="border-t border-muted-foreground/20 pt-2 mt-2 space-y-1 shrink-0">
          {note.last_postpone_reason && (
            <button
              type="button"
              onClick={onTogglePostponeHistory}
              className="flex items-center gap-2 text-xs font-normal text-muted-foreground/70 italic hover:text-muted-foreground transition-colors text-left w-full"
            >
              <CalendarClock className="h-3 w-3 shrink-0" />
              <span className="flex-1 truncate">{note.last_postpone_reason}</span>
              {history.filter(h => h.action_type === 'postponed').length > 0 && (
                <span className="text-[10px] text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                  {history.filter(h => h.action_type === 'postponed').length}
                </span>
              )}
            </button>
          )}
          {note.created_at && (
            <p className="flex items-center gap-2 text-xs font-normal text-muted-foreground/50">
              <CalendarPlus className="h-3 w-3" />
              {new Date(note.created_at).toLocaleString()}
            </p>
          )}
        </div>
      )}

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
}));
