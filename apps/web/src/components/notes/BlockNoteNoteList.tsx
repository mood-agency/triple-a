import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { es as esLocale } from '@blocknote/core/locales';
import { BlockNoteView } from '@blocknote/shadcn';
import '@blocknote/shadcn/style.css';
import { animate } from 'motion';
import { NotepadBlock } from '@/components/blocknote/NotepadBlock';
import { notesToBlocks, getBlockContent } from '@/utils/noteBlockAdapter';
import { getInitials } from '@/lib/utils';
import { useEventSubscription, eventBus } from '@/events';
import { useNoteBlockProcessing } from './hooks/useNoteBlockProcessing';
import type { Note, Label, NoteCategory } from '@/types/note';
import type { Contact } from '@/types/contact';
import { useRegisterNavigationRegion, type RegionHandler, type FocusRestorationContext, type ItemSaveData } from './navigation';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { useNoteFieldsStore } from '@/stores/useNoteFieldsStore';
import { computeSyncDecision } from './syncDecisionTree';

// Debug flags
const DEBUG_BLOCKNOTE = false;
const DISABLE_ANIMATIONS = true;

interface BlockNoteNoteListProps {
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
  hideDate?: boolean;
  // Data mutation callbacks - BlockNoteNoteList calls these when it receives domain events
  /** Edit note content/category/description */
  onEdit?: (noteId: string, content: string, category?: NoteCategory, description?: string | null) => void;
  /** Toggle completed status of a note */
  onToggleCompleted?: (noteId: string, completed: boolean) => void;
  /** Delete a note */
  onDelete?: (noteId: string, reason: string) => void;
  /** Toggle pinned status of a note */
  onTogglePinned?: (noteId: string, pinned: boolean) => void;
  /** Create a new note after another */
  onCreateNoteAfter?: (afterNoteId: string, category: NoteCategory, deadline?: string | null, labelIds?: string[], assigneeId?: string | null, newNoteId?: string) => Promise<Note>;
  /** Add existing label to note */
  onAddLabel?: (noteId: string, labelId: string) => void | Promise<void>;
  /** Create new label and add to note */
  onCreateLabelAndAdd?: (noteId: string, labelName: string) => void | Promise<void>;
  /** Add assignee to note */
  onAddAssignee?: (noteId: string, contactId: string) => void;
  /** ID of the currently selected note */
  selectedNoteId?: string | null;
}

