import { useEffect, useRef, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trash2,
  Calendar,
  Pickaxe,
  Forward,
  GripVertical,
  StickyNote,
  Plus,
  Pencil,
  Pin,
  PanelRightOpen,
  Users,
  Check,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
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
import { parseLocalDate } from '@/utils/dateUtils';

export interface NoteRowProps {
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
  isCommandPaletteOpen?: boolean;
  onAutoLabel?: (noteId: string, content: string, description?: string | null) => void;
  isFixedInSidebar?: boolean;
  onToggleFixInSidebar?: () => void;
}

/**
 * Individual note row component with inline editing, drag-and-drop, labels, and actions
 */
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
  isCommandPaletteOpen,
  onAutoLabel,
  isFixedInSidebar = false,
  onToggleFixInSidebar,
}: NoteRowProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [contentValue, setContentValue] = useState(note.content);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
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
          // CRITICAL FIX: Ensure desiredColumn is clamped to actual text length
          // This prevents cursor jumping when navigating between tasks of different lengths
          const actualLength = contentInputRef.current.value.length;
          const safePosition = Math.max(0, Math.min(desiredColumn, actualLength));
          contentInputRef.current.setSelectionRange(safePosition, safePosition);
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
    // Don't exit edit mode if command palette is open (focus will be restored)
    if (isCommandPaletteOpen) {
      return;
    }
    if (contentValue.trim() && contentValue !== note.content) {
      const trimmedValue = contentValue.trim();
      setContentValue(trimmedValue);
      onEdit(note.id, trimmedValue, note.category, note.description);
      // Trigger auto-labeling when content is saved
      onAutoLabel?.(note.id, trimmedValue, note.description);
    } else if (!contentValue.trim()) {
      setContentValue(note.content);
    } else if (contentValue.trim() && labels.length === 0) {
      // Content unchanged but no labels - still try to auto-label
      onAutoLabel?.(note.id, contentValue.trim(), note.description);
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
    } else if (e.key === 'c' && e.ctrlKey) {
      e.preventDefault();
      setShowCategoryDropdown(true);
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
        className={`group grid grid-cols-[24px_1fr_84px] py-0.5 hover:bg-muted/30 transition-colors cursor-pointer ${note.completed && note.category !== 'notes' ? 'opacity-50' : ''} ${isSelected ? 'bg-muted/50' : ''} ${isDragging ? 'opacity-50 bg-muted/30' : ''}`}
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

        <div className={`px-2 select-none py-0.5 flex flex-col gap-0.5 ${isEditingContent ? '' : 'overflow-hidden'}`} onClick={handleContentClick}>
          {/* Title row */}
          <div className="flex items-center gap-1.5">
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
            ) : note.category === 'meeting' ? (
              <Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
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
                    // Don't blur if clicking inside the label or category dropdown
                    if (showLabelDropdown || showCategoryDropdown) return;
                    handleContentBlur();
                  }}
                  onKeyDown={handleContentKeyDown}
                  className="flex-1 min-w-0 text-sm leading-normal bg-transparent border-none outline-none p-0 m-0"
                />
                <Popover open={showLabelDropdown} onOpenChange={(open) => {
                  setShowLabelDropdown(open);
                  if (!open) {
                    contentInputRef.current?.focus();
                  }
                }}>
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
                <Popover open={showCategoryDropdown} onOpenChange={(open) => {
                  setShowCategoryDropdown(open);
                  if (!open) {
                    contentInputRef.current?.focus();
                  }
                }}>
                  <PopoverTrigger asChild>
                    <span className="sr-only">{t('category')}</span>
                  </PopoverTrigger>
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
                              setShowCategoryDropdown(false);
                              contentInputRef.current?.focus();
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
                              setShowCategoryDropdown(false);
                              contentInputRef.current?.focus();
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
                              setShowCategoryDropdown(false);
                              contentInputRef.current?.focus();
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
                              setShowCategoryDropdown(false);
                              contentInputRef.current?.focus();
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
            {note.deadline && (
              <div className={`flex items-center gap-1 shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                parseLocalDate(note.deadline) < new Date() && !note.completed
                  ? 'text-destructive bg-destructive/10'
                  : 'text-muted-foreground bg-muted'
              }`}>
                <Calendar className="h-3 w-3" />
                <span>{parseLocalDate(note.deadline).toLocaleDateString()}</span>
              </div>
            )}
          </div>
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
          {onToggleFixInSidebar && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={`transition-opacity p-1.5 cursor-pointer ${isFixedInSidebar ? 'text-blue-500 opacity-100' : 'opacity-0 group-hover:opacity-100 text-muted-foreground/60 hover:text-blue-500'}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFixInSidebar();
                  }}
                >
                  <PanelRightOpen className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isFixedInSidebar ? t('unfixFromSidebar') : t('fixToSidebar')}</p>
              </TooltipContent>
            </Tooltip>
          )}
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

/**
 * Memoized version of NoteRow to prevent unnecessary re-renders
 * Only re-renders when relevant props actually change
 */
export const MemoizedNoteRow = memo(
  NoteRow,
  (prevProps, nextProps) => {
    // Return true if props are equal (should NOT re-render)
    // Return false if props are different (should re-render)

    // Core note properties that affect rendering
    if (prevProps.note.id !== nextProps.note.id) return false;
    if (prevProps.note.content !== nextProps.note.content) return false;
    if (prevProps.note.category !== nextProps.note.category) return false;
    if (prevProps.note.updated_at !== nextProps.note.updated_at) return false;
    if (prevProps.note.completed_at !== nextProps.note.completed_at) return false;
    if (prevProps.note.deadline !== nextProps.note.deadline) return false;
    if (prevProps.note.pinned !== nextProps.note.pinned) return false;
    if (prevProps.note.sort_order !== nextProps.note.sort_order) return false;

    // Selection state (most important for click performance)
    if (prevProps.isSelected !== nextProps.isSelected) return false;

    // Focus and navigation state
    if (prevProps.shouldFocusTitle !== nextProps.shouldFocusTitle) return false;
    if (prevProps.desiredColumn !== nextProps.desiredColumn) return false;
    if (prevProps.isDragging !== nextProps.isDragging) return false;
    if (prevProps.isCommandPaletteOpen !== nextProps.isCommandPaletteOpen) return false;

    // Labels comparison (array of objects)
    const prevLabels = prevProps.labels || [];
    const nextLabels = nextProps.labels || [];
    if (prevLabels.length !== nextLabels.length) return false;
    // Compare label IDs (shallow comparison is sufficient since labels are managed separately)
    for (let i = 0; i < prevLabels.length; i++) {
      if (prevLabels[i].id !== nextLabels[i].id) return false;
    }

    // AllLabels comparison (only check length for performance, full comparison not needed)
    const prevAllLabels = prevProps.allLabels || [];
    const nextAllLabels = nextProps.allLabels || [];
    if (prevAllLabels.length !== nextAllLabels.length) return false;

    // Callback props - with useCallback in parent, these should be stable references
    // If callbacks change, we need to re-render
    if (prevProps.onDeleteWithToast !== nextProps.onDeleteWithToast) return false;
    if (prevProps.onToggleCompleted !== nextProps.onToggleCompleted) return false;
    if (prevProps.onTogglePinned !== nextProps.onTogglePinned) return false;
    if (prevProps.onSelect !== nextProps.onSelect) return false;
    if (prevProps.onEdit !== nextProps.onEdit) return false;
    if (prevProps.onNavigateDown !== nextProps.onNavigateDown) return false;
    if (prevProps.onNavigateUp !== nextProps.onNavigateUp) return false;
    if (prevProps.onNavigateToDescription !== nextProps.onNavigateToDescription) return false;
    if (prevProps.onTitleFocused !== nextProps.onTitleFocused) return false;
    if (prevProps.onCreateNoteAfter !== nextProps.onCreateNoteAfter) return false;
    if (prevProps.onAddLabel !== nextProps.onAddLabel) return false;
    if (prevProps.onRemoveLabel !== nextProps.onRemoveLabel) return false;
    if (prevProps.onCreateLabel !== nextProps.onCreateLabel) return false;
    if (prevProps.onEditLabel !== nextProps.onEditLabel) return false;
    if (prevProps.onAutoLabel !== nextProps.onAutoLabel) return false;
    if (prevProps.isFixedInSidebar !== nextProps.isFixedInSidebar) return false;
    if (prevProps.onToggleFixInSidebar !== nextProps.onToggleFixInSidebar) return false;

    // All props are equal, don't re-render
    return true;
  }
);
