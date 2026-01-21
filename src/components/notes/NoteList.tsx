import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Clock, Calendar, Search, Pickaxe, Forward, GripVertical, StickyNote, Tag, Plus, X, Pencil, Pin } from 'lucide-react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ColorPicker } from '@/components/ui/color-picker';
import { EditableDescription, type EditableDescriptionHandle } from '@/components/ui/EditableDescription';
import { useNoteHistory } from '@/hooks/useNoteHistory';
import { useLabels } from '@/hooks/useLabels';
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
import type { Note, NoteCategory, Label } from '@/types/note';

interface NoteListProps {
  notes: Note[];
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onDelete: (id: string) => void;
  onRestore: (note: Note) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  onReorderNotes: (orderedIds: string[]) => void;
  selectedNote: Note | null;
  onSelectNote: (note: Note | null) => void;
  onNavigateToEditor?: (column: number) => void;
  onCreateNoteAfter?: (afterNoteId: string, category: NoteCategory) => Promise<Note>;
  // External filter control (from CommandPalette)
  externalLabelFilter?: string[];
  externalCategoryFilter?: NoteCategory | 'all';
  onLabelFilterChange?: (labels: string[]) => void;
  onCategoryFilterChange?: (category: NoteCategory | 'all') => void;
}

interface NoteRowProps {
  note: Note;
  onDeleteWithToast: (note: Note) => void;
  onToggleCompleted: (id: string, completed: boolean) => void;
  onTogglePinned: (id: string, pinned: boolean) => void;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onNavigateDown: (column: number) => boolean;
  onNavigateUp: (column: number) => boolean;
  onNavigateToDescription: () => void;
  shouldFocusTitle: boolean;
  desiredColumn: number;
  onTitleFocused: () => void;
  onCreateNoteAfter?: () => void;
  isDragging?: boolean;
  labels?: Label[];
  allLabels?: Label[];
  onAddLabel?: (labelId: string) => void;
  onRemoveLabel?: (labelId: string) => void;
  onCreateLabel?: () => void;
  onEditLabel?: (label: Label) => void;
}

