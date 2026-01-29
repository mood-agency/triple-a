import { useCallback } from 'react';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import type { NoteRowProps } from '@/components/notes/NoteRow';
import { EMPTY_LABELS } from '@/constants/notes';

/**
 * Base props that are shared across all note row instances.
 * These are the callbacks and data that don't change per-note.
 */
export interface NoteRowBaseProps {
  // Callbacks
  onDeleteWithToast: (note: Note, reason: string) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onSelect: (noteId: string) => void;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onNavigateDown: (noteId: string, column: number) => boolean;
  onNavigateUp: (noteId: string, column: number) => boolean;
  onNavigateToDescription: () => void;
  onTitleFocused: () => void;
  onCreateNoteAfter?: (noteId: string) => void;

  // Label operations
  allLabels: Label[];
  onAddLabel: (noteId: string, labelId: string) => void;
  onRemoveLabel: (noteId: string, labelId: string) => void;
  onCreateLabel: () => void;
  onCreateLabelAndAdd?: (noteId: string, labelName: string) => void;
  onEditLabel: (label: Label) => void;

  // Sidebar
  fixedNoteId: string | null;
  onToggleFixInSidebar: (noteId: string) => void;

  // Assignee
  contacts: Contact[];
  onAddAssignee: (noteId: string, contactId: string) => void;
  onRemoveAssignee: (noteId: string, contactId: string) => void;
  onUpdateAssignee: (noteId: string, contactId: string | null) => void;

  // Caches
  noteLabelsCache: Map<string, Label[]>;
  assigneeNamesCache: Map<string, string | null>;
  noteAssigneesCache: Map<string, Contact[]>;

  // State
  selectedNote: Note | null;
  focusTarget: 'title' | 'description' | 'description-start' | 'description-end' | null;
  desiredColumn: number;
  compactView: boolean;
  isDescriptionFocused: boolean;

  // Optional content change handler (only for selected note)
  onContentChange?: (content: string) => void;
}

/**
 * Extra props that can vary per-note rendering context.
 */
export interface NoteRowExtraProps {
  isDragging?: boolean;
  isDeleted?: boolean;
  onRestore?: () => void;
  hideDeadline?: boolean;
}

/**
 * Hook that creates a function to build NoteRow props for a given note.
 * This reduces prop drilling and ensures consistency across note list renderings.
 *
 * @example
 * ```tsx
 * const getNoteRowProps = useNoteRowProps(baseProps);
 *
 * // In render:
 * {notes.map((note) => (
 *   <MemoizedNoteRow key={note.id} {...getNoteRowProps(note)} />
 * ))}
 *
 * // With extra props:
 * {deletedNotes.map((note) => (
 *   <MemoizedNoteRow
 *     key={note.id}
 *     {...getNoteRowProps(note, { isDeleted: true, onRestore: () => restore(note.id) })}
 *   />
 * ))}
 * ```
 */
export function useNoteRowProps(baseProps: NoteRowBaseProps) {
  const {
    onDeleteWithToast,
    onToggleCompleted,
    onTogglePinned,
    onSelect,
    onEdit,
    onNavigateDown,
    onNavigateUp,
    onNavigateToDescription,
    onTitleFocused,
    onCreateNoteAfter,
    allLabels,
    onAddLabel,
    onRemoveLabel,
    onCreateLabel,
    onCreateLabelAndAdd,
    onEditLabel,
    fixedNoteId,
    onToggleFixInSidebar,
    contacts,
    onAddAssignee,
    onRemoveAssignee,
    onUpdateAssignee,
    noteLabelsCache,
    assigneeNamesCache,
    noteAssigneesCache,
    selectedNote,
    focusTarget,
    desiredColumn,
    compactView,
    isDescriptionFocused,
    onContentChange,
  } = baseProps;

  /**
   * Returns props for a NoteRow component.
   */
  const getNoteRowProps = useCallback(
    (note: Note, extraProps?: NoteRowExtraProps): NoteRowProps => {
      const isSelected = selectedNote?.id === note.id;

      return {
        note,
        onDeleteWithToast,
        onToggleCompleted,
        onTogglePinned,
        isSelected,
        onSelect,
        onEdit,
        onNavigateDown,
        onNavigateUp,
        onNavigateToDescription,
        shouldFocusTitle: focusTarget === 'title' && isSelected,
        desiredColumn,
        onTitleFocused,
        onCreateNoteAfter,
        isDragging: extraProps?.isDragging ?? false,
        labels: noteLabelsCache.get(note.id) ?? EMPTY_LABELS,
        allLabels,
        onAddLabel,
        onRemoveLabel,
        onCreateLabel,
        onCreateLabelAndAdd,
        onEditLabel,
        isFixedInSidebar: fixedNoteId === note.id,
        onToggleFixInSidebar,
        onContentChange: isSelected ? onContentChange : undefined,
        assigneeName: assigneeNamesCache.get(note.id),
        assignees: noteAssigneesCache.get(note.id) ?? [],
        compactView,
        isDescriptionFocused: isDescriptionFocused && isSelected,
        contacts,
        onAddAssignee,
        onRemoveAssignee,
        onUpdateAssignee,
        isDeleted: extraProps?.isDeleted,
        onRestore: extraProps?.onRestore,
        hideDeadline: extraProps?.hideDeadline,
      };
    },
    [
      selectedNote?.id,
      onDeleteWithToast,
      onToggleCompleted,
      onTogglePinned,
      onSelect,
      onEdit,
      onNavigateDown,
      onNavigateUp,
      onNavigateToDescription,
      focusTarget,
      desiredColumn,
      onTitleFocused,
      onCreateNoteAfter,
      noteLabelsCache,
      allLabels,
      onAddLabel,
      onRemoveLabel,
      onCreateLabel,
      onCreateLabelAndAdd,
      onEditLabel,
      fixedNoteId,
      onToggleFixInSidebar,
      onContentChange,
      assigneeNamesCache,
      noteAssigneesCache,
      compactView,
      isDescriptionFocused,
      contacts,
      onAddAssignee,
      onRemoveAssignee,
    ]
  );

  return getNoteRowProps;
}

/**
 * Type for the return value of useNoteRowProps
 */
export type GetNoteRowProps = ReturnType<typeof useNoteRowProps>;
