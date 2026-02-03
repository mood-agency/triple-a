import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { es as esLocale } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/shadcn';
import '@blocknote/shadcn/style.css';
import { NotepadBlock } from '@/components/blocknote/NotepadBlock';
import { HourDividerBlock } from '@/components/blocknote/HourDividerBlock';
import {
  notesToTimelineBlocks,
  separateNotesByTime,
  getBlockContent,
  type LabelData,
} from '@/utils/noteBlockAdapter';
import { getInitials } from '@/lib/utils';
import { useEventSubscription, eventBus } from '@/events';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { useNavigationMediatorContext } from './navigation';
import { DeleteTaskDialog } from './DeleteTaskDialog';

interface TimelineBlockNoteListProps {
  notes: Note[];
  noteLabelsCache: Map<string, Label[]>;
  noteAssigneesCache: Map<string, Contact[]>;
  /** Navigate to description panel (UI action, not data mutation) */
  onNavigateToDescription?: () => void;
  /** Select a note (UI action, not data mutation) */
  onSelectNote?: (noteId: string) => void;
  /** Toggle fix in sidebar (UI action, not data mutation) */
  onToggleFixInSidebar?: (noteId: string) => void;
  /** Edit note content/category/description (data mutation) */
  onEdit?: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  /** Toggle note completed state (data mutation) */
  onToggleCompleted?: (id: string, completed: boolean) => void;
  /** Delete a note (data mutation) */
  onDelete?: (noteId: string, reason: string) => void;
  /** Toggle note pinned state (data mutation) */
  onTogglePinned?: (id: string, pinned: boolean) => void;
  /** Create a new note after another (data mutation) */
  onCreateNoteAfter?: (afterNoteId: string, category: NoteCategory, deadline?: string | null, labelIds?: string[], assigneeId?: string | null, newNoteId?: string) => Promise<Note>;
  compactView?: boolean;
  fixedNoteId?: string | null;
  hideEmptyHours?: boolean;
  startHour?: number;
  endHour?: number;
}

