import { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/shadcn';
import '@blocknote/shadcn/style.css';
import { NotepadBlock } from '@/components/blocknote/NotepadBlock';
import { notesToBlocks, getBlockContent } from '@/utils/noteBlockAdapter';
import { getInitials } from '@/lib/utils';
import { parseHashtags } from '@/utils/hashtagParser';
import { noteEventBus } from '@/services/NoteEventBus';
import { useLabels } from '@/hooks/useLabels';
import { useContacts } from '@/hooks/useContacts';
import type { Note, Label, NoteCategory } from '@/types/note';
import type { Contact } from '@/types/contact';
import { useRegisterNavigationRegion, type RegionHandler } from './navigation';

// Debug flag
const DEBUG_BLOCKNOTE = true;

interface BlockNoteNoteListProps {
  notes: Note[];
  noteLabelsCache: Map<string, Label[]>;
  noteAssigneesCache: Map<string, Contact[]>;
  compactView?: boolean;
  fixedNoteId?: string | null;
  hideDate?: boolean;
}

/**
 * BlockNoteNoteList - Editor component for task list
 *
 * This component is responsible ONLY for:
 * - Rendering the BlockNote editor with notepad blocks
 * - Managing editor state (focus, selection, syncing)
 * - Emitting events when user actions occur
 *
 * Persistence is handled separately by useNotePersistence hook.
 * This separation follows the Event Bus pattern for better maintainability.
 */
export const BlockNoteNoteList = ({
  notes,
  noteLabelsCache,
  noteAssigneesCache,
  compactView = false,
  fixedNoteId = null,
  hideDate = false
}: BlockNoteNoteListProps) => {
  // Get labels and contacts for hashtag/mention parsing
  const { labels, createLabel } = useLabels();
  const { contacts } = useContacts();

  // Create schema with notepad block
  const schema = useMemo(
    () =>
      BlockNoteSchema.create({
        blockSpecs: {
          ...defaultBlockSpecs,
          notepad: (NotepadBlock as any)(),
        },
      }),
    []
  );

  // Convert caches to the format expected by the adapter
  const labelDataCache = useMemo(() => {
    const cache = new Map<string, Array<{ name: string; color: string }>>();
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

  // Convert notes to blocks using adapter
  const initialContent = useMemo(
    () => notesToBlocks(notes, labelDataCache, assigneeDataCache, compactView, fixedNoteId, hideDate),
    [notes, labelDataCache, assigneeDataCache, fixedNoteId, hideDate]
  );

  // Create editor
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent.length > 0 ? initialContent : undefined,
  });

  // Track content changes
  const pendingChangesRef = useRef(false);

  // Track previous note IDs to detect filtering changes
  const previousNoteIdsRef = useRef<string>('');

  // Track previous label/assignee data to avoid unnecessary syncs
  const previousLabelDataRef = useRef<string>('');
  const previousAssigneeDataRef = useRef<string>('');

  // Track previous content data to sync external changes
  const previousContentDataRef = useRef<string>('');

  // Flag to prevent saves during programmatic updates
  const isSyncingRef = useRef(false);

  // Flag to prevent sync when deleting blocks
  const isDeletingRef = useRef(false);

  // Map block ID (UUID) -> note ID (Convex ID) for newly created blocks
  const blockIdToNoteIdRef = useRef<Map<string, string>>(new Map());

  // Set of pending block UUIDs (created but not yet saved to Convex)
  const pendingBlockIdsRef = useRef<Set<string>>(new Set());

  // Track if we're syncing filter changes
  const [isSyncingFilter, setIsSyncingFilter] = useState(false);

  // Track if editor has focus
  const [editorHasFocus, setEditorHasFocus] = useState(false);

  // Ref for the container element
  const containerRef = useRef<HTMLDivElement>(null);

  // Skip certain effects on initial mount
  const isInitialMountRef = useRef(true);

  // Mark initial mount as complete
  useEffect(() => {
    isInitialMountRef.current = false;
  }, []);

  // Emit content change events for all modified blocks and trigger save
  const emitPendingChanges = useCallback(() => {
    if (!pendingChangesRef.current) {
      if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] No pending changes to emit');
      return;
    }

    const blocks = editor.document;
    let hasChanges = false;

    blocks.forEach((block) => {
      if (block.type === 'notepad') {
        // Skip pending blocks
        if (pendingBlockIdsRef.current.has(block.id)) {
          return;
        }

        const content = getBlockContent(block);
        const noteId = blockIdToNoteIdRef.current.get(block.id) || block.id;
        const note = notes.find(n => n.id === noteId);

        if (!note) {
          if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Skipping block without note:', block.id);
          return;
        }

        // Emit change event if content differs
        if (content !== note.content) {
          if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Emitting content change:', { noteId, content });
          noteEventBus.emit({
            type: 'NOTE_CONTENT_CHANGED',
            noteId,
            content,
            category: note.category,
            description: note.description,
          });
          hasChanges = true;
        }
      }
    });

    pendingChangesRef.current = false;

    // Trigger the actual save in the persistence layer
    if (hasChanges) {
      if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Triggering flush');
      noteEventBus.emit({ type: 'FLUSH_PENDING_SAVES' });
    }
  }, [editor, notes]);

  // Stable reference for callbacks
  const emitPendingChangesRef = useRef(emitPendingChanges);
  useEffect(() => {
    emitPendingChangesRef.current = emitPendingChanges;
  }, [emitPendingChanges]);

  // Register as task list region for navigation
  const taskListRegionHandler = useMemo<RegionHandler>(() => ({
    region: 'taskList',
    focusFirst: () => {
      if (notes.length > 0) {
        const firstBlock = editor.document[0];
        if (firstBlock) {
          editor.setTextCursorPosition(firstBlock, 'start');
          editor.focus();
          return true;
        }
      }
      return false;
    },
    focusLast: () => {
      if (notes.length > 0) {
        const lastBlock = editor.document[editor.document.length - 1];
        if (lastBlock) {
          editor.setTextCursorPosition(lastBlock, 'end');
          editor.focus();
          return true;
        }
      }
      return false;
    },
    canReceiveFocus: () => notes.length > 0,
  }), [editor, notes]);

  useRegisterNavigationRegion(taskListRegionHandler);

  // Track changes via onChange
  const isRemovingParagraphsRef = useRef(false);
  useEffect(() => {
    const unsubscribe = editor.onChange(() => {
      if (!isSyncingRef.current) {
        pendingChangesRef.current = true;
      }

      // Remove any paragraph blocks
      if (isRemovingParagraphsRef.current) return;

      const paragraphBlocks = editor.document.filter(block => block.type === 'paragraph');
      if (paragraphBlocks.length > 0) {
        isRemovingParagraphsRef.current = true;
        try {
          const currentCursor = editor.getTextCursorPosition();
          const cursorInParagraph = paragraphBlocks.some(p => p.id === currentCursor.block.id);
          const notepadBlocks = editor.document.filter(block => block.type === 'notepad');
          const lastNotepadBlock = notepadBlocks[notepadBlocks.length - 1];

          paragraphBlocks.forEach(block => {
            editor.removeBlocks([block]);
          });

          if (cursorInParagraph && lastNotepadBlock) {
            editor.setTextCursorPosition(lastNotepadBlock, 'end');
          }
        } finally {
          isRemovingParagraphsRef.current = false;
        }
      }
    });

    return () => unsubscribe();
  }, [editor]);

  // Emit changes on unmount
  useEffect(() => {
    return () => {
      if (pendingChangesRef.current) {
        emitPendingChangesRef.current();
      }
    };
  }, []);

  // Listen to selection changes and emit events
  useEffect(() => {
    let previousNoteId: string | undefined;

    const unsubscribe = editor.onSelectionChange(() => {
      const cursor = editor.getTextCursorPosition();
      const blockId = cursor?.block.id;

      if (blockId) {
        if (pendingBlockIdsRef.current.has(blockId)) {
          if (DEBUG_BLOCKNOTE) console.log('[BlockNote] Skipping selection for pending block:', blockId);
          return;
        }

        const noteId = blockIdToNoteIdRef.current.get(blockId) || blockId;

        if (previousNoteId !== noteId) {
          previousNoteId = noteId;
          noteEventBus.emit({ type: 'NOTE_SELECTED', noteId });
        }
      }
    });

    return () => unsubscribe();
  }, [editor]);

  // Update blocks when fixed note changes
  useEffect(() => {
    const timer = setTimeout(() => {
      isSyncingRef.current = true;

      editor.document.forEach(block => {
        if (block.type === 'notepad') {
          const shouldBeFixed = block.id === fixedNoteId;
          const currentlyFixed = (block as any).props.fixedInSidebar;

          if (shouldBeFixed !== currentlyFixed) {
            editor.updateBlock(block, {
              props: { ...block.props, fixedInSidebar: shouldBeFixed }
            } as any);
          }
        }
      });

      isSyncingRef.current = false;
    }, 50);

    return () => clearTimeout(timer);
  }, [editor, fixedNoteId, notes.length]);

  // Update blocks when compact view changes
  useEffect(() => {
    if (isInitialMountRef.current) return;

    isSyncingRef.current = true;

    editor.document.forEach(block => {
      if (block.type === 'notepad') {
        const currentCompact = (block as any).props.compact;

        if (currentCompact !== compactView) {
          editor.updateBlock(block, {
            props: { ...block.props, compact: compactView }
          } as any);
        }
      }
    });

    isSyncingRef.current = false;
  }, [editor, compactView]);

  // Sync notes changes (filtering/sorting)
  useEffect(() => {
    const currentNoteIds = notes.map(n => n.id).join(',');

    if (previousNoteIdsRef.current !== currentNoteIds) {
      const previousIds = new Set(previousNoteIdsRef.current ? previousNoteIdsRef.current.split(',').filter(Boolean) : []);
      previousNoteIdsRef.current = currentNoteIds;

      const noteIds = new Set(notes.map(note => note.id));
      const removedIds = [...previousIds].filter(id => !noteIds.has(id));
      const removedIdsStillInDocument = removedIds.filter(id =>
        editor.document.some(block => block.id === id)
      );

      const notesWereFiltered = removedIdsStillInDocument.length > 0;
      const isInitialLoad = previousIds.size === 0 && notes.length > 0;
      const orderChanged = removedIds.length === 0 && previousIds.size === noteIds.size && previousIds.size > 0;

      if (notesWereFiltered || isInitialLoad || orderChanged) {
        if (notesWereFiltered || orderChanged) {
          setIsSyncingFilter(true);
        }

        setTimeout(() => {
          isSyncingRef.current = true;

          const newContent = notesToBlocks(notes, labelDataCache, assigneeDataCache, compactView, fixedNoteId, hideDate);
          const blocksToReplace = editor.document.map(b => b.id);
          editor.replaceBlocks(blocksToReplace, newContent as any);

          setTimeout(() => {
            isSyncingRef.current = false;
            setIsSyncingFilter(false);
          }, 50);
        }, 0);
      }
    }
  }, [editor, notes, labelDataCache, assigneeDataCache, fixedNoteId, hideDate, compactView]);

  // Sync external label/assignee changes
  useEffect(() => {
    const labelFingerprint = JSON.stringify(Array.from(labelDataCache.entries()));
    const assigneeFingerprint = JSON.stringify(Array.from(assigneeDataCache.entries()));

    if (
      previousLabelDataRef.current === labelFingerprint &&
      previousAssigneeDataRef.current === assigneeFingerprint
    ) {
      return;
    }

    previousLabelDataRef.current = labelFingerprint;
    previousAssigneeDataRef.current = assigneeFingerprint;

    setTimeout(() => {
      const blocks = editor.document;
      let hasChanges = false;

      isSyncingRef.current = true;

      blocks.forEach((block: any) => {
        if (block.type !== 'notepad') return;

        const note = notes.find(n => n.id === block.id);
        if (!note) return;

        const labelData = labelDataCache.get(note.id) ?? [];
        const assigneeData = assigneeDataCache.get(note.id) ?? [];

        const currentLabels = block.props.labels ?? [];
        const currentAssignees = block.props.assignees ?? [];

        const labelsChanged = JSON.stringify(currentLabels) !== JSON.stringify(labelData);
        const assigneesChanged = JSON.stringify(currentAssignees) !== JSON.stringify(assigneeData);

        if (labelsChanged || assigneesChanged) {
          editor.updateBlock(block, {
            props: {
              ...block.props,
              labels: labelData,
              assignees: assigneeData,
            }
          } as any);
          hasChanges = true;
        }
      });

      setTimeout(() => {
        isSyncingRef.current = false;
      }, hasChanges ? 100 : 0);
    }, 0);
  }, [editor, notes, labelDataCache, assigneeDataCache]);

  // Sync external content changes
  useEffect(() => {
    const contentFingerprint = notes.map(n => `${n.id}:${n.content}`).join('|');

    if (previousContentDataRef.current === contentFingerprint) {
      return;
    }

    if (previousContentDataRef.current === '') {
      previousContentDataRef.current = contentFingerprint;
      return;
    }

    previousContentDataRef.current = contentFingerprint;

    setTimeout(() => {
      if (isSyncingRef.current) return;

      const blocks = editor.document;
      let hasChanges = false;

      isSyncingRef.current = true;

      blocks.forEach((block: any) => {
        if (block.type !== 'notepad') return;

        const note = notes.find(n => n.id === block.id);
        if (!note) return;

        const blockContent = getBlockContent(block);

        if (note.content !== blockContent) {
          editor.updateBlock(block, {
            content: note.content ? [{ type: 'text', text: note.content }] : []
          } as any);
          hasChanges = true;
        }
      });

      setTimeout(() => {
        isSyncingRef.current = false;
      }, hasChanges ? 100 : 0);
    }, 0);
  }, [editor, notes]);

  // Handle click outside and window blur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const editorElement = document.querySelector('.blocknote-note-list');
      const isOutside = editorElement && !editorElement.contains(e.target as Node);

      if (isOutside) {
        setTimeout(() => {
          emitPendingChangesRef.current();
        }, 50);
      }
    };

    const handleWindowBlur = () => {
      emitPendingChangesRef.current();
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Process note block for hashtag parsing
  const processNoteBlock = useCallback(async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return null;

    const block = editor.getBlock(noteId);
    if (!block) return null;

    const content = getBlockContent(block);
    const parseContext = { labels, contacts };
    const parsed = parseHashtags(content, parseContext);

    // Update block with cleaned content
    if (parsed.cleanedContent !== content) {
      editor.updateBlock(block, {
        content: [{ type: 'text', text: parsed.cleanedContent }]
      } as any);
    }

    const finalCategory = parsed.category || note.category;

    // Emit content change if needed
    if (parsed.cleanedContent !== content || finalCategory !== note.category) {
      noteEventBus.emit({
        type: 'NOTE_CONTENT_CHANGED',
        noteId: note.id,
        content: parsed.cleanedContent,
        category: finalCategory,
        description: note.description,
      });
    }

    // Handle labels
    const inheritedLabels = noteLabelsCache.get(note.id) ?? [];
    const labelIds = inheritedLabels.map(l => l.id);

    // Create new labels
    for (const labelName of parsed.newLabelNames) {
      try {
        const newLabel = await createLabel(labelName);
        if (newLabel) {
          labelIds.push(newLabel.id);
          noteEventBus.emit({
            type: 'NOTE_LABEL_CREATED_AND_ADDED',
            noteId: note.id,
            labelName,
          });
        }
      } catch (error) {
        console.error('[BlockNoteNoteList] Error creating label:', error);
      }
    }

    // Add matched labels/assignees
    for (const hashtag of parsed.parsedHashtags) {
      if (hashtag.type === 'label' && hashtag.matchedId) {
        noteEventBus.emit({
          type: 'NOTE_LABEL_ADDED',
          noteId: note.id,
          labelId: hashtag.matchedId,
        });
        if (!labelIds.includes(hashtag.matchedId)) {
          labelIds.push(hashtag.matchedId);
        }
      } else if (hashtag.type === 'contact' && hashtag.matchedId) {
        noteEventBus.emit({
          type: 'NOTE_ASSIGNEE_ADDED',
          noteId: note.id,
          contactId: hashtag.matchedId,
        });
      }
    }

    return {
      finalCategory,
      labelIds,
      parsedAssigneeId: parsed.assigneeId,
      parsed
    };
  }, [notes, editor, labels, contacts, noteLabelsCache, createLabel]);

  // Bridge window events from NotepadBlock to NoteEventBus
  useEffect(() => {
    const handleNavigateToDescription = async (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string }>;
      emitPendingChangesRef.current();
      await processNoteBlock(customEvent.detail.noteId);
      noteEventBus.emit({
        type: 'NAVIGATE_TO_DESCRIPTION',
        noteId: customEvent.detail.noteId,
      });
    };

    const handleToggleCompleted = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string; completed: boolean }>;
      emitPendingChangesRef.current();
      noteEventBus.emit({
        type: 'NOTE_COMPLETED_TOGGLED',
        noteId: customEvent.detail.noteId,
        completed: customEvent.detail.completed,
      });
    };

    const handleMarkPending = (e: Event) => {
      const customEvent = e as CustomEvent<{ blockId: string }>;
      if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Marking block as pending:', customEvent.detail.blockId);
      pendingBlockIdsRef.current.add(customEvent.detail.blockId);
      noteEventBus.emit({
        type: 'BLOCK_MARKED_PENDING',
        blockId: customEvent.detail.blockId,
      });
    };

    const handleLostFocus = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string }>;
      if (isDeletingRef.current || pendingBlockIdsRef.current.has(customEvent.detail.noteId)) {
        if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Block lost focus during delete/pending, skipping');
        return;
      }
      emitPendingChangesRef.current();
    };

    const handleDelete = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string; reason: string }>;
      isDeletingRef.current = true;
      pendingChangesRef.current = false;

      noteEventBus.emit({
        type: 'NOTE_DELETE_REQUESTED',
        noteId: customEvent.detail.noteId,
        reason: customEvent.detail.reason,
      });

      setTimeout(() => {
        isDeletingRef.current = false;
      }, 200);
    };

    const handleCreateNoteAfter = async (e: Event) => {
      const customEvent = e as CustomEvent<{ afterNoteId: string; newNoteId?: string; category?: string }>;
      if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Enter event received:', customEvent.detail);

      emitPendingChangesRef.current();

      const afterNote = notes.find(n => n.id === customEvent.detail.afterNoteId);

      if (afterNote) {
        const result = await processNoteBlock(afterNote.id);

        noteEventBus.emit({
          type: 'NOTE_CREATE_REQUESTED',
          afterNoteId: afterNote.id,
          tempBlockId: customEvent.detail.newNoteId || '',
          category: (result?.finalCategory || customEvent.detail.category || afterNote.category) as NoteCategory,
          deadline: afterNote.deadline,
          labelIds: result?.labelIds || [],
          assigneeId: result?.parsedAssigneeId || null,
        });
      } else if (customEvent.detail.newNoteId) {
        pendingBlockIdsRef.current.delete(customEvent.detail.newNoteId);
      }
    };

    const handleTogglePin = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string }>;
      emitPendingChangesRef.current();

      const note = notes.find(n => n.id === customEvent.detail.noteId);
      if (!note) return;

      const block = editor.getBlock(customEvent.detail.noteId);
      if (block) {
        editor.updateBlock(block, {
          props: { ...block.props, pinned: !note.pinned }
        } as any);
      }

      noteEventBus.emit({
        type: 'NOTE_PIN_TOGGLED',
        noteId: customEvent.detail.noteId,
      });
    };

    const handleToggleFixInSidebar = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string }>;
      emitPendingChangesRef.current();
      noteEventBus.emit({
        type: 'NOTE_FIX_IN_SIDEBAR_TOGGLED',
        noteId: customEvent.detail.noteId,
      });
    };

    // Register all event listeners
    window.addEventListener('notepad:navigateToDescription', handleNavigateToDescription);
    window.addEventListener('notepad:toggleCompleted', handleToggleCompleted);
    window.addEventListener('notepad:markPending', handleMarkPending);
    window.addEventListener('notepad:lostFocus', handleLostFocus);
    window.addEventListener('notepad:delete', handleDelete);
    window.addEventListener('notepad:createNoteAfter', handleCreateNoteAfter);
    window.addEventListener('notepad:togglePin', handleTogglePin);
    window.addEventListener('notepad:toggleFixInSidebar', handleToggleFixInSidebar);

    return () => {
      window.removeEventListener('notepad:navigateToDescription', handleNavigateToDescription);
      window.removeEventListener('notepad:toggleCompleted', handleToggleCompleted);
      window.removeEventListener('notepad:markPending', handleMarkPending);
      window.removeEventListener('notepad:lostFocus', handleLostFocus);
      window.removeEventListener('notepad:delete', handleDelete);
      window.removeEventListener('notepad:createNoteAfter', handleCreateNoteAfter);
      window.removeEventListener('notepad:togglePin', handleTogglePin);
      window.removeEventListener('notepad:toggleFixInSidebar', handleToggleFixInSidebar);
    };
  }, [notes, editor, processNoteBlock]);

  // Listen for NOTE_CREATED events to update mapping
  useEffect(() => {
    const unsubscribe = noteEventBus.on('NOTE_CREATED', (event) => {
      if (event.type === 'NOTE_CREATED') {
        if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Note created, storing mapping:', {
          tempBlockId: event.tempBlockId,
          noteId: event.noteId,
        });
        blockIdToNoteIdRef.current.set(event.tempBlockId, event.noteId);
        pendingBlockIdsRef.current.delete(event.tempBlockId);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`blocknote-note-list ${compactView ? 'compact-view' : ''} ${isSyncingFilter ? 'blocknote-syncing' : ''} ${editorHasFocus ? 'has-focus' : ''}`}
      onFocus={() => setEditorHasFocus(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setEditorHasFocus(false);
          emitPendingChangesRef.current();
        }
      }}
    >
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
