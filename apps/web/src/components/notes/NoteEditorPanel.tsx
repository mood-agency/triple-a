import { forwardRef, memo, useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import { Pickaxe, Forward, StickyNote, Plus, X, Pencil, CalendarClock, Users, Check, Tag, User, Trash2, History, RotateCcw, Sparkles, Pin, PanelRightOpen, Search, ChevronUp, ChevronDown } from 'lucide-react';
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
import { BlockNoteEditor, type BlockNoteEditorHandle } from '@/components/ui/BlockNoteEditor';
import { AssigneePicker } from '@/components/notes/AssigneePicker';
import { EditableTitle } from '@/components/notes/EditableTitle';
import type { Note, NoteCategory, Label, NoteVersion, NoteAction } from '@/types/note';
import type { Contact } from '@/types/contact';
import { parseLocalDate } from '@/utils/dateUtils';
import { AIAssistantDialog } from './AIAssistantDialog';
import { ShareDialog } from './ShareDialog';
import { useAssignees } from '@/hooks/useAssignees';
import type { AIProviderConfig } from '@/hooks/useSettings';

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
  onTogglePublic?: (id: string, makePublic: boolean) => string | null | Promise<string | null>;
  aiProvider?: AIProviderConfig | null;
  onTogglePinned?: (id: string, pinned: boolean) => void;
  onToggleFixInSidebar?: (id: string) => void;
  isFixedInSidebar?: boolean;
}

// Helper to parse description preview from BlockNote JSON or plain text
const parseDescriptionPreview = (description: string): string => {
  if (!description) return '';
  try {
    const parsed = JSON.parse(description);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractText = (node: any): string => {
      if (typeof node === 'string') return node;
      if (Array.isArray(node)) return node.map(extractText).join(' ');
      if (node.text) return node.text;
      if (node.content) return node.content.map(extractText).join(' ');
      if (node.children) return node.children.map(extractText).join(' ');
      return '';
    };
    return extractText(parsed).trim().substring(0, 200);
  } catch {
    return description.substring(0, 200);
  }
};

