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
import { useCommandDispatch } from '@/cqrs';
import {
  UpdateNoteCommand,
  DeleteNoteCommand,
  ToggleCompletedCommand,
  TogglePinnedCommand,
  CreateNoteAfterCommand,
} from '@/cqrs/commands/notes';
import type { Note, Label } from '@/types/note';
import type { Contact } from '@/types/contact';

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
  compactView = false,
  fixedNoteId = null,
  hideEmptyHours = true,
  startHour = 8,
  endHour = 20,
}: TimelineBlockNoteListProps) => {
  // CQRS command dispatch for data mutations
  const dispatch = useCommandDispatch();
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
          // Use CQRS command for update
          dispatch(new UpdateNoteCommand({
            noteId: block.id,
            content,
            category: note.category,
            description: note.description,
          }));
          savedCount++;
        }
      }
    });

    // Emit save success event for UI feedback
    if (savedCount > 0) {
      eventBus.emit('editor:saveSuccess', { savedCount });
    }

    pendingChangesRef.current = false;
  }, [editor, notes, dispatch]);

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

  // Listen to BlockNote selection changes and sync to parent (skip hourDivider)
  useEffect(() => {
    const unsubscribe = editor.onSelectionChange(() => {
      const cursor = editor.getTextCursorPosition();
      const block = cursor?.block;

      // Only notify for notepad blocks, not hour dividers
      if (block && block.type === 'notepad' && onSelectNote) {
        onSelectNote(block.id);
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
      const isInitialLoad = previousIds.size === 0 && notes.length > 0;

      if ((notesWereFiltered || isInitialLoad) && !isDeletingRef.current) {
        if (notesWereFiltered) {
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

    if (onSelectNote) {
      onSelectNote(event.payload.noteId);
    }

    if (onNavigateToDescription) {
      onNavigateToDescription();
    }
  });

  // Listen for toggle completed events from blocks (via event bus)
  useEventSubscription('note:completed', (event) => {
    flushPendingSavesRef.current();

    // Use CQRS command for toggle completed
    dispatch(new ToggleCompletedCommand({
      noteId: event.payload.noteId,
      completed: event.payload.completed,
    }));
  });

  // Listen for delete events from blocks (via event bus)
  useEventSubscription('note:deleted', (event) => {
    isDeletingRef.current = true;
    pendingChangesRef.current = false;

    // Use CQRS command for delete
    dispatch(new DeleteNoteCommand({
      noteId: event.payload.noteId,
      reason: event.payload.reason,
    }));

    setTimeout(() => {
      isDeletingRef.current = false;
    }, 200);
  });

  // Listen for create note events from blocks (via event bus)
  useEventSubscription('editor:createNoteAfter', async (event) => {
    flushPendingSavesRef.current();

    const afterNote = notes.find(n => n.id === event.payload.afterNoteId);
    if (afterNote) {
      const labels = noteLabelsCache.get(afterNote.id) ?? [];
      const labelIds = labels.map(l => l.id);

      // Use CQRS command for create note after
      await dispatch(new CreateNoteAfterCommand({
        afterNoteId: afterNote.id,
        content: '',
        category: afterNote.category,
        deadline: afterNote.deadline,
        labelIds,
        assigneeId: null,
        newNoteId: event.payload.newNoteId,
      }));
    }
  });

  // Listen for toggle pin events from blocks (via event bus)
  useEventSubscription('note:pinned', (event) => {
    const noteId = event.payload.noteId;

    // Update block's pinned prop with the new state from the event
    const block = editor.getBlock(noteId);
    if (block) {
      editor.updateBlock(block, {
        props: { ...block.props, pinned: event.payload.pinned }
      } as any);
    }

    // Use CQRS command for toggle pinned
    dispatch(new TogglePinnedCommand({
      noteId,
      pinned: event.payload.pinned,
    }));
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
    </div>
  );
};
