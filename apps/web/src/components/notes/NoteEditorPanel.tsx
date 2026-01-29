import { forwardRef, memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { Pickaxe, Forward, StickyNote, Plus, X, Pencil, CalendarClock, Users, Check, ChevronDown, Tag, User, Trash2, CalendarPlus, Calendar, Layers, PanelRightClose, History, RotateCcw, Globe, Link } from 'lucide-react';
import { toast } from 'sonner';
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
import type { Note, NoteCategory, Label, NoteVersion, NoteAction } from '@/types/note';
import type { Contact } from '@/types/contact';
import { parseLocalDate } from '@/utils/dateUtils';
import { NoteMetaRow } from './editor/NoteMetaRow';
import { useAssignees } from '@/hooks/useAssignees';
import { useTinyBase } from '@/contexts/TinyBaseContext';

interface NoteEditorPanelProps {
  note: Note;
  noteLabels: Label[];
  allLabels: Label[];
  descriptionValue: string;
  titleValue?: string;
  showPostponeHistory: boolean;
  showVersionHistory: boolean;
  versions: NoteVersion[];
  actions: NoteAction[];
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
  onToggleVersionHistory: () => void;
  onRestoreVersion?: (historyEntry: NoteVersion) => void;
  onAddLabel: (labelId: string) => void;
  onRemoveLabel: (labelId: string) => void;
  onEditLabel: (label: Label) => void;
  onCreateLabel: () => void;
  onDeadlineChange: (date: Date | undefined) => void;
  onDeadlineSave?: (date: Date) => void;
  onAddAssignee: (id: string, contactId: string) => void;
  onRemoveAssignee: (id: string, contactId: string) => void;
  onUpdateAssignee?: (id: string, contactId: string | null) => void;
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
  autoSaveInterval?: number; // in seconds, 0 = disabled
  onTogglePublic?: (id: string, makePublic: boolean) => string | null;
}

// Helper to parse description preview from TipTap JSON or plain text
const parseDescriptionPreview = (description: string): string => {
  if (!description) return '';
  try {
    const parsed = JSON.parse(description);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (node.text) return node.text;
      if (node.content) return node.content.map(extractText).join(' ');
      return '';
    };
    return extractText(parsed).trim().substring(0, 200);
  } catch {
    return description.substring(0, 200);
  }
};

