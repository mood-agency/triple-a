import { memo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, StickyNote, Users, Pickaxe, Forward } from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { useDebugNavigation } from '@/hooks/useDebugNavigation';
import { useAssignees } from '@/hooks/useAssignees';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import { getInitials } from '@/lib/utils';

import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { parseLocalDate } from '@/utils/dateUtils';

import { useNoteRow } from './hooks/useNoteRow';
import { NoteRowContent } from './row/NoteRowContent';
import { NoteRowActions } from './row/NoteRowActions';

export interface NoteRowProps {
  note: Note;
  onDeleteWithToast: (note: Note, reason: string) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  isSelected: boolean;
  onSelect: (noteId: string) => void;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onNavigateDown: (noteId: string, column: number) => boolean;
  onNavigateUp: (noteId: string, column: number) => boolean;
  onNavigateToDescription: () => void;
  shouldFocusTitle: boolean;
  desiredColumn: number;
  onTitleFocused: () => void;
  onCreateNoteAfter?: (noteId: string) => void;
  isDragging?: boolean;
  labels?: Label[];
  allLabels?: Label[];
  onAddLabel?: (noteId: string, labelId: string) => void;
  onRemoveLabel?: (noteId: string, labelId: string) => void;
  onCreateLabel?: () => void;
  onCreateLabelAndAdd?: (noteId: string, labelName: string) => void;
  onEditLabel?: (label: Label) => void;
  isCommandPaletteOpen?: boolean;
  isFixedInSidebar?: boolean;
  onToggleFixInSidebar?: (noteId: string) => void;
  onContentChange?: (content: string) => void;
  assigneeName?: string | null;
  isDeleted?: boolean;
  onRestore?: () => void;
  compactView?: boolean;
  isDescriptionFocused?: boolean;
  contacts?: Contact[];
  onAddAssignee?: (noteId: string, contactId: string) => void;
  onRemoveAssignee?: (noteId: string, contactId: string) => void;
  onUpdateAssignee?: (noteId: string, contactId: string | null) => void;
  hideDeadline?: boolean;
  autoSaveInterval?: number; // in seconds, 0 = disabled
}