export const BlockNoteNoteList = ({
  notes,
  noteLabelsCache,
  noteAssigneesCache,
  onNavigateToDescription,
  onSelectNote,
  onToggleFixInSidebar,
  compactView = false,
  fixedNoteId = null,
  hideDate = false,
  onEdit,
  onToggleCompleted,
  onDelete,
  onTogglePinned,
  onCreateNoteAfter,
  onAddLabel,
  onCreateLabelAndAdd,
  onAddAssignee,
  selectedNoteId,
}: BlockNoteNoteListProps) => {
  // Read/write title from Zustand store map by selected note ID
  const selectedNoteTitleValue = useNoteFieldsStore(s => selectedNoteId ? s.notes[selectedNoteId]?.titleValue ?? '' : '');
  const storeSetTitleValue = useNoteFieldsStore(s => s.setTitleValue);
  // Delete dialog state
  const [deleteDialogNoteId, setDeleteDialogNoteId] = useState<string | null>(null);

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
    [notes, labelDataCache, assigneeDataCache, compactView, fixedNoteId, hideDate]
  );

  // Create editor
  const editor = useCreateBlockNote({
    schema,
    initialContent: initialContent.length > 0 ? initialContent : undefined,
    trailingBlock: false,
    dictionary: {
      ...esLocale,
      placeholders: {
        ...esLocale.placeholders,
        default: "",
      },
    },
  });

  // Cache for newly created notes that haven't appeared in props yet
  // Maps blockId -> { category, deadline } for notes created via Enter key
  const newlyCreatedNotesRef = useRef<Map<string, { category: NoteCategory; deadline: string | null }>>(new Map());

  // Track previous note IDs to detect actual filtering changes
  const previousNoteIdsRef = useRef<string>('');

  // Track previous label/assignee data to avoid unnecessary syncs
  const previousLabelDataRef = useRef<string>('');
  const previousAssigneeDataRef = useRef<string>('');

  // Track previous note props (category, deadline, completed) to avoid unnecessary syncs
  const previousNotePropsRef = useRef<string>('');

  // Flag to prevent saves during programmatic updates
  const isSyncingRef = useRef(false);

  // Flag to prevent sync when deleting blocks
  const isDeletingRef = useRef(false);

  // Flag to prevent order-change sync during internal saves
  // When we save a note, updated_at changes which may reorder the notes array
  // We don't want to replace the document just because of our own save
  const isSavingInternallyRef = useRef(false);

  // Helper to read content directly from DOM (fallback when BlockNote hasn't synced)
  const getBlockContentFromDOM = useCallback((blockId: string): string => {
    const blockElement = document.querySelector(`[data-id="${blockId}"]`);
    if (!blockElement) return '';
    const contentElement = blockElement.querySelector('.notepad-content');
    return contentElement?.textContent || '';
  }, []);

  // Shared hook for hashtag/mention parsing
  const processingCallbacks = useMemo(() => ({
    onEdit, onAddLabel, onCreateLabelAndAdd, onAddAssignee,
  }), [onEdit, onAddLabel, onCreateLabelAndAdd, onAddAssignee]);

  const { processNoteBlock, getCleanedContent } = useNoteBlockProcessing({
    notes,
    noteLabelsCache,
    editor,
    callbacks: processingCallbacks,
    getBlockContentFromDOM,
    isSavingInternallyRef,
  });

  // Ref for processNoteBlock (assigned later, used by region handler)
  const processNoteBlockRef = useRef<((noteId: string) => Promise<{ finalCategory: string; labelIds: string[]; parsedAssigneeId: string | null; parsed: any } | null>) | null>(null);

  // Track if we're syncing filter changes to hide content during transition
  const [isSyncingFilter, setIsSyncingFilter] = useState(false);

  // Track if we're animating to full or compact view
  const [isAnimatingToFull, setIsAnimatingToFull] = useState(false);
  const [isAnimatingToCompact, setIsAnimatingToCompact] = useState(false);

  // Ref for the container element for animations
  const containerRef = useRef<HTMLDivElement>(null);

  // Track previous note IDs for animation triggers
  const prevNoteIdsForAnimationRef = useRef<string>('');

  // Flag to prevent overlapping animations
  const isAnimatingRef = useRef(false);

  // Skip animation on initial mount (prevents flash on page load)
  const isInitialMountRef = useRef(true);

  // Track previous compactView state to detect mode changes
  const prevCompactViewRef = useRef(compactView);

  // Track pending animation frame IDs for cleanup
  const animationFrameRef = useRef<number | null>(null);

  // Track running animations for cleanup
  const runningAnimationsRef = useRef<Array<{ stop: () => void }>>([]);

  // Function to trigger the stagger animation for list changes (filters, search, etc.)
  const triggerStaggerAnimation = useCallback(() => {
    // Skip if no notes or container, or if animations are disabled
    if (notes.length === 0 || !containerRef.current || DISABLE_ANIMATIONS) {
      isAnimatingRef.current = false;
      return;
    }

    // Cancel any existing requestAnimationFrame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // Stop all currently running animations to prevent glitches/conflicts
    runningAnimationsRef.current.forEach(anim => anim.stop());
    runningAnimationsRef.current = [];

    // Use a small timeout (30ms) instead of just requestAnimationFrame
    // This gives BlockNote and the browser enough time to finish potentially heavy 
    // DOM operations (like replaceBlocks) before we start animating layout.
    const timerId = window.setTimeout(() => {
      const blocks = containerRef.current?.querySelectorAll('.bn-block-outer');

      if (blocks && blocks.length > 0) {
        const totalDuration = 0.15 + (blocks.length - 1) * 0.02;

        // Animate each block with stagger
        const animations: Array<{ stop: () => void }> = [];
        blocks.forEach((block, index) => {
          const el = block as HTMLElement;

          const anim = (animate as any)(
            el,
            {
              opacity: [0, 1],
              transform: ['translateY(12px)', 'translateY(0px)']
            },
            {
              duration: 0.15,
              delay: index * 0.02,
              easing: 'ease-out'
            }
          );
          animations.push(anim);
        });
        runningAnimationsRef.current = animations;

        // Reset flag after animation completes
        window.setTimeout(() => {
          isAnimatingRef.current = false;
        }, totalDuration * 1000 + 50);
      } else {
        isAnimatingRef.current = false;
      }
    }, 30);

    // Save timer id in the ref (abusing the ref name but same purpose)
    animationFrameRef.current = timerId as any;
  }, [notes.length]);

  // Helper function to set cursor position within a block (same logic as NavigateBlockCommand)
  const setCursorAtOffset = useCallback((blockId: string, targetOffset: number): boolean => {
    // Find the block's content element
    const blockElement = document.querySelector(`[data-id="${blockId}"]`);
    if (!blockElement) return false;

    const contentElement = blockElement.querySelector('.notepad-content');
    if (!contentElement) return false;

    // Get the text content length of the target block
    const textContent = contentElement.textContent || "";
    const maxOffset = textContent.length;

    // Clamp the offset to the available text length
    const actualOffset = Math.min(targetOffset, maxOffset);

    // Walk through text nodes to find the right position
    const walker = document.createTreeWalker(
      contentElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let targetNode: Text | null = null;
    let nodeOffset = 0;

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const nodeLength = textNode.length;

      if (currentOffset + nodeLength >= actualOffset) {
        targetNode = textNode;
        nodeOffset = actualOffset - currentOffset;
        break;
      }

      currentOffset += nodeLength;
    }

    if (targetNode) {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.setStart(targetNode, nodeOffset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
      }
    }
    return false;
  }, []);

  // Register this component as the task list region in the navigation mediator
  const taskListRegionHandler = useMemo<RegionHandler>(() => ({
    region: 'taskList',
    focusFirst: (_column?: number, context?: FocusRestorationContext) => {
      if (notes.length === 0) return false;

      // If a specific noteId is provided, focus that block
      if (context?.noteId) {
        const targetBlock = editor.document.find(block => block.id === context.noteId);
        if (targetBlock) {
          // First set cursor to start (same pattern as NavigateBlockCommand)
          editor.setTextCursorPosition(targetBlock, 'start');

          // If we have a specific column/offset, adjust position after focus
          if (context.column !== undefined) {
            // Use requestAnimationFrame to ensure editor is focused first
            requestAnimationFrame(() => {
              setCursorAtOffset(targetBlock.id, context.column!);
            });
          }
          return true;
        }
      }

      // Default: focus the first block
      const firstBlock = editor.document[0];
      if (firstBlock) {
        editor.setTextCursorPosition(firstBlock, 'start');
        editor.focus();
        return true;
      }
      return false;
    },
    focusLast: () => {
      if (notes.length > 0) {
        const lastBlock = editor.document[editor.document.length - 1];
        if (lastBlock) {
          // Focus the editor and set cursor to the end of the last block
          editor.setTextCursorPosition(lastBlock, 'end');
          editor.focus();
          return true;
        }
      }
      return false;
    },
    canReceiveFocus: () => notes.length > 0,

    // Get data for an item to be saved (mediator calls this, then passes to onSaveItem callback)
    getItemData: (itemId: string): ItemSaveData | null => {
      if (!itemId || isDeletingRef.current) return null;

      const note = notes.find(n => n.id === itemId);
      if (!note) return null;

      // Get content from editor (try BlockNote data first, fall back to DOM)
      const block = editor.getBlock(itemId);
      if (!block) return null;

      let content = getBlockContent(block);
      if (!content) {
        content = getBlockContentFromDOM(itemId);
      }

      // Ensure we save cleaned content (parsing hashtags) even for this generic save
      // This covers edge cases like window blur where processNoteBlock might race
      const cleanedContent = getCleanedContent(content);

      // Set flag to prevent order-change sync from replacing the document after save
      isSavingInternallyRef.current = true;
      setTimeout(() => {
        isSavingInternallyRef.current = false;
      }, 500);

      return {
        content: cleanedContent,
        category: note.category,
        description: note.description,
      };
    },

    getCurrentItemId: () => {
      const cursor = editor.getTextCursorPosition();
      return cursor?.block.id ?? null;
    },
  }), [editor, notes, setCursorAtOffset]);

  useRegisterNavigationRegion(taskListRegionHandler);


  // Clean up newly created notes cache when they appear in props
  useEffect(() => {
    const noteIds = new Set(notes.map(n => n.id));
    for (const cachedId of newlyCreatedNotesRef.current.keys()) {
      if (noteIds.has(cachedId)) {
        newlyCreatedNotesRef.current.delete(cachedId);
      }
    }
  }, [notes]);

  // Save current item on unmount
  useEffect(() => {
    return () => {
      eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });
    };
  }, []);

  // Sync stagger animation with isSyncingFilter lifecycle
  useEffect(() => {
    // Only trigger when we finish syncing filters and have notes
    // We don't check isAnimatingRef here because we WANT to animate 
    // whenever a filter sync successfully completes.
    if (!isSyncingFilter && notes.length > 0 && previousNoteIdsRef.current !== '') {
      isAnimatingRef.current = true;
      triggerStaggerAnimation();
    }
  }, [isSyncingFilter, notes.length, triggerStaggerAnimation]);

  // Trigger stagger animation when the list changes (filters, search, etc.)
  useEffect(() => {
    // Skip if no notes
    if (notes.length === 0) return;

    const currentNoteIds = notes.map(n => n.id).join(',');

    // On initial mount with data, just store the IDs (no animation yet)
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      prevNoteIdsForAnimationRef.current = currentNoteIds;
      return;
    }

    // Skip if no change or already animating
    if (prevNoteIdsForAnimationRef.current === currentNoteIds || isAnimatingRef.current) {
      return;
    }

    // List changed - trigger animation
    prevNoteIdsForAnimationRef.current = currentNoteIds;

    // If we're not syncing filters, start animation immediately
    // If we ARE syncing, the other useEffect handles it when isSyncingFilter becomes false
    if (!isSyncingFilter) {
      isAnimatingRef.current = true;
      triggerStaggerAnimation();
    }
  }, [notes, isSyncingFilter, triggerStaggerAnimation]);

  // Animate elements when switching between compact and full view
  useEffect(() => {
    // Cancel any pending animations and frames when compactView changes
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    runningAnimationsRef.current.forEach(anim => anim.stop());
    runningAnimationsRef.current = [];

    // Skip initial mount
    if (isInitialMountRef.current) {
      prevCompactViewRef.current = compactView;
      return;
    }

    // Detect transition
    const isToFull = prevCompactViewRef.current === true && compactView === false;
    const isToCompact = prevCompactViewRef.current === false && compactView === true;

    if (DISABLE_ANIMATIONS) {
      prevCompactViewRef.current = compactView;
      setIsAnimatingToFull(false);
      setIsAnimatingToCompact(false);
      return;
    }

    if (isToFull) {
      // Hide elements immediately before they render
      setIsAnimatingToFull(true);
      setIsAnimatingToCompact(false);

      // Wait for CSS to apply and elements to be in the DOM (but hidden)
      const frameId1 = requestAnimationFrame(() => {
        const frameId2 = requestAnimationFrame(() => {
          animationFrameRef.current = null;

          // Select elements
          const checkboxes = containerRef.current?.querySelectorAll('.notepad-category-checkbox');
          const metadataElements = containerRef.current?.querySelectorAll('.notepad-metadata');
          const deadlines = containerRef.current?.querySelectorAll('.notepad-deadline');

          // Remove the hiding class so animation can start
          setIsAnimatingToFull(false);

          // Animate each element with stagger
          const animations: Array<{ stop: () => void }> = [];

          checkboxes?.forEach((el, index) => {
            const anim = (animate as any)(
              el,
              {
                opacity: [0, 1],
                width: ['0px', '24px'],
                marginRight: ['0px', '8px'],
                transform: ['translateX(-8px)', 'translateX(0px)']
              },
              { duration: 0.25, delay: index * 0.005, easing: 'ease-out' }
            );
            animations.push(anim);
          });

          metadataElements?.forEach((el, index) => {
            const anim = (animate as any)(
              el,
              {
                opacity: [0, 1],
                marginLeft: ['0px', '8px'],
                marginRight: ['0px', '8px'],
                transform: ['translateX(8px)', 'translateX(0px)']
              },
              { duration: 0.25, delay: index * 0.005, easing: 'ease-out' }
            );
            animations.push(anim);
          });

          deadlines?.forEach((el, index) => {
            const anim = (animate as any)(
              el,
              {
                opacity: [0, 1],
                marginLeft: ['0px', '8px'],
                transform: ['translateX(8px)', 'translateX(0px)']
              },
              { duration: 0.25, delay: index * 0.005, easing: 'ease-out' }
            );
            animations.push(anim);
          });

          runningAnimationsRef.current = animations;
        });
        animationFrameRef.current = frameId2;
      });
      animationFrameRef.current = frameId1;
    } else if (isToCompact) {
      // Enter "animating to compact" state
      setIsAnimatingToCompact(true);
      setIsAnimatingToFull(false);

      const checkboxes = containerRef.current?.querySelectorAll('.notepad-category-checkbox');
      const metadataElements = containerRef.current?.querySelectorAll('.notepad-metadata');
      const deadlines = containerRef.current?.querySelectorAll('.notepad-deadline');

      const animations: Array<{ stop: () => void }> = [];
      let maxDelay = 0;

      checkboxes?.forEach((el, index) => {
        const delay = index * 0.005;
        maxDelay = Math.max(maxDelay, delay);
        const anim = (animate as any)(
          el,
          {
            opacity: [1, 0],
            width: ['24px', '0px'],
            marginRight: ['8px', '0px'],
            transform: ['translateX(0px)', 'translateX(-8px)']
          },
          { duration: 0.2, delay, easing: 'ease-in' }
        );
        animations.push(anim);
      });

      metadataElements?.forEach((el, index) => {
        const delay = index * 0.005;
        maxDelay = Math.max(maxDelay, delay);
        const anim = (animate as any)(
          el,
          {
            opacity: [1, 0],
            marginLeft: ['8px', '0px'],
            marginRight: ['8px', '0px'],
            transform: ['translateX(0px)', 'translateX(8px)']
          },
          { duration: 0.2, delay, easing: 'ease-in' }
        );
        animations.push(anim);
      });

      deadlines?.forEach((el, index) => {
        const delay = index * 0.005;
        maxDelay = Math.max(maxDelay, delay);
        const anim = (animate as any)(
          el,
          {
            opacity: [1, 0],
            marginLeft: ['8px', '0px'],
            transform: ['translateX(0px)', 'translateX(8px)']
          },
          { duration: 0.2, delay, easing: 'ease-in' }
        );
        animations.push(anim);
      });

      runningAnimationsRef.current = animations;

      const totalWait = (maxDelay + 0.2) * 1000 + 20;
      setTimeout(() => {
        setIsAnimatingToCompact(false);
        // Clean up inline styles
        [checkboxes, metadataElements, deadlines].forEach(nodeList => {
          nodeList?.forEach(el => {
            const element = el as HTMLElement;
            element.style.opacity = '';
            element.style.width = '';
            element.style.margin = '';
            element.style.transform = '';
          });
        });
      }, totalWait);
    } else {
      // For any other state change, clean up
      setIsAnimatingToFull(false);
      setIsAnimatingToCompact(false);
    }

    prevCompactViewRef.current = compactView;
  }, [compactView]);

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
  // This emits editor:blockSelection event that blocks can subscribe to
  // Also handles multi-block selection prevention centrally

  // Use ref to track previous block ID across renders/effect re-runs
  const previousBlockIdRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = editor.onSelectionChange(() => {
      // Skip selection handling during programmatic syncs to avoid event loops
      if (isSyncingRef.current) return;

      const cursor = editor.getTextCursorPosition();
      const blockId = cursor?.block.id ?? null;

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

      const previousBlockId = previousBlockIdRef.current;

      // Only emit if selection actually changed
      if (blockId !== previousBlockId) {
        // Emit navigation event - mediator will coordinate saving the previous item
        // This unifies the save flow for all navigation: Enter, Tab, Arrow keys
        eventBus.emit('navigation:itemChanged', {
          region: 'taskList',
          itemId: blockId,
        });

        // NEW: Process the previous block to ensure tags are parsed and content is cleaned
        // This handles cases like navigating with Arrow keys where focus isn't lost
        // usage of ref required to avoid stale closure (useEffect deps don't include processNoteBlock)
        if (previousBlockId) {
          if (processNoteBlockRef.current) {
            processNoteBlockRef.current(previousBlockId);
          }
        }

        // Emit centralized selection event for blocks to consume (UI updates like isEditing)
        eventBus.emit('editor:blockSelection', {
          selectedBlockId: blockId,
          previousBlockId: previousBlockId,
        });

        // Also notify parent for UI updates
        if (blockId && onSelectNote) {
          if (DEBUG_BLOCKNOTE) console.log('[BlockNote] Switching from task', previousBlockId, 'to task', blockId);
          onSelectNote(blockId);
        }

        previousBlockIdRef.current = blockId;
      }
    });

    return () => unsubscribe();
  }, [editor, onSelectNote]);

  // Update all blocks when fixed note changes or notes are loaded
  useEffect(() => {
    // Wait a tick to ensure editor is fully initialized
    const timer = setTimeout(() => {
      isSyncingRef.current = true;

      editor.document.forEach(block => {
        if (block.type === 'notepad') {
          const shouldBeFixed = block.id === fixedNoteId;
          const currentlyFixed = (block as any).props.fixedInSidebar;

          // Only update if the state needs to change
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

  // Sync notes changes (for filtering/sorting) - when the VIEW changes
  // Don't sync when notes are added/edited (BlockNote handles this internally)
  // Decision logic extracted to syncDecisionTree.ts for testability
  useEffect(() => {
    const currentNoteIds = notes.map(n => n.id);
    const previousNoteIds = previousNoteIdsRef.current
      ? previousNoteIdsRef.current.split(',').filter(Boolean)
      : [];

    const editorHasFocus = containerRef.current?.querySelector('.ProseMirror')?.contains(document.activeElement) ?? false;

    const decision = computeSyncDecision({
      currentNoteIds,
      previousNoteIds,
      editorBlockIds: editor.document.map(b => b.id),
      isSavingInternally: isSavingInternallyRef.current,
      editorHasFocus,
    });

    // Update ref for next comparison
    previousNoteIdsRef.current = currentNoteIds.join(',');

    if (decision.shouldSync) {
      if (decision.shouldHideContent) {
        setIsSyncingFilter(true);
      }

      // Use setTimeout to avoid flushSync issues during React render
      setTimeout(() => {
        // Set syncing flag to prevent onChange from triggering saves
        isSyncingRef.current = true;

        // Replace entire document when filtering changes
        const newContent = notesToBlocks(notes, labelDataCache, assigneeDataCache, compactView, fixedNoteId, hideDate);
        const blocksToReplace = editor.document.map(b => b.id);
        editor.replaceBlocks(blocksToReplace, newContent as any);

        // Reset syncing flag and show content after BlockNote settles
        setTimeout(() => {
          isSyncingRef.current = false;
          setIsSyncingFilter(false);
        }, 50);
      }, 0);
    }
  }, [editor, notes, labelDataCache, assigneeDataCache, compactView, fixedNoteId]);

  // Sync external changes (labels, assignees) back to blocks - only when they actually change
  useEffect(() => {
    // Create fingerprints of label and assignee data
    const labelFingerprint = JSON.stringify(Array.from(labelDataCache.entries()));
    const assigneeFingerprint = JSON.stringify(Array.from(assigneeDataCache.entries()));

    // Skip if nothing actually changed
    if (
      previousLabelDataRef.current === labelFingerprint &&
      previousAssigneeDataRef.current === assigneeFingerprint
    ) {
      return;
    }

    previousLabelDataRef.current = labelFingerprint;
    previousAssigneeDataRef.current = assigneeFingerprint;

    // Use setTimeout to avoid flushSync issues during React render
    setTimeout(() => {
      const blocks = editor.document;
      let hasChanges = false;

      // Set syncing flag before making changes
      isSyncingRef.current = true;

      blocks.forEach((block: any) => {
        if (block.type !== 'notepad') return;

        const note = notes.find(n => n.id === block.id);
        if (!note) return;

        const labelData = labelDataCache.get(note.id) ?? [];
        const assigneeData = assigneeDataCache.get(note.id) ?? [];

        // Check if labels or assignees changed
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

      // Reset syncing flag after a brief delay
      if (hasChanges) {
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      } else {
        isSyncingRef.current = false;
      }
    }, 0);
  }, [editor, notes, labelDataCache, assigneeDataCache]);

  // Sync note property changes (category, deadline, completed, content) back to blocks
  // Same pattern as labels/assignees sync: fingerprint comparison + editor.updateBlock()
  useEffect(() => {
    // Create fingerprint of note properties that affect block rendering
    const notePropsFingerprint = notes.map(n => `${n.id}:${n.category}:${n.deadline ?? ''}:${n.is_all_day}:${n.completed}:${n.content}`).join('|');

    // Skip if nothing changed
    if (previousNotePropsRef.current === notePropsFingerprint) {
      return;
    }

    previousNotePropsRef.current = notePropsFingerprint;

    // Use setTimeout to avoid flushSync issues during React render
    setTimeout(() => {
      const blocks = editor.document;
      let hasChanges = false;

      // Get the block currently being edited so we don't overwrite user's typing
      const cursorBlockId = editor.getTextCursorPosition()?.block.id ?? null;

      isSyncingRef.current = true;

      blocks.forEach((block: any) => {
        if (block.type !== 'notepad') return;

        const note = notes.find(n => n.id === block.id);
        if (!note) return;

        const categoryChanged = block.props.category !== note.category;
        const deadlineChanged = (block.props.date ?? null) !== (note.deadline ?? null);
        const isAllDayChanged = block.props.isAllDay !== note.is_all_day;
        const completedChanged = block.props.isChecked !== note.completed;

        // Only sync content for blocks NOT being edited in the task list
        // (content changes come from the editor panel's EditableTitle)
        const blockContent = getBlockContent(block);
        const contentChanged = block.id !== cursorBlockId && blockContent !== note.content;

        if (categoryChanged || deadlineChanged || isAllDayChanged || completedChanged || contentChanged) {
          const updatePayload: any = {
            props: {
              ...block.props,
              category: note.category,
              date: note.deadline ?? null,
              isAllDay: note.is_all_day,
              isChecked: note.completed,
            }
          };

          if (contentChanged) {
            updatePayload.content = [{ type: 'text', text: note.content }];
          }

          editor.updateBlock(block, updatePayload);
          hasChanges = true;
        }
      });

      if (hasChanges) {
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 100);
      } else {
        isSyncingRef.current = false;
      }
    }, 0);
  }, [editor, notes]);

  // Sync live editor title to the selected note's block in real-time
  // Uses a ref-based approach to avoid triggering the main sync effect
  const selectedNoteTitleRef = useRef(selectedNoteTitleValue);
  selectedNoteTitleRef.current = selectedNoteTitleValue;
  const selectedNoteIdRef = useRef(selectedNoteId);
  selectedNoteIdRef.current = selectedNoteId;

  useEffect(() => {
    if (!selectedNoteId || selectedNoteTitleValue === undefined) return;

    const block = editor.getBlock(selectedNoteId);
    if (!block || block.type !== 'notepad') return;

    const blockContent = getBlockContent(block);
    if (blockContent === selectedNoteTitleValue) return;

    // Don't update if the user is actively editing this block inline in BlockNote.
    // Check actual DOM focus — ProseMirror retains cursor position even when unfocused,
    // so we must verify the editor has focus before skipping the sync.
    const editorElement = document.querySelector('.blocknote-note-list');
    const editorHasFocus = editorElement?.contains(document.activeElement) ?? false;
    if (editorHasFocus) {
      const cursorBlockId = editor.getTextCursorPosition()?.block.id ?? null;
      if (cursorBlockId === selectedNoteId) return;
    }

    isSyncingRef.current = true;
    const updatePayload: any = {
      content: [{ type: 'text', text: selectedNoteTitleValue }],
    };
    editor.updateBlock(block, updatePayload);
    setTimeout(() => {
      isSyncingRef.current = false;
    }, 100);
  }, [editor, selectedNoteId, selectedNoteTitleValue]);

  // Sync task list content changes back to the editor panel in real-time
  // When user edits a note title inline in BlockNote, write to Zustand store so EditableTitle updates
  useEffect(() => {
    if (!selectedNoteId) return;

    const unsubscribe = editor.onChange(() => {
      // Skip if this change was caused by a programmatic sync (e.g., from editor panel)
      if (isSyncingRef.current) return;

      const block = editor.getBlock(selectedNoteIdRef.current ?? '');
      if (!block) return;

      const content = getBlockContent(block);
      const id = selectedNoteIdRef.current;
      if (id) storeSetTitleValue(id, content);
    });

    return () => unsubscribe();
  }, [editor, selectedNoteId, storeSetTitleValue]);

  // Save when clicking outside the editor (more reliable than focusout for ProseMirror)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const editorElement = document.querySelector('.blocknote-note-list');
      const isOutside = editorElement && !editorElement.contains(e.target as Node);

      if (isOutside) {
        // Small delay to let any pending BlockNote operations complete
        setTimeout(() => {
          eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });
        }, 50);
      }
    };

    // Also save on blur from the window (e.g., switching tabs)
    const handleWindowBlur = () => {
      eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, []);

  // Listen for Tab navigation events from blocks (via event bus)
  // Note: NotesWorkspace also listens to this event to update titleValue for immediate UI sync
  useEventSubscription('editor:navigateToDescription', (event) => {
    // Save content with hashtag parsing before navigating away (fire-and-forget to avoid blocking navigation)
    processNoteBlock(event.payload.noteId).then((result) => {
      if (!result) {
        // Note not in props yet, fall back to mediator save
        eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });
      }
    });

    // Push current position to history before navigating away (including cursor offset)
    eventBus.emit('navigation:pushHistory', {
      region: 'taskList',
      noteId: event.payload.noteId,
      column: event.payload.cursorOffset,
    });

    // Ensure the parent's selectedNote matches the block the user is on.
    // For existing notes, onSelectionChange already called onSelectNote.
    // But for newly-created notes (Enter key), onSelectionChange fired before
    // the note existed in the notes[] array, so selectedNote may still point
    // to the previous note. Calling onSelectNote here is safe because:
    // - handleNavigateToDescription() sets navigatingToDescriptionRef synchronously,
    //   so the useNoteSelection useEffect won't close the description panel.
    // - If the note is already selected, handleSelectNoteById is a no-op.
    if (onSelectNote) {
      onSelectNote(event.payload.noteId);
    }

    // Navigate to the description panel
    if (onNavigateToDescription) {
      onNavigateToDescription();
    }
  });

  // Listen for toggle completed events from blocks (via event bus)
  // Handles local state and calls callback for persistence
  useEventSubscription('note:completed', (event) => {
    // Skip if this event came from a command (avoid infinite loop)
    if (event.source === 'command') {
      return;
    }

    // Save content before toggling complete
    eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });

    // When completing a task, remove the block from the editor BEFORE
    // calling onToggleCompleted. This prevents the sync effect from
    // detecting a "filter change" (removedIdsStillInDocument) and
    // flashing the entire list with opacity:0.
    if (event.payload.completed) {
      const block = editor.getBlock(event.payload.noteId);
      if (block) {
        // FLIP animation: capture positions of blocks below before removal
        const allBlockOuters = containerRef.current?.querySelectorAll('.bn-block-outer');
        const positionsBefore = new Map<string, DOMRect>();
        let foundRemoved = false;

        if (allBlockOuters) {
          allBlockOuters.forEach((el) => {
            const id = el.querySelector('[data-id]')?.getAttribute('data-id');
            if (id === event.payload.noteId) {
              foundRemoved = true;
              return;
            }
            if (foundRemoved && id) {
              positionsBefore.set(id, el.getBoundingClientRect());
            }
          });
        }

        // Move cursor to adjacent block before removing
        const cursorInfo = editor.getTextCursorPosition();
        if (cursorInfo?.block.id === event.payload.noteId) {
          const nextBlock = cursorInfo.nextBlock;
          const prevBlock = cursorInfo.prevBlock;
          if (nextBlock) {
            editor.setTextCursorPosition(nextBlock, 'start');
          } else if (prevBlock) {
            editor.setTextCursorPosition(prevBlock, 'end');
          }
        }

        // Hide the block element immediately to prevent a flash between
        // the CSS fade-out animation ending and ProseMirror removing the node
        const blockOuter = containerRef.current?.querySelector(
          `.bn-block-outer:has([data-id="${event.payload.noteId}"])`
        );
        if (blockOuter) {
          (blockOuter as HTMLElement).style.display = 'none';
        }

        isSyncingRef.current = true;
        editor.removeBlocks([block]);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 50);

        // FLIP animation: animate remaining blocks sliding up
        if (positionsBefore.size > 0) {
          requestAnimationFrame(() => {
            const blocksAfter = containerRef.current?.querySelectorAll('.bn-block-outer');
            blocksAfter?.forEach((el) => {
              const id = el.querySelector('[data-id]')?.getAttribute('data-id');
              if (id && positionsBefore.has(id)) {
                const beforeRect = positionsBefore.get(id)!;
                const afterRect = el.getBoundingClientRect();
                const deltaY = beforeRect.top - afterRect.top;
                if (Math.abs(deltaY) > 1) {
                  (animate as any)(
                    el as HTMLElement,
                    { transform: [`translateY(${deltaY}px)`, 'translateY(0px)'] },
                    { duration: 0.2, easing: 'ease-out' }
                  );
                }
              }
            });
          });
        }
      }
    }

    // Call callback for persistence
    if (onToggleCompleted) {
      onToggleCompleted(event.payload.noteId, event.payload.completed);
    }
  });

  // Listen for lost focus events from blocks to trigger auto-save with hashtag parsing (via event bus)
  useEventSubscription('editor:focusLost', async (event) => {
    // Skip save if we're in the process of deleting
    if (isDeletingRef.current) {
      if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Block lost focus during delete, skipping save');
      return;
    }
    if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Block lost focus, processing hashtags and saving:', event.payload.noteId);

    // Process the note block (parses hashtags, creates labels, assigns contacts)
    // If processNoteBlock returns null (note not found in props yet), use mediator save
    const result = await processNoteBlock(event.payload.noteId);
    if (!result) {
      // Note is newly created and not in props yet, use mediator save
      eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });
    }
  });

  // Keep ref in sync for use by region handler
  useEffect(() => {
    processNoteBlockRef.current = processNoteBlock;
  }, [processNoteBlock]);

  // Listen for delete events from blocks (via event bus)
  // Handles local state and calls callback for persistence
  useEventSubscription('note:deleted', (event) => {
    // Skip if this event came from a command (avoid infinite loop)
    if (event.source === 'command') {
      return;
    }

    // Set flag to prevent sync from replacing blocks during delete
    isDeletingRef.current = true;

    // Call callback for persistence
    if (onDelete) {
      onDelete(event.payload.noteId, event.payload.reason);
    }

    // Reset flag after delete is processed (allow next render cycle to complete)
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

  // Listen for create note events from blocks (Enter key) (via event bus)
  // Handles local state (cache) and calls callback for note creation
  useEventSubscription('editor:createNoteAfter', async (event) => {
    eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });

    // Find the note we're creating after - could be in props or in our cache
    const afterNote = notes.find(n => n.id === event.payload.afterNoteId);
    const afterNoteFromCache = newlyCreatedNotesRef.current.get(event.payload.afterNoteId);

    // Determine category and deadline from either source
    const category = afterNote?.category || afterNoteFromCache?.category || (event.payload.category as NoteCategory) || 'todo';
    const deadline = afterNote?.deadline || afterNoteFromCache?.deadline || null;

    // Add the new note to our cache so we can save its content later
    newlyCreatedNotesRef.current.set(event.payload.newNoteId!, {
      category,
      deadline,
    });

    let labelIds: string[] = [];
    let assigneeId: string | null = null;

    if (afterNote) {
      // Process the block the user just finished (parse hashtags, etc.)
      const result = await processNoteBlock(event.payload.afterNoteId);
      if (result) {
        labelIds = result.labelIds;
        assigneeId = result.parsedAssigneeId;
      }
    }

    // Set flag to prevent sync effect from replacing blocks during creation
    // (the new note is already in the editor via Enter key, so a full
    // document replacement would lose caret position and typed content)
    isSavingInternallyRef.current = true;

    // Call callback for persistence
    if (onCreateNoteAfter) {
      await onCreateNoteAfter(
        event.payload.afterNoteId,
        category,
        deadline,
        labelIds,
        assigneeId,
        event.payload.newNoteId
      );
    }

    setTimeout(() => {
      isSavingInternallyRef.current = false;
    }, 500);
  });

  // Listen for toggle pin events from blocks (via event bus)
  // Handles local editor state and calls callback for persistence
  useEventSubscription('note:pinned', (event) => {
    // Skip if this event came from a command (avoid infinite loop)
    if (event.source === 'command') {
      return;
    }

    const noteId = event.payload.noteId;

    // Save current content before toggling pin
    eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });

    // Update block's pinned prop with the new state from the event
    const block = editor.getBlock(noteId);
    if (block) {
      editor.updateBlock(block, {
        props: { ...block.props, pinned: event.payload.pinned }
      } as any);
    }

    // Call callback for persistence
    if (onTogglePinned) {
      onTogglePinned(noteId, event.payload.pinned);
    }
  });

  // Listen for toggle fix in sidebar events from blocks (via event bus)
  useEventSubscription('note:fixedInSidebar', (event) => {
    // Save current content before toggling sidebar fix
    eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });

    if (onToggleFixInSidebar) {
      onToggleFixInSidebar(event.payload.noteId);
    }
  });

  return (
    <div
      ref={containerRef}
      className={`blocknote-note-list ${isSyncingFilter ? 'blocknote-syncing' : ''} ${compactView && !isAnimatingToCompact ? 'compact-view' : ''} ${isAnimatingToFull ? 'animating-to-full' : ''} ${isAnimatingToCompact ? 'animating-to-compact' : ''}`}
      onBlur={(e) => {
        // Only save if focus is leaving the editor entirely (not moving between blocks)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          eventBus.emit('navigation:saveCurrentItem', { region: 'taskList' });
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