export const NoteEditorPanel = memo(forwardRef<EditableDescriptionHandle, NoteEditorPanelProps>(function NoteEditorPanel({
  note,
  noteLabels,
  allLabels,
  descriptionValue,
  titleValue,
  showPostponeHistory,
  showVersionHistory,
  versions,
  actions,
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
  onToggleVersionHistory,
  onRestoreVersion,
  onAddLabel,
  onRemoveLabel,
  onEditLabel,
  onCreateLabel,
  onDeadlineChange,
  onDeadlineSave,
  onAddAssignee,
  onRemoveAssignee,
  onUpdateAssignee: _onUpdateAssignee,
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
  autoSaveInterval = 3,
  onTogglePublic,
}, ref) {
  const { t, i18n } = useTranslation();
  const { store } = useTinyBase();
  const { getAssigneesForNote } = useAssignees();
  const [noteAssignees, setNoteAssignees] = useState<Contact[]>([]);

  // Load assignees initially and listen for changes
  useEffect(() => {
    if (!store) return;

    // Load initial assignees
    setNoteAssignees(getAssigneesForNote(note.id));

    // Listen for changes to note_assignees table
    const listenerId = store.addTableListener('note_assignees', () => {
      setNoteAssignees(getAssigneesForNote(note.id));
    });

    return () => {
      store.delListener(listenerId);
    };
  }, [store, note.id, getAssigneesForNote]);

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
            autoSaveInterval={autoSaveInterval}
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

      {note.created_at && (
        <div className="flex gap-1.5 flex-shrink-0 items-center mb-1">
          <div className="w-4 flex justify-center shrink-0">
            <CalendarPlus className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <span className="text-xs font-normal text-foreground px-1.5">
            {new Date(note.created_at).toLocaleString()}
          </span>
        </div>
      )}

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
          value={noteAssignees.map(a => a.id)}
          onChange={(contactIds) => {
            const currentIds = noteAssignees.map(a => a.id);
            const added = contactIds.filter(id => !currentIds.includes(id));
            const removed = currentIds.filter(id => !contactIds.includes(id));

            added.forEach(contactId => onAddAssignee(note.id, contactId));
            removed.forEach(contactId => onRemoveAssignee(note.id, contactId));
          }}
          open={assigneePickerOpen}
          onOpenChange={onAssigneePickerOpenChange}
        />
        {noteAssignees.map((assignee) => (
          <span key={assignee.id} className="px-2 py-0.5 text-xs font-normal rounded-full border border-neutral-900 bg-background text-foreground leading-none flex items-center gap-1">
            {`${assignee.name} ${assignee.lastname}`.trim()}
            <button type="button" onClick={() => onRemoveAssignee(note.id, assignee.id)} className="hover:bg-muted rounded-full p-0.5">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </NoteMetaRow>

      {/* Share row */}
      {onTogglePublic && (
        <NoteMetaRow icon={Globe}>
          <Button
            variant="ghost"
            size="sm"
            className={`h-6 px-1.5 text-xs font-normal gap-1 ${note.is_public ? 'text-green-600' : ''}`}
            onClick={() => {
              const slug = onTogglePublic(note.id, !note.is_public);
              if (slug) {
                const url = `${window.location.origin}/p/${slug}`;
                navigator.clipboard.writeText(url);
                toast.success(t('sharing.linkCopied'));
              } else {
                toast.success(t('sharing.linkRemoved'));
              }
            }}
          >
            {note.is_public ? (
              <>
                <Globe className="h-3 w-3" />
                {t('sharing.stopSharing')}
              </>
            ) : (
              <>
                <Link className="h-3 w-3" />
                {t('sharing.makePublic')}
              </>
            )}
          </Button>
          {note.is_public && note.public_slug && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-1.5 text-xs font-normal gap-1"
              onClick={() => {
                const url = `${window.location.origin}/p/${note.public_slug}`;
                navigator.clipboard.writeText(url);
                toast.success(t('sharing.linkCopied'));
              }}
            >
              <Link className="h-3 w-3" />
              {t('sharing.copyLink')}
            </Button>
          )}
        </NoteMetaRow>
      )}

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

      {/* Footer: Postpone reason and version history */}
      {(note.last_postpone_reason || versions.length > 0) && (
        <div className="border-t border-muted-foreground/20 pt-2 mt-2 space-y-1 shrink-0">
          {note.last_postpone_reason && (
            <button
              type="button"
              onClick={() => {
                console.log('[NoteEditorPanel] Postpone history button clicked');
                console.log('[NoteEditorPanel] Current showPostponeHistory:', showPostponeHistory);
                console.log('[NoteEditorPanel] Total versions:', versions.length, 'actions:', actions.length);
                console.log('[NoteEditorPanel] Postponed entries:', actions.length);
                onTogglePostponeHistory();
              }}
              className="flex items-center gap-2 text-xs font-normal text-muted-foreground/70 italic hover:text-muted-foreground transition-colors text-left w-full"
            >
              <CalendarClock className="h-3 w-3 shrink-0" />
              <span className="flex-1 truncate">{note.last_postpone_reason}</span>
              {actions.length > 0 && (
                <span className="text-[10px] text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                  {actions.length}
                </span>
              )}
            </button>
          )}
          {/* Version history toggle */}
          {versions.length > 0 && (
            <button
              type="button"
              onClick={onToggleVersionHistory}
              className="flex items-center gap-2 text-xs font-normal text-muted-foreground/70 hover:text-muted-foreground transition-colors text-left w-full"
            >
              <History className="h-3 w-3 shrink-0" />
              <span className="flex-1">{t('versionHistory')}</span>
              <span className="text-[10px] text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded-full shrink-0">
                {versions.length}
              </span>
            </button>
          )}
        </div>
      )}

      {/* Postpone history section */}
      {showPostponeHistory && (
        <div className="border-t border-dashed border-muted-foreground/20 pt-3 mt-3 max-h-[25%] flex flex-col shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-2 shrink-0">
            <CalendarClock className="h-3 w-3" />
            <span>{t('postponeReasons')}</span>
            <span className="text-muted-foreground/50">
              ({actions.length})
            </span>
          </div>
          <div className="space-y-2 overflow-y-auto">
            {actions.length > 0 ? (
              actions
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
                      {new Date(entry.created_at).toLocaleDateString(i18n.language, {
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
                      className="transition-opacity p-1 hover:bg-muted rounded text-muted-foreground/60 hover:text-foreground"
                      title={t('editPostponeReason')}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteHistoryEntry(entry.id)}
                      className="transition-opacity p-1 hover:bg-destructive/10 rounded text-muted-foreground/60 hover:text-destructive"
                      title={t('deletePostponeReason')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                ))
            ) : (
              <p className="text-xs text-muted-foreground/50 italic px-3 py-2">
                {t('noPostponeHistoryYet')}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Version history section */}
      {showVersionHistory && versions.length > 0 && (
        <div className="border-t border-dashed border-muted-foreground/20 pt-3 mt-3 max-h-[25%] flex flex-col shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-2 shrink-0">
            <History className="h-3 w-3" />
            <span>{t('versionHistory')}</span>
            <span className="text-muted-foreground/50">
              ({versions.length})
            </span>
          </div>
          <div className="space-y-2 overflow-y-auto">
            {versions
              .map((entry) => (
                <div
                  key={entry.id}
                  className="group text-sm text-muted-foreground bg-muted/30 rounded-md px-3 py-2 relative"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {entry.description ? (
                        <p className="text-xs text-muted-foreground/80 line-clamp-3 whitespace-pre-wrap">
                          {parseDescriptionPreview(entry.description)}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 italic">
                          {t('noDescription')}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground/60 whitespace-nowrap">
                        {new Date(entry.created_at).toLocaleDateString(i18n.language, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {onRestoreVersion && (
                        <button
                          type="button"
                          onClick={() => onRestoreVersion(entry)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded text-muted-foreground/60 hover:text-foreground"
                          title={t('restoreVersion')}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </>
  );
}));