export const TimelineBlockNoteList = ({
  notes,
  noteLabelsCache,
  noteAssigneesCache,
  onNavigateToDescription,
  onSelectNote,
  onToggleFixInSidebar,
  onEdit,
  onToggleCompleted,
  onDelete,
  onTogglePinned,
  onCreateNoteAfter,
  compactView = false,
  fixedNoteId = null,
  hideEmptyHours = true,
  startHour = 8,
  endHour = 20,
}: TimelineBlockNoteListProps) => {
  // Navigation mediator for focus history
  const navigationMediator = useNavigationMediatorContext();

  // Delete dialog state
  const [deleteDialogNoteId, setDeleteDialogNoteId] = useState<string | null>(null);
  // Create schema with notepad and hourDivider blocks
  const schema = useMemo(
    () =>
      BlockNoteSchema.create({
        blockSpecs: {
          ...defaultBlockSpecs,
          notepad: (NotepadBlock as any)(),
          hourDivider: (HourDividerBlock as any)(),
        },
      }),
    []
  );

  // Convert caches to the format expected by the adapter
  const labelDataCache = useMemo(() => {
    const cache = new Map<string, LabelData[]>();
    noteLabelsCache.forEach((labels, noteId) => {
      cache.set(noteId, labels.map(l => ({ name: l.name, color: l.color })));
    });
    return cache;
  }, [noteLabelsCache]);

  const assigneeDataCache = useMemo(() => {
    const cache = new Map<string, Array<{ initials: string; fullName: string }>>();
    noteAssigneesCache.forEach((assignees, noteId) => {
      cache.set(noteId, assignees.map(a => ({
        initials: getInitials(a.name, a.lastname),
        fullName: `${a.name} ${a.lastname || ''}`.trim()
      })));
    });
    return cache;
  }, [noteAssigneesCache]);

  // Separate notes by time and convert to timeline blocks
  const initialContent = useMemo(() => {
    const { timedNotes, allDayNotes } = separateNotesByTime(notes);
    return notesToTimelineBlocks(
      timedNotes,
      allDayNotes,
      labelDataCache,
      assigneeDataCache,
      startHour,
      endHour,
      hideEmptyHours,
      compactView,
      fixedNoteId
    );
  }, [notes, labelDataCache, assigneeDataCache, startHour, endHour, hideEmptyHours, compactView, fixedNoteId]);

  // Create editor
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent.length > 0 ? (initialContent as any) : undefined,
    trailingBlock: false,
    dictionary: {
      ...esLocale,
      placeholders: {
        ...esLocale.placeholders,
        default: "",
      },
    },
  });

  // Track content changes for auto-save
  const pendingChangesRef = useRef(false);

  // Track previous note IDs to detect actual filtering changes
  const previousNoteIdsRef = useRef<string>('');

  // Flag to prevent saves during programmatic updates
  const isSyncingRef = useRef(false);

  // Flag to prevent sync when deleting blocks
  const isDeletingRef = useRef(false);

  // Track if we're syncing filter changes
  const [isSyncingFilter, setIsSyncingFilter] = useState(false);

  // Skip sync on initial mount
  const isInitialMountRef = useRef(true);

  // Function to flush pending saves immediately
  const flushPendingSaves = useCallback(() => {
    if (!pendingChangesRef.current) {
      return;
    }

    const blocks = editor.document;
    let savedCount = 0;

    // Save each notepad block that has changed (skip hourDivider blocks)
    blocks.forEach((block) => {
      if (block.type === 'notepad') {
        const content = getBlockContent(block);
        const note = notes.find(n => n.id === block.id);

        // Only save if content has changed
        if (note && content !== note.content) {
          // Use callback for update
          if (onEdit) {
            onEdit(block.id, content, note.category, note.description);
          }
          savedCount++;
        }
      }
    });

    // Emit save success event for UI feedback
    if (savedCount > 0) {
      eventBus.emit('editor:saveSuccess', { savedCount });
    }

    pendingChangesRef.current = false;
  }, [editor, notes, onEdit]);

  // Stable reference to avoid re-subscribing to onChange
  const flushPendingSavesRef = useRef(flushPendingSaves);
  useEffect(() => {
    flushPendingSavesRef.current = flushPendingSaves;
  }, [flushPendingSaves]);

  // Track changes via onChange (just mark as dirty, don't save)
  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      if (!isSyncingRef.current) {
        pendingChangesRef.current = true;
      }
    });

    return () => unsubscribe();
  }, [editor]);

  // Flush saves on unmount
  useEffect(() => {
    return () => {
      if (pendingChangesRef.current) {
        flushPendingSavesRef.current();
      }
    };
  }, []);

  // Mark initial mount as complete after first render
  useEffect(() => {
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
    }
  }, []);

  // Sync compact prop to all blocks when compactView changes
  useEffect(() => {
    // Skip initial mount - blocks are created with correct compact value
    if (isInitialMountRef.current) {
      return;
    }

    // Use setTimeout to avoid flushSync issues during React render
    setTimeout(() => {
      isSyncingRef.current = true;

      editor.document.forEach((block: any) => {
        if (block.type === 'notepad' && block.props.compact !== compactView) {
          editor.updateBlock(block, {
            props: { ...block.props, compact: compactView }
          } as any);
        }
      });

      setTimeout(() => {
        isSyncingRef.current = false;
      }, 50);
    }, 0);
  }, [editor, compactView]);

  // CENTRALIZED selection tracking - ONE listener instead of N blocks each listening
  // Also handles multi-block selection prevention centrally
  useEffect(() => {
    let previousBlockId: string | null = null;

    const unsubscribe = editor.onSelectionChange(() => {
      const cursor = editor.getTextCursorPosition();
      const block = cursor?.block;
      const blockId = (block && block.type === 'notepad') ? block.id : null;

      // CENTRALIZED: Prevent multi-block selection (moved from NotepadBlock)
      const selection = editor._tiptapEditor?.state?.selection;
      if (selection) {
        const blocks = editor.getSelection()?.blocks || [];
        if (blocks.length > 1) {
          const { from, to } = selection;
          const currentBlockPos = editor._tiptapEditor.state.doc.resolve(from);
          let blockStart = from;
          let blockEnd = to;

          for (let d = currentBlockPos.depth; d > 0; d--) {
            const node = currentBlockPos.node(d);
            if (node.type.name === 'blockContainer') {
              blockStart = currentBlockPos.start(d);
              blockEnd = currentBlockPos.end(d);
              break;
            }
          }

          const tr = editor._tiptapEditor.state.tr.setSelection(
            (selection.constructor as any).create(
              editor._tiptapEditor.state.doc,
              Math.max(blockStart, from),
              Math.min(blockEnd, to)
            )
          );
          editor._tiptapEditor.view.dispatch(tr);
        }
      }

      // Only emit if selection actually changed
      if (blockId !== previousBlockId) {
        // Emit centralized selection event for blocks to consume
        eventBus.emit('editor:blockSelection', {
          selectedBlockId: blockId,
          previousBlockId: previousBlockId,
        });

        // Also notify parent for UI updates (only for notepad blocks)
        if (blockId && onSelectNote) {
          onSelectNote(blockId);
        }

        previousBlockId = blockId;
      }
    });

    return () => unsubscribe();
  }, [editor, onSelectNote]);

  // Sync notes changes (for filtering)
  useEffect(() => {
    const currentNoteIds = notes.map(n => n.id).sort().join(',');

    if (previousNoteIdsRef.current !== currentNoteIds) {
      const previousIds = new Set(
        previousNoteIdsRef.current ? previousNoteIdsRef.current.split(',').filter(Boolean) : []
      );
      previousNoteIdsRef.current = currentNoteIds;

      const noteIds = new Set(notes.map(note => note.id));
      const notesWereFiltered = [...previousIds].some(id => !noteIds.has(id));
      const notesWereAdded = notes.some(note => !previousIds.has(note.id));
      const isInitialLoad = previousIds.size === 0 && notes.length > 0;

      if ((notesWereFiltered || notesWereAdded || isInitialLoad) && !isDeletingRef.current) {
        if (notesWereFiltered || notesWereAdded) {
          setIsSyncingFilter(true);
        }

        setTimeout(() => {
          isSyncingRef.current = true;

          const { timedNotes, allDayNotes } = separateNotesByTime(notes);
          const newContent = notesToTimelineBlocks(
            timedNotes,
            allDayNotes,
            labelDataCache,
            assigneeDataCache,
            startHour,
            endHour,
            hideEmptyHours,
            compactView,
            fixedNoteId
          );

          const blocksToReplace = editor.document.map(b => b.id);
          editor.replaceBlocks(blocksToReplace, newContent as any);

          setTimeout(() => {
            isSyncingRef.current = false;
            setIsSyncingFilter(false);
          }, 50);
        }, 0);
      }
    }
  }, [editor, notes, labelDataCache, assigneeDataCache, startHour, endHour, hideEmptyHours, compactView, fixedNoteId]);

  // Save when clicking outside the editor
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const editorElement = document.querySelector('.timeline-blocknote-list');
      const isOutside = editorElement && !editorElement.contains(e.target as Node);

      if (isOutside) {
        setTimeout(() => {
          flushPendingSavesRef.current();
        }, 50);
      }
    };

    const handleWindowBlur = () => {
      flushPendingSavesRef.current();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Listen for hour divider click events (via event bus)
  // Note: timeline:createTask is handled by parent component via event bus subscription
  useEventSubscription('timeline:createTask', () => {
    // Task creation at specific hour handled by parent via event subscription
  });

  // Listen for Tab navigation events from blocks (via event bus)
  useEventSubscription('editor:navigateToDescription', (event) => {
    flushPendingSavesRef.current();

    // Push current position to history before navigating away (including cursor offset)
    if (navigationMediator) {
      navigationMediator.pushFocusHistory({
        region: 'taskList',
        noteId: event.payload.noteId,
        column: event.payload.cursorOffset,
      });
    }

    if (onSelectNote) {
      onSelectNote(event.payload.noteId);
    }

    if (onNavigateToDescription) {
      onNavigateToDescription();
    }
  });

  // Listen for toggle completed events from blocks (via event bus)
  useEventSubscription('note:completed', (event) => {
    // Skip if this event came from a command (avoid infinite loop)
    if (event.source === 'command') {
      return;
    }

    flushPendingSavesRef.current();

    // Use callback for toggle completed
    if (onToggleCompleted) {
      onToggleCompleted(event.payload.noteId, event.payload.completed);
    }
  });

  // Listen for delete events from blocks (via event bus)
  useEventSubscription('note:deleted', (event) => {
    // Skip if this event came from a command (avoid infinite loop)
    if (event.source === 'command') {
      return;
    }

    isDeletingRef.current = true;
    pendingChangesRef.current = false;

    // Use callback for delete
    if (onDelete) {
      onDelete(event.payload.noteId, event.payload.reason);
    }

    setTimeout(() => {
      isDeletingRef.current = false;
    }, 200);
  });

  // Listen for delete request events from blocks (via event bus)
  // Shows the delete dialog instead of deleting immediately
  useEventSubscription('note:requestDelete', (event) => {
    setDeleteDialogNoteId(event.payload.noteId);
  });

  // Handle confirmed deletion from the dialog
  const handleConfirmDelete = useCallback((reason: string) => {
    if (!deleteDialogNoteId) return;

    const block = editor.getBlock(deleteDialogNoteId);

    // Move cursor to adjacent block before removing
    if (block) {
      const cursorInfo = editor.getTextCursorPosition();
      const prevBlock = cursorInfo?.prevBlock;
      const nextBlock = cursorInfo?.nextBlock;

      if (prevBlock) {
        editor.setTextCursorPosition(prevBlock, 'end');
      } else if (nextBlock) {
        editor.setTextCursorPosition(nextBlock, 'start');
      }

      editor.removeBlocks([block]);
    }

    eventBus.emit('note:deleted', {
      noteId: deleteDialogNoteId,
      reason,
    });

    setDeleteDialogNoteId(null);
  }, [deleteDialogNoteId, editor]);

  // Listen for create note events from blocks (via event bus)
  useEventSubscription('editor:createNoteAfter', async (event) => {
    flushPendingSavesRef.current();

    const afterNote = notes.find(n => n.id === event.payload.afterNoteId);
    if (afterNote && onCreateNoteAfter) {
      const labels = noteLabelsCache.get(afterNote.id) ?? [];
      const labelIds = labels.map(l => l.id);

      // Use callback for create note after
      await onCreateNoteAfter(
        afterNote.id,
        afterNote.category,
        afterNote.deadline,
        labelIds,
        null,
        event.payload.newNoteId
      );
    }
  });

  // Listen for toggle pin events from blocks (via event bus)
  useEventSubscription('note:pinned', (event) => {
    // Skip if this event came from a command (avoid infinite loop)
    if (event.source === 'command') {
      return;
    }

    const noteId = event.payload.noteId;

    // Update block's pinned prop with the new state from the event
    const block = editor.getBlock(noteId);
    if (block) {
      editor.updateBlock(block, {
        props: { ...block.props, pinned: event.payload.pinned }
      } as any);
    }

    // Use callback for toggle pinned
    if (onTogglePinned) {
      onTogglePinned(noteId, event.payload.pinned);
    }
  });

  // Listen for toggle fix in sidebar events from blocks (via event bus)
  useEventSubscription('note:fixedInSidebar', (event) => {
    if (onToggleFixInSidebar) {
      onToggleFixInSidebar(event.payload.noteId);
    }
  });

  return (
    <div className={`timeline-blocknote-list ${isSyncingFilter ? 'blocknote-syncing' : ''}`}>
      <BlockNoteView
        editor={editor}
        theme="light"
        formattingToolbar={false}
        slashMenu={false}
        sideMenu={false}
      />
      <DeleteTaskDialog
        open={deleteDialogNoteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteDialogNoteId(null);
        }}
        onConfirm={handleConfirmDelete}
        taskContent={
          deleteDialogNoteId
            ? (notes.find(n => n.id === deleteDialogNoteId)?.content
              ?? getBlockContent(editor.getBlock(deleteDialogNoteId) ?? { content: '' }))
            : ''
        }
      />
    </div>
  );
};
