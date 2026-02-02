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
import type { Note, Label, NoteCategory } from '@/types/note';
import type { Contact } from '@/types/contact';

interface TimelineBlockNoteListProps {
  notes: Note[];
  noteLabelsCache: Map<string, Label[]>;
  noteAssigneesCache: Map<string, Contact[]>;
  onNavigateToDescription?: () => void;
  onSelectNote?: (noteId: string) => void;
  onToggleCompleted?: (noteId: string, completed: boolean) => void;
  onDelete?: (note: Note, reason: string) => void;
  onCreateNoteAfter?: (
    afterNoteId: string,
    category: NoteCategory,
    deadline?: string | null,
    labelIds?: string[],
    assigneeId?: string | null,
    newNoteId?: string
  ) => Promise<Note>;
  onCreateTaskAtTime?: (hour: number) => void;
  onEdit?: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onTogglePin?: (noteId: string) => void;
  onToggleFixInSidebar?: (noteId: string) => void;
  onSaveSuccess?: (savedCount: number) => void;
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
  onToggleCompleted,
  onDelete,
  onCreateNoteAfter,
  onCreateTaskAtTime,
  onEdit,
  onTogglePin,
  onToggleFixInSidebar,
  onSaveSuccess,
  compactView = false,
  fixedNoteId = null,
  hideEmptyHours = true,
  startHour = 8,
  endHour = 20,
}: TimelineBlockNoteListProps) => {
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
    if (!pendingChangesRef.current || !onEdit) {
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
          onEdit(block.id, content, note.category, note.description);
          savedCount++;
        }
      }
    });

    if (savedCount > 0 && onSaveSuccess) {
      onSaveSuccess(savedCount);
    }

    pendingChangesRef.current = false;
  }, [editor, notes, onEdit, onSaveSuccess]);

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

  // Listen for hour divider click events
  useEffect(() => {
    const handleCreateTaskAtHour = (e: Event) => {
      const customEvent = e as CustomEvent<{ hour: number }>;
      if (onCreateTaskAtTime) {
        onCreateTaskAtTime(customEvent.detail.hour);
      }
    };

    window.addEventListener('hourDivider:createTask', handleCreateTaskAtHour);
    return () => {
      window.removeEventListener('hourDivider:createTask', handleCreateTaskAtHour);
    };
  }, [onCreateTaskAtTime]);

  // Listen for Tab navigation events from blocks
  useEffect(() => {
    const handleNavigateToDescription = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string }>;

      flushPendingSavesRef.current();

      if (onSelectNote) {
        onSelectNote(customEvent.detail.noteId);
      }

      if (onNavigateToDescription) {
        onNavigateToDescription();
      }
    };

    window.addEventListener('notepad:navigateToDescription', handleNavigateToDescription);
    return () => {
      window.removeEventListener('notepad:navigateToDescription', handleNavigateToDescription);
    };
  }, [onNavigateToDescription, onSelectNote]);

  // Listen for toggle completed events from blocks
  useEffect(() => {
    const handleToggleCompleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string; completed: boolean }>;
      flushPendingSavesRef.current();

      if (onToggleCompleted) {
        onToggleCompleted(customEvent.detail.noteId, customEvent.detail.completed);
      }
    };

    window.addEventListener('notepad:toggleCompleted', handleToggleCompleted);
    return () => {
      window.removeEventListener('notepad:toggleCompleted', handleToggleCompleted);
    };
  }, [onToggleCompleted]);

  // Listen for delete events from blocks
  useEffect(() => {
    const handleDelete = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string; reason: string }>;

      isDeletingRef.current = true;
      pendingChangesRef.current = false;

      if (onDelete) {
        const note = notes.find(n => n.id === customEvent.detail.noteId);
        if (note) {
          onDelete(note, customEvent.detail.reason);
        }
      }

      setTimeout(() => {
        isDeletingRef.current = false;
      }, 200);
    };

    window.addEventListener('notepad:delete', handleDelete);
    return () => {
      window.removeEventListener('notepad:delete', handleDelete);
    };
  }, [onDelete, notes]);

  // Listen for create note events from blocks
  useEffect(() => {
    const handleCreateNoteAfter = async (e: Event) => {
      const customEvent = e as CustomEvent<{ afterNoteId: string; newNoteId?: string }>;
      if (onCreateNoteAfter) {
        flushPendingSavesRef.current();

        const afterNote = notes.find(n => n.id === customEvent.detail.afterNoteId);
        if (afterNote) {
          const labels = noteLabelsCache.get(afterNote.id) ?? [];
          const labelIds = labels.map(l => l.id);

          await onCreateNoteAfter(
            afterNote.id,
            afterNote.category,
            afterNote.deadline,
            labelIds,
            null,
            customEvent.detail.newNoteId
          );
        }
      }
    };

    window.addEventListener('notepad:createNoteAfter', handleCreateNoteAfter);
    return () => {
      window.removeEventListener('notepad:createNoteAfter', handleCreateNoteAfter);
    };
  }, [onCreateNoteAfter, notes, noteLabelsCache]);

  // Listen for toggle pin events from blocks
  useEffect(() => {
    const handleTogglePin = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string }>;
      const noteId = customEvent.detail.noteId;

      const note = notes.find(n => n.id === noteId);
      if (!note) return;

      const newPinnedState = !note.pinned;

      const block = editor.getBlock(noteId);
      if (block) {
        editor.updateBlock(block, {
          props: { ...block.props, pinned: newPinnedState }
        } as any);
      }

      if (onTogglePin) {
        onTogglePin(noteId);
      }
    };

    window.addEventListener('notepad:togglePin', handleTogglePin);
    return () => {
      window.removeEventListener('notepad:togglePin', handleTogglePin);
    };
  }, [onTogglePin, notes, editor]);

  // Listen for toggle fix in sidebar events from blocks
  useEffect(() => {
    const handleToggleFixInSidebar = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string }>;
      if (onToggleFixInSidebar) {
        onToggleFixInSidebar(customEvent.detail.noteId);
      }
    };

    window.addEventListener('notepad:toggleFixInSidebar', handleToggleFixInSidebar);
    return () => {
      window.removeEventListener('notepad:toggleFixInSidebar', handleToggleFixInSidebar);
    };
  }, [onToggleFixInSidebar]);

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
