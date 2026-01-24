import { useEffect, useRef, useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Trash2,
  Calendar,
  Pickaxe,
  Forward,
  StickyNote,
  Plus,
  Pencil,
  Pin,
  PanelRightOpen,
  Users,
  User,
  Check,
  RotateCcw,
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
  isFixedInSidebar = false,
  onToggleFixInSidebar,
  onContentChange,
  assigneeName,
  isDeleted = false,
  onRestore,
  compactView = false,
  isDescriptionFocused = false,
}: NoteRowProps) {
  const { t } = useTranslation();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [contentValue, setContentValue] = useState(note.content);
  const [showLabelDropdown, setShowLabelDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const contentInputRef = useRef<HTMLInputElement>(null);
  const clickXRef = useRef<number | null>(null);
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
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'auto' });
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
      // Caret positioning from click is now handled in onFocus handler
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
    onSelect(note.id);

    // Get click position relative to where user actually clicked
    // e.target is the actual element clicked (should be the text span)
    const target = e.target as HTMLElement;
    if (target.tagName === 'SPAN' && target.textContent === contentValue) {
      const rect = target.getBoundingClientRect();
      clickXRef.current = e.clientX - rect.left;
    }
    setIsEditingContent(true);
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
    if (e.key === 'l' && e.altKey) {
      e.preventDefault();
      setShowLabelDropdown(true);
    } else if (e.key === 'c' && e.altKey) {
      e.preventDefault();
      setShowCategoryDropdown(true);
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Save current content first
      if (contentValue.trim() && contentValue !== note.content) {
        onEdit(note.id, contentValue.trim(), note.category, note.description);
      }
      setIsEditingContent(false);
      // Create new note after this one (but not for completed or deleted tasks)
      if (!note.completed && !isDeleted) {
        onCreateNoteAfter?.(note.id);
      }
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
      const didNavigate = onNavigateDown(note.id, column);
      if (didNavigate) {
        e.preventDefault();
        handleContentBlur();
      }
    } else if (e.key === 'ArrowUp') {
      const column = contentInputRef.current?.selectionStart ?? 0;
      const didNavigate = onNavigateUp(note.id, column);
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
        onClick={() => onSelect(note.id)}
        className={`group grid grid-cols-[auto_1fr_auto] items-center h-6 hover:bg-muted/30 transition-colors cursor-pointer ${note.completed && note.category !== 'notes' ? 'opacity-50' : ''} ${isDragging ? 'opacity-50 bg-muted/30' : ''}`}
      >
        {/* Category icon column - hidden in compact view */}
        {!compactView ? (
          note.category !== 'notes' ? (
            <div
              className="relative w-4 h-4 shrink-0 cursor-pointer flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                handleCheckedChange();
              }}
            >
              {/* Category icon - hidden on hover when not completed */}
              <span className={`flex items-center justify-center ${note.completed ? 'hidden' : 'group-hover:hidden'}`}>
                {note.category === 'todo' ? (
                  <Pickaxe className="h-4 w-4 text-muted-foreground/70" />
                ) : note.category === 'followup' ? (
                  <Forward className="h-4 w-4 text-muted-foreground/70" />
                ) : (
                  <Users className="h-4 w-4 text-muted-foreground/70" />
                )}
              </span>
              {/* Checkbox - shown on hover or when completed */}
              <span className={`absolute flex items-center justify-center ${note.completed ? 'flex' : 'hidden group-hover:flex'}`}>
                <Checkbox
                  checked={note.completed}
                  onCheckedChange={handleCheckedChange}
                />
              </span>
            </div>
          ) : (
            <div className="h-4 flex items-center">
              <StickyNote className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            </div>
          )
        ) : <div />}

        {/* Content column */}
        <div className={`pr-1.5 select-none flex items-center gap-1.5 ${!compactView ? 'pl-1.5' : ''} ${isEditingContent ? '' : 'overflow-hidden'}`} onClick={handleContentClick}>
          {isEditingContent ? (
              <>
                <input
                  ref={contentInputRef}
                  type="text"
                  value={contentValue}
                  onChange={(e) => {
                    setContentValue(e.target.value);
                    onContentChange?.(e.target.value);
                  }}
                  onBlur={() => {
                    // Don't blur if clicking inside the label or category dropdown
                    if (showLabelDropdown || showCategoryDropdown) return;
                    handleContentBlur();
                  }}
                  onKeyDown={handleContentKeyDown}
                  onFocus={(e) => {
                    // Calculate caret position from stored click X using input's font
                    if (clickXRef.current !== null) {
                      const clickX = clickXRef.current;
                      clickXRef.current = null;
                      const input = e.target as HTMLInputElement;
                      const text = input.value;

                      if (text.length === 0 || clickX <= 0) {
                        input.setSelectionRange(0, 0);
                        return;
                      }

                      // Create canvas with input's font to measure text
                      const canvas = document.createElement('canvas');
                      const ctx = canvas.getContext('2d');
                      if (ctx) {
                        const style = window.getComputedStyle(input);
                        ctx.font = `${style.fontSize} ${style.fontFamily}`;

                        // Find the position where click occurred
                        let pos = text.length;
                        for (let i = 1; i <= text.length; i++) {
                          const width = ctx.measureText(text.substring(0, i)).width;
                          if (width >= clickX) {
                            const prevWidth = ctx.measureText(text.substring(0, i - 1)).width;
                            pos = (clickX - prevWidth) <= (width - clickX) ? i - 1 : i;
                            break;
                          }
                        }
                        input.setSelectionRange(pos, pos);
                      }
                    }
                  }}
                  placeholder={t('newTaskPlaceholder')}
                  className="flex-1 min-w-0 text-sm leading-4 bg-transparent border-none outline-none p-0 m-0 text-foreground caret-foreground placeholder:text-muted-foreground/50"
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
                                    onRemoveLabel?.(note.id, label.id);
                                  } else {
                                    onAddLabel?.(note.id, label.id);
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
              <span
                className={`text-sm leading-4 truncate ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${note.completed ? 'line-through text-muted-foreground' : ''} ${isSelected && isDescriptionFocused ? 'cursor-text underline decoration-primary decoration-2 underline-offset-2' : ''} ${!contentValue ? 'text-muted-foreground/50 italic' : ''}`}
                {...attributes}
                {...listeners}
              >
                {contentValue || t('newTaskPlaceholder')}
              </span>
            )}
            {!compactView && !isSelected && labels.length > 0 && (
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
            {!compactView && !isSelected && note.deadline && (
              <div className={`flex items-center gap-1 shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
                parseLocalDate(note.deadline) < new Date() && !note.completed
                  ? 'text-destructive bg-destructive/10'
                  : 'text-muted-foreground bg-muted'
              }`}>
                <Calendar className="h-3 w-3" />
                <span>{parseLocalDate(note.deadline).toLocaleDateString()}</span>
              </div>
            )}
            {!compactView && !isSelected && assigneeName && (
              <div className="flex items-center gap-1 shrink-0 text-[10px] px-1.5 py-0.5 rounded text-muted-foreground bg-muted">
                <User className="h-3 w-3" />
                <span>{assigneeName}</span>
              </div>
            )}
        </div>

        {/* Actions column */}
        <div className="flex items-center justify-center gap-0.5 select-none mr-1">
          {/* Hide pin and sidebar buttons for completed and deleted tasks */}
          {!note.completed && !isDeleted && (
            <>
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
                        onToggleFixInSidebar?.(note.id);
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
            </>
          )}
          {isDeleted && onRestore ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/60 hover:text-primary p-1.5 cursor-pointer"
                  onClick={onRestore}
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{t('trash.restore')}</p>
              </TooltipContent>
            </Tooltip>
          ) : (
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
          )}
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
 *
 * PERFORMANCE: Callbacks now use noteId parameter pattern, so they can be stable
 * references from the parent. This dramatically reduces re-renders since callback
 * identity no longer changes per-note.
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
    if (prevProps.note.completed !== nextProps.note.completed) return false;
    if (prevProps.note.deadline !== nextProps.note.deadline) return false;
    if (prevProps.note.pinned !== nextProps.note.pinned) return false;
    if (prevProps.assigneeName !== nextProps.assigneeName) return false;

    // Selection state (most important for click performance)
    if (prevProps.isSelected !== nextProps.isSelected) return false;

    // Focus and navigation state - only compare when selected
    if (prevProps.isSelected || nextProps.isSelected) {
      if (prevProps.shouldFocusTitle !== nextProps.shouldFocusTitle) return false;
      if (prevProps.desiredColumn !== nextProps.desiredColumn) return false;
    }

    if (prevProps.isDragging !== nextProps.isDragging) return false;
    if (prevProps.isFixedInSidebar !== nextProps.isFixedInSidebar) return false;
    if (prevProps.compactView !== nextProps.compactView) return false;
    if (prevProps.isDescriptionFocused !== nextProps.isDescriptionFocused) return false;

    // Labels comparison - use reference equality first (fast path)
    if (prevProps.labels !== nextProps.labels) {
      const prevLabels = prevProps.labels || [];
      const nextLabels = nextProps.labels || [];
      if (prevLabels.length !== nextLabels.length) return false;
      for (let i = 0; i < prevLabels.length; i++) {
        if (prevLabels[i].id !== nextLabels[i].id) return false;
      }
    }

    // AllLabels - only check reference equality (parent should memoize)
    if (prevProps.allLabels !== nextProps.allLabels) return false;

    // Callback props - these should now be stable references from parent
    // since they use noteId parameter pattern instead of per-note closures
    // Skip comparison for callbacks that are expected to be stable

    // All props are equal, don't re-render
    return true;
  }
);