function NoteRow(props: NoteRowProps) {
  const {
    note,
    isDragging: isDraggingProp,
    compactView = false,
    onTogglePinned,
    onToggleFixInSidebar,
    isFixedInSidebar = false,
    isDeleted = false,
    onRestore,
    labels = [],
    contacts = [],
    hideDeadline = false,
  } = props;

  const { t, i18n } = useTranslation();
  const { debugMode, debugSelectedClass } = useDebugNavigation();
  const { getAssigneesForNote } = useAssignees();
  const { store } = useTinyBase();

  // Track assignees reactively via store listener
  const [noteAssignees, setNoteAssignees] = useState(() => getAssigneesForNote(note.id));
  useEffect(() => {
    setNoteAssignees(getAssigneesForNote(note.id));
    if (!store) return;
    const listenerId = store.addTableListener('note_assignees', () => {
      setNoteAssignees(getAssigneesForNote(note.id));
    });
    return () => { store.delListener(listenerId); };
  }, [note.id, store, getAssigneesForNote]);

  const {
    contentValue,
    setContentValue,
    isEditingContent,
    showLabelDropdown,
    showCategoryDropdown,
    showAssigneeDropdown,
    showDeleteDialog,
    setShowDeleteDialog,
    rowRef,
    contentInputRef,
    handleContentKeyDown,
    handleContentBlur,
    handleContentClick,
    handleCheckedChange,
    handleConfirmDelete,
    handleLabelDropdownOpenChange,
    handleCategoryDropdownOpenChange,
    handleAssigneeDropdownOpenChange,
  } = useNoteRow(props);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <>
      <div
        ref={(node) => {
          setNodeRef(node);
          (rowRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        style={style}
        onClick={() => props.onSelect(note.id)}
        className={`group grid ${compactView ? 'grid-cols-[auto_1fr_auto]' : 'grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]'} items-center h-6 transition-colors cursor-pointer ${note.completed && note.category !== 'notes' && note.category !== 'meeting' ? 'opacity-50' : ''} ${isDraggingProp ? 'opacity-50 bg-muted/30' : ''} ${props.isSelected && debugMode ? debugSelectedClass : ''}`}
      >
        {/* Category icon column */}
        {!compactView ? (
          note.category === 'notes' || note.category === 'meeting' ? (
            <div className="h-4 flex items-center">
              {note.category === 'notes' ? (
                <StickyNote className="h-4 w-4 shrink-0 text-muted-foreground/70" />
              ) : (
                <Users className="h-4 w-4 shrink-0 text-muted-foreground/70" />
              )}
            </div>
          ) : (
            <div
              className="relative w-4 h-4 shrink-0 cursor-pointer flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                handleCheckedChange();
              }}
            >
              <span className={`flex items-center justify-center ${note.completed ? 'hidden' : 'group-hover:hidden'}`}>
                {note.category === 'todo' ? (
                  <Pickaxe className="h-4 w-4 text-muted-foreground/70" />
                ) : (
                  <Forward className="h-4 w-4 text-muted-foreground/70" />
                )}
              </span>
              <span className={`absolute flex items-center justify-center ${note.completed ? 'flex' : 'hidden group-hover:flex'}`}>
                <Checkbox
                  checked={note.completed}
                  onCheckedChange={handleCheckedChange}
                />
              </span>
            </div>
          )
        ) : <div />}

        {/* Content column with actions */}
        <div className="relative flex items-center min-w-0">
          <NoteRowContent
            note={note}
            contentValue={contentValue}
            setContentValue={setContentValue}
            isEditingContent={isEditingContent}
            contentInputRef={contentInputRef}
            isDragging={!!isDraggingProp}
            isSelected={props.isSelected}
            isDescriptionFocused={!!props.isDescriptionFocused}
            compactView={compactView}
            listeners={listeners}
            attributes={attributes}
            onContentClick={handleContentClick}
            onContentChange={props.onContentChange}
            onContentBlur={handleContentBlur}
            onContentKeyDown={handleContentKeyDown}
            showLabelDropdown={showLabelDropdown}
            onLabelDropdownOpenChange={handleLabelDropdownOpenChange}
            showCategoryDropdown={showCategoryDropdown}
            onCategoryDropdownOpenChange={handleCategoryDropdownOpenChange}
            showAssigneeDropdown={showAssigneeDropdown}
            onAssigneeDropdownOpenChange={handleAssigneeDropdownOpenChange}
            allLabels={props.allLabels || []}
            labels={labels}
            contacts={contacts}
            noteAssignees={noteAssignees}
            onAddLabel={props.onAddLabel}
            onRemoveLabel={props.onRemoveLabel}
            onEditLabel={props.onEditLabel}
            onCreateLabel={props.onCreateLabel}
            onEdit={props.onEdit}
            onAddAssignee={props.onAddAssignee}
            onRemoveAssignee={props.onRemoveAssignee}
          />

          {/* Actions - positioned right of content */}
          <NoteRowActions
            note={note}
            isFixedInSidebar={isFixedInSidebar}
            isDeleted={isDeleted}
            onTogglePinned={onTogglePinned}
            onToggleFixInSidebar={onToggleFixInSidebar}
            onRestore={onRestore}
            onDeleteClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
          />
        </div>

        {/* Labels column */}
        {!compactView && (
          <div className="flex gap-1 shrink-0 justify-end px-1">
            {labels.map((label) => (
              <span
                key={label.id}
                className="px-1.5 py-0.5 text-[10px] rounded-full text-white leading-none"
                style={{ backgroundColor: label.color }}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}

        {/* Deadline column */}
        {!compactView && (
          <div className="shrink-0 flex items-center justify-end gap-1 px-1">
            {note.gcal_event_id && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center text-blue-500">
                    <Calendar className="h-3 w-3" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('syncedWithGoogleCalendar')}</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* We are simplifying the rendering here, assuming date formatting is handled or we just render if exists */}
            {/* For brevity in this refactor step, skipping detailed date logic re-implementation if it was complex inline logic, 
                but based on previous file it seemed to use `format`. */}
            {/* Re-adding basic date display if needed or relying on parent to pass formatted? 
                The original had inline logic. Let's keep it simple or check if we need to helper it.
                Actually, the original had complex date logic. I should probably keep it or helper-ize it. 
                For now, I'll extract it to a tiny helper or just inline simple version.
            */}
            {!hideDeadline && note.deadline && (
              <span className={`text-[10px] whitespace-nowrap ${parseLocalDate(note.deadline) < new Date() && !note.completed ? 'text-red-500 font-medium' : 'text-muted-foreground'
                }`}>
                {(() => {
                  const date = parseLocalDate(note.deadline);
                  const today = new Date();
                  const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);
                  const isTomorrow = date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear();

                  if (isToday) return t('date.today');
                  if (isTomorrow) return t('date.tomorrow');
                  return date.toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' });
                })()}
                {(() => {
                  // Only show time if deadline has a time component and it's not midnight (all-day events)
                  if (!note.deadline.includes('T')) return null;
                  const d = parseLocalDate(note.deadline);
                  // Skip if it's midnight (all-day events use 00:00:00)
                  if (d.getHours() === 0 && d.getMinutes() === 0) return null;
                  return ` ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
                })()}
              </span>
            )}
          </div>
        )}

        {/* Assignee column */}
        {!compactView && (
          <div className="shrink-0 flex justify-end px-1 gap-0.5">
            {noteAssignees.map((contact) => {
              const initials = getInitials(contact.name, contact.lastname);
              const fullName = `${contact.name} ${contact.lastname}`.trim();
              return (
                <Tooltip key={contact.id}>
                  <TooltipTrigger asChild>
                    <span
                      className="px-1.5 py-0.5 text-[10px] rounded-full bg-background border border-border text-muted-foreground leading-none truncate max-w-[90px] cursor-default"
                    >
                      {initials}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{fullName}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        )}
      </div>

      <DeleteTaskDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleConfirmDelete}
        taskContent={note.content}
      />
    </>
  );
}

export const MemoizedNoteRow = memo(NoteRow);