export const NoteEditorPanel = memo(forwardRef<BlockNoteEditorHandle, NoteEditorPanelProps>(function NoteEditorPanel({
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
  onClose: _onClose,
  autoSaveInterval = 3,
  onTogglePublic,
  aiProvider,
  onTogglePinned,
  onToggleFixInSidebar,
  isFixedInSidebar = false,
}, ref) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'es' ? es : enUS;
  const { getAssigneesForNote, noteAssigneeVersion } = useAssignees();
  const [noteAssignees, setNoteAssignees] = useState<Contact[]>([]);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Handle toggle complete with animation
  const handleCheckedChange = useCallback(() => {
    if (!note.completed) {
      setIsCompleting(true);
      // Wait for animation to finish (400ms strikethrough + 200ms fade)
      setTimeout(() => {
        onToggleComplete(note.id);
      }, 600);
    } else {
      onToggleComplete(note.id);
    }
  }, [note.completed, note.id, onToggleComplete]);

  // In-editor search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<BlockNoteEditorHandle | null>(null);

  // Load assignees when note or assignee version changes
  useEffect(() => {
    setNoteAssignees(getAssigneesForNote(note.id));
  }, [note.id, noteAssigneeVersion, getAssigneesForNote]);

  // Reset isCompleting when note changes or completed state changes
  useEffect(() => {
    setIsCompleting(false);
  }, [note.id]);

  useEffect(() => {
    if (note.completed) {
      setIsCompleting(false);
    }
  }, [note.completed]);

  // Forward ref to editor
  useEffect(() => {
    if (ref && typeof ref === 'function') {
      ref(editorRef.current);
    } else if (ref) {
      ref.current = editorRef.current;
    }
  }, [ref]);

  // Reset search when note changes
  useEffect(() => {
    setShowSearch(false);
    setSearchTerm('');
    setMatchCount(0);
    setCurrentMatch(0);
    editorRef.current?.clearSearch();
  }, [note.id]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => searchInputRef.current?.focus(), 0);
    } else {
      // Clear search when closed
      editorRef.current?.clearSearch();
    }
  }, [showSearch]);

  // Count matches in the editor text using ProseMirror document
  const countMatches = useCallback((term: string): number => {
    if (!term) return 0;
    return editorRef.current?.countSearchMatches(term) ?? 0;
  }, []);

  // Perform search using ProseMirror decorations
  const performSearch = useCallback((term: string, matchIndex?: number) => {
    if (!term) {
      setMatchCount(0);
      setCurrentMatch(0);
      editorRef.current?.clearSearch();
      return;
    }

    const count = countMatches(term);
    setMatchCount(count);

    if (count > 0) {
      const index = matchIndex !== undefined ? matchIndex : 0;
      const safeIndex = ((index % count) + count) % count;
      setCurrentMatch(safeIndex + 1);

      // Update the extension with search term and current match index
      editorRef.current?.updateSearch(term, safeIndex);

      // Scroll to current match by finding the nth match
      setTimeout(() => {
        const container = editorContainerRef.current;
        if (!container) return;

        const walker = document.createTreeWalker(
          container,
          NodeFilter.SHOW_TEXT,
          null
        );

        let matchCounter = 0;
        const searchTermLower = term.toLowerCase();
        let node: Text | null;

        while ((node = walker.nextNode() as Text | null)) {
          const text = node.textContent || '';
          const textLower = text.toLowerCase();
          let pos = 0;

          while ((pos = textLower.indexOf(searchTermLower, pos)) !== -1) {
            if (matchCounter === safeIndex) {
              // Found the current match, scroll it into view
              const element = node.parentElement;
              element?.scrollIntoView({ block: 'center', behavior: 'smooth' });
              return;
            }
            matchCounter++;
            pos += 1;
          }
        }
      }, 10);
    } else {
      setCurrentMatch(0);
      editorRef.current?.clearSearch();
    }
  }, [countMatches]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchTerm(value);
    if (value) {
      // Small delay to let the state update
      setTimeout(() => performSearch(value, 0), 10);
    } else {
      performSearch('');
    }
  }, [performSearch]);

  const goToNextMatch = useCallback(() => {
    if (searchTerm && matchCount > 0) {
      const nextIndex = currentMatch % matchCount;
      performSearch(searchTerm, nextIndex);
    }
  }, [searchTerm, matchCount, currentMatch, performSearch]);

  const goToPrevMatch = useCallback(() => {
    if (searchTerm && matchCount > 0) {
      const prevIndex = currentMatch - 2;
      performSearch(searchTerm, prevIndex);
    }
  }, [searchTerm, matchCount, currentMatch, performSearch]);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    setSearchTerm('');
    setMatchCount(0);
    setCurrentMatch(0);
    editorRef.current?.clearSearch();
  }, []);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeSearch();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    } else if (e.key === 'F3') {
      e.preventDefault();
      if (e.shiftKey) {
        goToPrevMatch();
      } else {
        goToNextMatch();
      }
    }
  }, [closeSearch, goToNextMatch, goToPrevMatch]);

  // Ctrl+D to toggle task completion (only for non-notes categories)
  useHotkeys('ctrl+d, meta+d', () => {
    if (note.category !== 'notes') {
      handleCheckedChange();
    }
  }, { preventDefault: true, enableOnFormTags: true }, [note.category, handleCheckedChange]);

  const handleTitleEdit = (id: string, content: string) => {
    onEdit(id, content, note.category, note.description);
  };

  return (
    <>
      {/* Labels row */}
      <div className="flex gap-1.5 flex-shrink-0 items-center mb-2">
        <Popover open={labelDropdownOpen} onOpenChange={onLabelDropdownOpenChange}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-4 flex justify-center shrink-0 hover:text-foreground transition-colors"
                >
                  <Tag className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                </button>
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
          <span key={label.id} className="chip-label" style={{ backgroundColor: label.color }}>
            {label.name}
            <button type="button" onClick={() => onRemoveLabel(label.id)} className="chip-label-btn">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>

      {/* Assignee row */}
      <div className="flex gap-1.5 flex-shrink-0 items-center mb-2">
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
          trigger={
            <button
              type="button"
              className="w-4 flex justify-center shrink-0 hover:text-foreground transition-colors"
            >
              <User className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          }
        />
        {noteAssignees.map((assignee) => (
          <span key={assignee.id} className="chip-assignee">
            {`${assignee.name} ${assignee.lastname}`.trim()}
            <button type="button" onClick={() => onRemoveAssignee(note.id, assignee.id)} className="chip-assignee-btn">
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <EditableTitle
            noteId={note.id}
            content={note.content}
            completed={note.completed}
            onEdit={handleTitleEdit}
            onToggleComplete={onToggleComplete}
            titleValue={titleValue}
            autoSaveInterval={autoSaveInterval}
            showCheckbox={note.category === 'todo' || note.category === 'followup'}
            isCompletingExternal={isCompleting}
          />
        </div>
      </div>

      {/* Category, created date, and deadline - single line */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2 flex-wrap">
        <Popover open={categoryDropdownOpen} onOpenChange={onCategoryDropdownOpenChange}>
          <PopoverTrigger asChild>
            <button type="button" className="font-medium text-foreground hover:underline">
              {note.category === 'todo' && t('categoryTodo')}
              {note.category === 'followup' && t('categoryFollowUp')}
              {note.category === 'notes' && t('categoryNote')}
              {note.category === 'meeting' && t('categoryMeeting')}
            </button>
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
        {note.created_at && (
          <>
            <span>{t('createdOnDate')}</span>
            <span className="font-medium text-foreground">{format(new Date(note.created_at), 'dd/MM/yyyy', { locale })}</span>
          </>
        )}
        <span>{t('expiresOnDate')}</span>
        <DatePicker
          date={note.deadline ? parseLocalDate(note.deadline) : undefined}
          onDateChange={onDeadlineChange}
          onSave={onDeadlineSave}
          placeholder={t('setDeadline')}
          open={deadlinePickerOpen}
          onOpenChange={onDeadlinePickerOpenChange}
          showTime
          hideIcon
        />
      </div>

{/* Actions row: Share, AI, Pin, Sidebar, Delete */}
      <div className="flex items-center gap-1 mb-2">
        {onTogglePublic && (
          <ShareDialog
            isPublic={note.is_public ?? false}
            publicSlug={note.public_slug ?? null}
            onTogglePublic={async () => {
              const slug = await onTogglePublic(note.id, !note.is_public);
              return slug;
            }}
          />
        )}
        {aiProvider && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAiDialogOpen(true)}
                className="h-6 w-6 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('ai.assistant.title')}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {onTogglePinned && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onTogglePinned(note.id, !note.pinned)}
                className={`h-6 w-6 ${note.pinned ? 'text-primary' : 'text-muted-foreground hover:text-primary'}`}
              >
                <Pin className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{note.pinned ? t('unpin') : t('pin')}</p>
            </TooltipContent>
          </Tooltip>
        )}
        {onToggleFixInSidebar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onToggleFixInSidebar(note.id)}
                className={`h-6 w-6 ${isFixedInSidebar ? 'text-blue-500' : 'text-muted-foreground hover:text-blue-500'}`}
              >
                <PanelRightOpen className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isFixedInSidebar ? t('unfixFromSidebar') : t('fixToSidebar')}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              className="h-6 w-6 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('delete')}</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Editor with in-editor search */}
      <div
        ref={editorContainerRef}
        className="flex-1 min-h-0 flex flex-col overflow-hidden relative"
        onKeyDown={(e) => {
          // Capture CTRL+F to open in-editor search
          if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            e.stopPropagation();
            setShowSearch(true);
          }
        }}
      >
        {/* In-editor search bar - floating, compact, aligned right */}
        {showSearch && (
          <div
            className="absolute top-2 right-2 z-10 flex items-center gap-1.5 px-2 py-1.5 bg-background border border-muted-foreground/20 rounded-lg shadow-md"
            onKeyDown={(e) => {
              // Stop all key events from propagating to the editor
              e.stopPropagation();
            }}
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t('searchInDescription')}
              className="w-32 text-xs bg-transparent border-none outline-none placeholder:text-muted-foreground/50"
            />
            {searchTerm && (
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                {matchCount > 0 ? `${currentMatch}/${matchCount}` : t('noResults')}
              </span>
            )}
            <button
              type="button"
              onClick={goToPrevMatch}
              disabled={!searchTerm || matchCount === 0}
              className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
              title={t('previousMatch')}
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={goToNextMatch}
              disabled={!searchTerm || matchCount === 0}
              className="p-0.5 hover:bg-muted rounded disabled:opacity-30"
              title={t('nextMatch')}
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={closeSearch}
              className="p-0.5 hover:bg-muted rounded"
              title={t('close')}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <BlockNoteEditor
            ref={editorRef}
            value={descriptionValue}
            onChange={onDescriptionChange}
            onBlur={onDescriptionBlur}
            onFocus={onDescriptionFocus}
            onKeyDown={onDescriptionKeyDown}
            placeholder={t('writeDescription')}
            className="h-full w-full text-base bg-transparent text-muted-foreground overflow-y-auto"
            noteId={note.id}
          />
        </div>
      </div>

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

      {/* AI Assistant Dialog */}
      {aiProvider && (
        <AIAssistantDialog
          open={aiDialogOpen}
          onOpenChange={setAiDialogOpen}
          content={descriptionValue || ''}
          aiProvider={aiProvider}
          onApply={(newContent) => {
            onDescriptionChange(newContent);
          }}
        />
      )}
    </>
  );
}));