function NoteRow({
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
  shouldFocusTitle,
  desiredColumn,
  onTitleFocused,
  onCreateNoteAfter,
  isDragging,
  labels = [],
  allLabels = [],
  onAddLabel,
  onRemoveLabel,
  onCreateLabel,
  onEditLabel,
}: NoteRowProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [contentValue, setContentValue] = useState(note.content);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const clickCaretPosRef = useRef<number | null>(null);
  const focusFromNavigationRef = useRef(false);
  const hasAutoFocusedRef = useRef(false);

  // Auto-focus empty notes when selected (newly created notes)
  useEffect(() => {
    if (isSelected && note.content === '' && !hasAutoFocusedRef.current) {
      hasAutoFocusedRef.current = true;
      setIsEditingContent(true);
      // Use setTimeout to ensure the input is rendered before focusing
      setTimeout(() => {
        contentInputRef.current?.focus();
      }, 0);
    }
    // Reset the flag when note is deselected
    if (!isSelected) {
      hasAutoFocusedRef.current = false;
    }
  }, [isSelected, note.content]);

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

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  useEffect(() => {
    setContentValue(note.content);
  }, [note.content]);

  useEffect(() => {
    if (isEditingContent && contentInputRef.current) {
      // Skip if focus is coming from arrow navigation (handled separately)
      if (focusFromNavigationRef.current) {
        focusFromNavigationRef.current = false;
        return;
      }
      contentInputRef.current.focus();
      // If we have a click position stored, apply it immediately
      if (clickCaretPosRef.current !== null) {
        contentInputRef.current.setSelectionRange(clickCaretPosRef.current, clickCaretPosRef.current);
        clickCaretPosRef.current = null;
      }
    }
  }, [isEditingContent]);

  // Focus externo desde el padre (navegación con flechas)
  useEffect(() => {
    if (shouldFocusTitle && isSelected) {
      // Mark that focus is from navigation to prevent duplicate focus in isEditingContent effect
      focusFromNavigationRef.current = true;
      setIsEditingContent(true);
      // Use setTimeout to ensure the input is rendered before focusing
      setTimeout(() => {
        if (contentInputRef.current) {
          contentInputRef.current.focus();
          const pos = Math.min(desiredColumn, contentInputRef.current.value.length);
          contentInputRef.current.setSelectionRange(pos, pos);
        }
      }, 0);
      onTitleFocused();
    }
  }, [shouldFocusTitle, isSelected, desiredColumn, onTitleFocused]);

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleCheckedChange = () => {
    onToggleCompleted(note.id, !note.completed);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = () => {
    onDeleteWithToast(note);
    setShowDeleteDialog(false);
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onSelect();

    // Calculate approximate caret position from click
    const target = e.currentTarget;
    const span = target.querySelector('span');
    if (span) {
      // Get click position relative to the text
      const rect = span.getBoundingClientRect();
      const clickX = e.clientX - rect.left;

      // Measure character positions using canvas for accuracy
      const text = note.content;
      const computedStyle = window.getComputedStyle(span);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      let clickPos = text.length;
      if (ctx) {
        ctx.font = `${computedStyle.fontStyle} ${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;

        // Find position by checking midpoint of each character
        for (let i = 0; i < text.length; i++) {
          const widthBefore = ctx.measureText(text.substring(0, i)).width;
          const widthAfter = ctx.measureText(text.substring(0, i + 1)).width;
          const charMidpoint = (widthBefore + widthAfter) / 2;

          if (clickX < charMidpoint) {
            clickPos = i;
            break;
          }
        }
      }

      // Store position in ref so useEffect can apply it immediately after focus
      clickCaretPosRef.current = clickPos;
      setIsEditingContent(true);
    } else {
      setIsEditingContent(true);
    }
  };

  const handleContentBlur = () => {
    if (contentValue.trim() && contentValue !== note.content) {
      const trimmedValue = contentValue.trim();
      setContentValue(trimmedValue);
      onEdit(note.id, trimmedValue, note.category, note.description);
    } else if (!contentValue.trim()) {
      setContentValue(note.content);
    }
    setIsEditingContent(false);
  };

  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    // Handle Ctrl+D first to prevent browser default behavior (which can delete selected text)
    if (e.key === 'd' && e.ctrlKey && note.category !== 'notes') {
      e.preventDefault();
      e.stopPropagation();
      // Save current content first before toggling
      if (contentValue.trim() && contentValue !== note.content) {
        onEdit(note.id, contentValue.trim(), note.category, note.description);
      }
      onToggleCompleted(note.id, !note.completed);
      return;
    }
    if (e.key === 'Backspace' && e.ctrlKey) {
      e.preventDefault();
      e.stopPropagation();
      setIsEditingContent(false);
      onDeleteWithToast(note);
      return;
    }
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      setShowLabelDropdown(true);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Save current content first
      if (contentValue.trim() && contentValue !== note.content) {
        onEdit(note.id, contentValue.trim(), note.category, note.description);
      }
      setIsEditingContent(false);
      // Create new note after this one
      onCreateNoteAfter?.();
    } else if (e.key === 'Backspace' && contentValue === '') {
      e.preventDefault();
      setIsEditingContent(false);
      onDeleteWithToast(note);
    } else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      handleContentBlur();
      // Jump to description (always, even if empty)
      onNavigateToDescription();
    } else if (e.key === 'ArrowDown') {
      const column = contentInputRef.current?.selectionStart ?? 0;
      const didNavigate = onNavigateDown(column);
      if (didNavigate) {
        e.preventDefault();
        handleContentBlur();
      }
    } else if (e.key === 'ArrowUp') {
      const column = contentInputRef.current?.selectionStart ?? 0;
      const didNavigate = onNavigateUp(column);
      if (didNavigate) {
        e.preventDefault();
        handleContentBlur();
      }
    } else if (e.key === 'Escape') {
      setContentValue(note.content);
      setIsEditingContent(false);
    }
  };

  return (
    <>
      <div
        ref={(node) => {
          setNodeRef(node);
          // Also set the rowRef for scrolling
          (rowRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        style={style}
        onClick={onSelect}
        className={`group grid grid-cols-[24px_1fr_56px] py-0.5 hover:bg-muted/30 transition-colors cursor-pointer ${note.completed && note.category !== 'notes' ? 'opacity-50' : ''} ${isSelected ? 'bg-muted/50' : ''} ${isDragging ? 'opacity-50 bg-muted/30' : ''}`}
      >
        <div
          className="flex items-center justify-center cursor-pointer select-none"
          onClick={note.category !== 'notes' ? handleToggle : undefined}
        >
          {note.category !== 'notes' && (
            note.completed ? (
              <Checkbox
                checked={true}
                onCheckedChange={handleCheckedChange}
              />
            ) : (
              <Checkbox
                checked={false}
                onCheckedChange={handleCheckedChange}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
              />
            )
          )}
        </div>

        <div className={`px-2 select-none py-0.5 flex items-center gap-1.5 ${isEditingContent ? '' : 'overflow-hidden'}`} onClick={handleContentClick}>
          <div
            className="flex items-center justify-center cursor-grab active:cursor-grabbing select-none touch-none shrink-0"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
          </div>
          {note.category === 'todo' ? (
            <Pickaxe className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          ) : note.category === 'followup' ? (
            <Forward className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          ) : (
            <StickyNote className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
          )}
          {isEditingContent ? (
            <>
              <input
                ref={contentInputRef}
                type="text"
                value={contentValue}
                onChange={(e) => setContentValue(e.target.value)}
                onBlur={() => {
                  // Don't blur if clicking inside the label dropdown
                  if (showLabelDropdown) return;
                  handleContentBlur();
                }}
                onKeyDown={handleContentKeyDown}
                className="flex-1 min-w-0 text-sm leading-normal bg-transparent border-none outline-none p-0 m-0"
              />
              <Popover open={showLabelDropdown} onOpenChange={setShowLabelDropdown}>
                <PopoverTrigger asChild>
                  <span className="sr-only">Labels</span>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('searchLabels')} className="h-9" />
                    <CommandList>
                      <CommandEmpty>{t('noLabelsFound')}</CommandEmpty>
                      <CommandGroup>
                        {allLabels.map((label) => {
                          const isAssigned = labels.some(l => l.id === label.id);
                          return (
                            <CommandItem
                              key={label.id}
                              value={label.name}
                              onSelect={() => {
                                if (isAssigned) {
                                  onRemoveLabel?.(label.id);
                                } else {
                                  onAddLabel?.(label.id);
                                }
                                setShowLabelDropdown(false);
                                contentInputRef.current?.focus();
                              }}
                              className="group flex items-center justify-between"
                            >
                              <div className="flex items-center">
                                <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: label.color }} />
                                {label.name}
                                {isAssigned && <span className="ml-2 text-xs text-muted-foreground">✓</span>}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditLabel?.(label);
                                  setShowLabelDropdown(false);
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-opacity"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                      <CommandSeparator />
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            onCreateLabel?.();
                            setShowLabelDropdown(false);
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
            </>
          ) : (
            <span className={`text-sm leading-normal truncate ${note.completed ? 'line-through text-muted-foreground' : ''} ${isSelected ? 'cursor-text' : ''}`}>
              {contentValue}
            </span>
          )}
          {labels.length > 0 && (
            <div className="flex gap-1 shrink-0">
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
        </div>

        <div className="flex items-center justify-center gap-0.5 select-none">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className={`transition-opacity p-1.5 cursor-pointer ${note.pinned ? 'text-primary opacity-100' : 'opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-primary'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePinned(note.id, !note.pinned);
                }}
              >
                <Pin className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{note.pinned ? t('unpin') : t('pin')}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-destructive p-1.5 cursor-pointer"
                onClick={handleDeleteClick}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('deleteTask')}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('deleteNote')}</DialogTitle>
            <DialogDescription>{t('confirmDelete')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {t('cancel')}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              {t('delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type FocusTarget = 'title' | 'description-start' | 'description-end' | null;

// Helper to format date/time
function formatDateTime(isoString: string, locale: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(isoString: string, locale: string): string {
  const date = new Date(isoString);
  return date.toLocaleString(locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}


export interface NoteListHandle {
  focusFirstTaskTitle: (column?: number) => void;
}

// Helper to get column position (position within current line)
function getColumnPosition(text: string, cursorPos: number): number {
  const textBeforeCursor = text.substring(0, cursorPos);
  const lastNewline = textBeforeCursor.lastIndexOf('\n');
  return lastNewline === -1 ? cursorPos : cursorPos - lastNewline - 1;
}

export const NoteList = forwardRef<NoteListHandle, NoteListProps>(function NoteList({ notes, onEdit, onDelete, onRestore, onToggleCompleted, onTogglePinned, onReorderNotes, selectedNote, onSelectNote, onNavigateToEditor, onCreateNoteAfter, externalLabelFilter, externalCategoryFilter, onLabelFilterChange, onCategoryFilterChange }, ref) {
  const { t, i18n } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<EditableDescriptionHandle>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [descriptionValue, setDescriptionValue] = useState('');
  const [focusTarget, setFocusTarget] = useState<FocusTarget>(null);
  const [desiredColumn, setDesiredColumn] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [internalCategoryFilter, setInternalCategoryFilter] = useState<NoteCategory | 'all'>('all');
  const { history } = useNoteHistory(selectedNote?.id ?? null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Labels state
  const { labels, getLabelsForNote, addLabelToNote, removeLabelFromNote, createLabel, updateLabel, noteLabelVersion } = useLabels();
  const [internalLabelFilter, setInternalLabelFilter] = useState<string[]>([]);

  // Use external filters if provided, otherwise use internal state
  const labelFilter = externalLabelFilter ?? internalLabelFilter;
  const categoryFilter = externalCategoryFilter ?? internalCategoryFilter;

  const setLabelFilter = (value: string[] | ((prev: string[]) => string[])) => {
    const newValue = typeof value === 'function' ? value(labelFilter) : value;
    if (onLabelFilterChange) {
      onLabelFilterChange(newValue);
    } else {
      setInternalLabelFilter(newValue);
    }
  };

  const setCategoryFilter = (value: NoteCategory | 'all') => {
    if (onCategoryFilterChange) {
      onCategoryFilterChange(value);
    } else {
      setInternalCategoryFilter(value);
    }
  };
  const [noteLabels, setNoteLabels] = useState<Label[]>([]);
  const [showCreateLabelDialog, setShowCreateLabelDialog] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6b7280');
  const [editingLabel, setEditingLabel] = useState<Label | null>(null);
  const [editLabelName, setEditLabelName] = useState('');
  const [editLabelColor, setEditLabelColor] = useState('#6b7280');
  const [labelDropdownOpen, setLabelDropdownOpen] = useState(false);

  const LABEL_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
  ];

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = notes.findIndex((n) => n.id === active.id);
      const newIndex = notes.findIndex((n) => n.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newOrder = arrayMove(notes, oldIndex, newIndex);
        onReorderNotes(newOrder.map((n) => n.id));
      }
    }
  };

  const handleDragStart = (event: { active: { id: string | number } }) => {
    setActiveId(String(event.active.id));
  };

  // Filter notes based on search query, category, and labels
  const filteredNotes = notes.filter((note) => {
    // Filter by category
    if (categoryFilter !== 'all' && note.category !== categoryFilter) {
      return false;
    }
    // Filter by labels (OR logic - note must have at least one selected label)
    if (labelFilter.length > 0) {
      const noteLabelIds = getLabelsForNote(note.id).map(l => l.id);
      const hasMatchingLabel = labelFilter.some(labelId => noteLabelIds.includes(labelId));
      if (!hasMatchingLabel) return false;
    }
    // Filter by search query
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const titleMatch = note.content.toLowerCase().includes(query);
    const descriptionMatch = note.description?.toLowerCase().includes(query) ?? false;
    return titleMatch || descriptionMatch;
  }).sort((a, b) => {
    // Completed tasks always go to the bottom
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return 0;
  });

  // Load labels when selected note changes
  useEffect(() => {
    if (selectedNote) {
      setNoteLabels(getLabelsForNote(selectedNote.id));
    } else {
      setNoteLabels([]);
    }
  }, [selectedNote, getLabelsForNote]);

  const handleAddLabel = async (labelId: string) => {
    if (!selectedNote) return;
    await addLabelToNote(selectedNote.id, labelId);
    setNoteLabels(getLabelsForNote(selectedNote.id));
  };

  const handleRemoveLabel = async (labelId: string) => {
    if (!selectedNote) return;
    await removeLabelFromNote(selectedNote.id, labelId);
    setNoteLabels(getLabelsForNote(selectedNote.id));
  };

  const handleCreateLabel = async () => {
    if (!newLabelName.trim()) return;
    await createLabel(newLabelName.trim(), newLabelColor);
    setNewLabelName('');
    setNewLabelColor('#6b7280');
    setShowCreateLabelDialog(false);
  };

  const handleEditLabel = (label: Label) => {
    setEditingLabel(label);
    setEditLabelName(label.name);
    setEditLabelColor(label.color);
    setLabelDropdownOpen(false);
  };

  const handleSaveEditLabel = async () => {
    if (!editingLabel || !editLabelName.trim()) return;
    await updateLabel(editingLabel.id, editLabelName.trim(), editLabelColor);
    setEditingLabel(null);
    setEditLabelName('');
    setEditLabelColor('#6b7280');
    if (selectedNote) {
      setNoteLabels(getLabelsForNote(selectedNote.id));
    }
  };

  const handleCreateNoteAfter = async (afterNoteId: string) => {
    if (!onCreateNoteAfter) return;
    const afterNote = filteredNotes.find((n) => n.id === afterNoteId);
    if (!afterNote) return;

    const newNote = await onCreateNoteAfter(afterNoteId, afterNote.category);
    // Select and focus the new note
    onSelectNote(newNote);
    setDesiredColumn(0);
    setFocusTarget('title');
  };

  const handleDeleteWithToast = (note: Note) => {
    const currentIndex = filteredNotes.findIndex((n) => n.id === note.id);

    // Determine where to navigate after deletion
    let targetNote: Note | null = null;
    let shouldNavigateToEditor = false;

    if (filteredNotes.length === 1) {
      // Last task, navigate to editor
      shouldNavigateToEditor = true;
    } else if (currentIndex > 0) {
      // Has task above, navigate to it
      targetNote = filteredNotes[currentIndex - 1];
    } else {
      // First task (no task above), navigate to task below
      targetNote = filteredNotes[currentIndex + 1];
    }

    // Delete first, then navigate
    onDelete(note.id);

    // Navigate after deletion
    if (shouldNavigateToEditor) {
      onSelectNote(null);
      onNavigateToEditor?.(0);
    } else if (targetNote) {
      onSelectNote(targetNote);
      // Position caret at end of text when navigating up, start when navigating down
      setDesiredColumn(currentIndex > 0 ? targetNote.content.length : 0);
      setFocusTarget('title');
    }

    toast(t('taskDeleted'), {
      action: {
        label: t('undo'),
        onClick: () => onRestore(note),
      },
    });
  };

  // Expose method to focus first task from parent
  useImperativeHandle(ref, () => ({
    focusFirstTaskTitle: (column?: number) => {
      if (filteredNotes.length > 0) {
        onSelectNote(filteredNotes[0]);
        setDesiredColumn(column ?? 0);
        setFocusTarget('title');
      }
    },
  }), [filteredNotes, onSelectNote]);

  // Update description value when selected note changes
  useEffect(() => {
    setDescriptionValue(selectedNote?.description || '');
  }, [selectedNote]);

  // Aplicar focus según focusTarget
  useEffect(() => {
    if (!focusTarget || !selectedNote) return;

    if (focusTarget === 'description-start' || focusTarget === 'description-end') {
      setTimeout(() => {
        descriptionRef.current?.focus();
        if (descriptionRef.current) {
          const value = descriptionValue;
          if (focusTarget === 'description-start') {
            // Use desired column on first line
            const firstLineLength = value.indexOf('\n') === -1 ? value.length : value.indexOf('\n');
            const pos = Math.min(desiredColumn, firstLineLength);
            descriptionRef.current.setCursorPosition(pos);
          } else {
            // Use desired column on last line
            const lines = value.split('\n');
            const lastLineLength = lines[lines.length - 1].length;
            const lastLineStart = value.length - lastLineLength;
            const pos = lastLineStart + Math.min(desiredColumn, lastLineLength);
            descriptionRef.current.setCursorPosition(pos);
          }
        }
        setFocusTarget(null);
      }, 0);
    }
    // 'title' se maneja via prop shouldFocusTitle en NoteRow
  }, [focusTarget, selectedNote, desiredColumn, descriptionValue]);

  // ↓ desde título - returns true if navigation occurred
  const handleNavigateDownFromTitle = (noteId: string, column: number): boolean => {
    const idx = filteredNotes.findIndex((n) => n.id === noteId);
    if (idx < filteredNotes.length - 1) {
      setDesiredColumn(column);
      onSelectNote(filteredNotes[idx + 1]);
      setFocusTarget('title');
      return true;
    }
    return false;
  };

  // ↑ desde título - returns true if navigation occurred
  const handleNavigateUpFromTitle = (noteId: string, column: number): boolean => {
    const idx = filteredNotes.findIndex((n) => n.id === noteId);
    if (idx > 0) {
      setDesiredColumn(column);
      const prevNote = filteredNotes[idx - 1];
      onSelectNote(prevNote);
      setFocusTarget('title');
      return true;
    } else if (idx === 0) {
      // On first task, navigate to the search bar
      onSelectNote(null);
      searchInputRef.current?.focus();
      return true;
    }
    return false;
  };

  const handleTitleFocused = () => {
    if (focusTarget === 'title') {
      setFocusTarget(null);
    }
  };

  // Tab from title - always go to description (even if empty)
  const handleNavigateToDescription = () => {
    setDesiredColumn(0);
    setFocusTarget('description-start');
  };

  // Save description when it changes and user stops typing
  const handleDescriptionBlur = () => {
    if (selectedNote && descriptionValue !== (selectedNote.description || '')) {
      onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
    }
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setDescriptionValue(selectedNote?.description || '');
      descriptionRef.current?.blur();
    } else if (e.key === 'Tab' && e.shiftKey && selectedNote) {
      e.preventDefault();
      // Save current description
      if (descriptionValue !== (selectedNote.description || '')) {
        onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
      }
      // Go back to the title
      setDesiredColumn(selectedNote.content.length);
      setFocusTarget('title');
    } else if (e.key === 'ArrowDown' && selectedNote) {
      const selectionInfo = descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        const { cursorPosition, text } = selectionInfo;
        const textAfterCursor = text.substring(cursorPosition);
        const isOnLastLine = !textAfterCursor.includes('\n');

        if (isOnLastLine) {
          e.preventDefault();
          // Capture column position before navigating
          const column = getColumnPosition(text, cursorPosition);
          setDesiredColumn(column);
          // Save current description
          if (descriptionValue !== (selectedNote.description || '')) {
            onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
          }
          // Move to next note's title
          const currentIndex = filteredNotes.findIndex((n) => n.id === selectedNote.id);
          if (currentIndex < filteredNotes.length - 1) {
            onSelectNote(filteredNotes[currentIndex + 1]);
            setFocusTarget('title');
          }
        }
      }
    } else if (e.key === 'ArrowUp' && selectedNote) {
      const selectionInfo = descriptionRef.current?.getSelectionInfo();
      if (selectionInfo) {
        const { cursorPosition, text } = selectionInfo;
        const textBeforeCursor = text.substring(0, cursorPosition);
        const isOnFirstLine = !textBeforeCursor.includes('\n');

        if (isOnFirstLine) {
          e.preventDefault();
          // Capture column position before navigating
          const column = getColumnPosition(text, cursorPosition);
          setDesiredColumn(column);
          // Save current description
          if (descriptionValue !== (selectedNote.description || '')) {
            onEdit(selectedNote.id, selectedNote.content, selectedNote.category, descriptionValue || null);
          }
          // Go to title of the SAME task (not previous)
          setFocusTarget('title');
        }
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+F to focus search bar (works from anywhere)
      if (e.key === 'f' && e.ctrlKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Don't handle if we're typing in any text input (INPUT, TEXTAREA, or contenteditable)
      const activeEl = document.activeElement as HTMLElement;
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable) {
        return;
      }

      // Ctrl+D to toggle checkbox when a task is selected
      if (e.key === 'd' && e.ctrlKey && selectedNote && selectedNote.category !== 'notes') {
        e.preventDefault();
        onToggleCompleted(selectedNote.id, !selectedNote.completed);
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!selectedNote && filteredNotes.length > 0) {
          onSelectNote(filteredNotes[0]);
          setFocusTarget('title');
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (!selectedNote && filteredNotes.length > 0) {
          onSelectNote(filteredNotes[filteredNotes.length - 1]);
          setFocusTarget('title');
        }
      } else if (e.key === 'Escape') {
        onSelectNote(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNote, filteredNotes, onSelectNote, onToggleCompleted]);

  if (notes.length === 0) {
    return (
      <p className="text-center text-muted-foreground/60 py-8 text-sm italic">
        {t('noNotes')}
      </p>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden" tabIndex={0}>
      <div className="flex gap-2 mb-3 flex-shrink-0">
        <div className="relative w-48">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground/50" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' && filteredNotes.length > 0) {
                e.preventDefault();
                onSelectNote(filteredNotes[0]);
                setDesiredColumn(0);
                setFocusTarget('title');
              } else if (e.key === 'Escape') {
                setSearchQuery('');
                searchInputRef.current?.blur();
              }
            }}
            placeholder={t('searchNotes')}
            className="w-full pl-7 h-7 text-xs bg-transparent border border-muted-foreground/20 rounded-md outline-none focus:border-muted-foreground/40 transition-colors"
          />
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === 'todo' ? 'all' : 'todo')}
            className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md border transition-colors ${
              categoryFilter === 'todo'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
            }`}
            title={t('categoryTodo')}
          >
            <Pickaxe className="h-3.5 w-3.5" />
            <span>{t('categoryTodo')}</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === 'followup' ? 'all' : 'followup')}
            className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md border transition-colors ${
              categoryFilter === 'followup'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
            }`}
            title={t('categoryFollowUp')}
          >
            <Forward className="h-3.5 w-3.5" />
            <span>{t('categoryFollowUp')}</span>
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter(categoryFilter === 'notes' ? 'all' : 'notes')}
            className={`flex items-center gap-1.5 px-2.5 h-7 text-xs rounded-md border transition-colors ${
              categoryFilter === 'notes'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
            }`}
            title={t('categoryNotes')}
          >
            <StickyNote className="h-3.5 w-3.5" />
            <span>{t('categoryNotes')}</span>
          </button>
        </div>
        {/* Label filters */}
        {labels.length > 0 && (
          <div className="flex gap-1 items-center ml-2 pl-2 border-l border-muted-foreground/20">
            <Tag className="h-3.5 w-3.5 text-muted-foreground" />
            {labels.map((label) => (
              <button
                key={label.id}
                type="button"
                onClick={() => {
                  setLabelFilter(prev =>
                    prev.includes(label.id)
                      ? prev.filter(id => id !== label.id)
                      : [...prev, label.id]
                  );
                }}
                className={`px-2 h-6 text-xs rounded-full border transition-colors ${
                  labelFilter.includes(label.id)
                    ? 'text-white border-transparent'
                    : 'bg-transparent border-muted-foreground/20 text-muted-foreground hover:border-muted-foreground/40'
                }`}
                style={{
                  backgroundColor: labelFilter.includes(label.id) ? label.color : 'transparent'
                }}
              >
                {label.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="w-[38rem] shrink-0 flex flex-col overflow-hidden">
          <div className="overflow-y-auto pr-2 flex-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredNotes.map((n) => n.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredNotes.map((note) => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    onDeleteWithToast={handleDeleteWithToast}
                    onToggleCompleted={onToggleCompleted}
                    onTogglePinned={onTogglePinned}
                    isSelected={selectedNote?.id === note.id}
                    onSelect={() => onSelectNote(note)}
                    onEdit={onEdit}
                    onNavigateDown={(column) => handleNavigateDownFromTitle(note.id, column)}
                    onNavigateUp={(column) => handleNavigateUpFromTitle(note.id, column)}
                    onNavigateToDescription={handleNavigateToDescription}
                    shouldFocusTitle={focusTarget === 'title' && selectedNote?.id === note.id}
                    desiredColumn={desiredColumn}
                    onTitleFocused={handleTitleFocused}
                    onCreateNoteAfter={() => handleCreateNoteAfter(note.id)}
                    isDragging={activeId === note.id}
                    labels={noteLabelVersion >= 0 ? getLabelsForNote(note.id) : []}
                    allLabels={labels}
                    onAddLabel={async (labelId) => {
                      await addLabelToNote(note.id, labelId);
                    }}
                    onRemoveLabel={async (labelId) => {
                      await removeLabelFromNote(note.id, labelId);
                    }}
                    onCreateLabel={() => setShowCreateLabelDialog(true)}
                    onEditLabel={handleEditLabel}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
        </div>

      <div className="flex-1 min-w-0 border-l border-dashed border-muted-foreground/20 pl-4 overflow-hidden flex flex-col">
        {selectedNote ? (
          <>
            <h1 className={`text-lg font-semibold mb-2 flex-shrink-0 ${selectedNote.completed ? 'line-through text-muted-foreground' : ''}`}>
              {selectedNote.content}
            </h1>
            <div className="flex flex-wrap gap-1 mb-2 flex-shrink-0 items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onEdit(selectedNote.id, selectedNote.content, 'todo', selectedNote.description)}
                    className={`p-1.5 rounded-md transition-colors ${
                      selectedNote.category === 'todo'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Pickaxe className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('categoryTodo')}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onEdit(selectedNote.id, selectedNote.content, 'followup', selectedNote.description)}
                    className={`p-1.5 rounded-md transition-colors ${
                      selectedNote.category === 'followup'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Forward className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('categoryFollowUp')}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onEdit(selectedNote.id, selectedNote.content, 'notes', selectedNote.description)}
                    className={`p-1.5 rounded-md transition-colors ${
                      selectedNote.category === 'notes'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <StickyNote className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('categoryNotes')}</p>
                </TooltipContent>
              </Tooltip>
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
                    onClick={() => handleRemoveLabel(label.id)}
                    className="hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Popover open={labelDropdownOpen} onOpenChange={setLabelDropdownOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="p-1 text-muted-foreground hover:bg-muted rounded-md"
                    title={t('addLabel')}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('searchLabels')} className="h-9" />
                    <CommandList>
                      <CommandEmpty>{t('noLabelsFound')}</CommandEmpty>
                      <CommandGroup>
                        {labels.filter(l => !noteLabels.some(nl => nl.id === l.id)).map((label) => (
                          <CommandItem
                            key={label.id}
                            value={label.name}
                            onSelect={() => {
                              handleAddLabel(label.id);
                              setLabelDropdownOpen(false);
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
                                handleEditLabel(label);
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
                            setShowCreateLabelDialog(true);
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
            </div>
            <EditableDescription
              ref={descriptionRef}
              value={descriptionValue}
              onChange={setDescriptionValue}
              onBlur={handleDescriptionBlur}
              onKeyDown={handleDescriptionKeyDown}
              placeholder={t('writeDescription')}
              className="flex-1 min-h-0 w-full text-sm bg-transparent text-muted-foreground overflow-y-auto"
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">
            {t('selectNoteToEdit')}
          </p>
        )}
      </div>

      <div className="w-56 shrink-0 border-l border-dashed border-muted-foreground/20 pl-4 overflow-y-auto">
        {selectedNote ? (
          <div className="space-y-4">
            {/* Creation date */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-1">
                <Calendar className="h-3 w-3" />
                <span>{t('createdAt')}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(selectedNote.created_at, i18n.language)}
              </p>
            </div>

            {/* Modification history */}
            {history.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 mb-2">
                  <Clock className="h-3 w-3" />
                  <span>{t('history')}</span>
                </div>
                <div className="space-y-2">
                  {history.map((entry) => (
                    <div
                      key={entry.id}
                      className="text-xs border-l-2 border-muted-foreground/20 pl-2 py-1"
                    >
                      <p className="text-muted-foreground/60 mb-0.5">
                        {formatDateTime(entry.changed_at, i18n.language)}
                      </p>
                      <p className="text-muted-foreground truncate" title={entry.content}>
                        {entry.content}
                      </p>
                      {entry.description && (
                        <p className="text-muted-foreground/50 truncate text-[10px]" title={entry.description}>
                          {entry.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {history.length === 0 && (
              <p className="text-xs text-muted-foreground/50 italic">
                {t('noHistory')}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground/50 italic">
            {t('selectNoteToEdit')}
          </p>
        )}
      </div>
      </div>

      {/* Create Label Dialog */}
      <Dialog open={showCreateLabelDialog} onOpenChange={setShowCreateLabelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('createLabel')}</DialogTitle>
            <DialogDescription>{t('newLabelName')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="text"
              value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder={t('newLabelName')}
              className="w-full px-3 py-2 text-sm border border-muted-foreground/20 rounded-md bg-transparent focus:outline-none focus:border-muted-foreground/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newLabelName.trim()) {
                  handleCreateLabel();
                }
              }}
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('labelColor')}</p>
              <ColorPicker
                color={newLabelColor}
                onChange={setNewLabelColor}
                presetColors={LABEL_COLORS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateLabelDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleCreateLabel} disabled={!newLabelName.trim()}>
              {t('create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Label Dialog */}
      <Dialog open={!!editingLabel} onOpenChange={(open) => !open && setEditingLabel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editLabel')}</DialogTitle>
            <DialogDescription>{t('editLabelDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <input
              type="text"
              value={editLabelName}
              onChange={(e) => setEditLabelName(e.target.value)}
              placeholder={t('newLabelName')}
              className="w-full px-3 py-2 text-sm border border-muted-foreground/20 rounded-md bg-transparent focus:outline-none focus:border-muted-foreground/40"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editLabelName.trim()) {
                  handleSaveEditLabel();
                }
              }}
            />
            <div>
              <p className="text-xs text-muted-foreground mb-2">{t('labelColor')}</p>
              <ColorPicker
                color={editLabelColor}
                onChange={setEditLabelColor}
                presetColors={LABEL_COLORS}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLabel(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={handleSaveEditLabel} disabled={!editLabelName.trim()}>
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
