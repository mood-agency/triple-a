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
import { parseHashtags } from '@/utils/hashtagParser';
import { useLabels } from '@/hooks/useLabels';
import { useContacts } from '@/hooks/useContacts';
import { useEventSubscription, eventBus } from '@/events';
import { useCommandDispatch } from '@/cqrs';
import {
  UpdateNoteCommand,
  DeleteNoteCommand,
  ToggleCompletedCommand,
  TogglePinnedCommand,
  CreateNoteAfterCommand,
} from '@/cqrs/commands/notes';
import {
  AddLabelToNoteCommand,
  CreateLabelAndAddToNoteCommand,
} from '@/cqrs/commands/labels';
import { AddAssigneeToNoteCommand } from '@/cqrs/commands/assignees';
import { useActiveProject } from '@/contexts/ProjectContext';
import type { Note, Label, NoteCategory } from '@/types/note';
import type { Contact } from '@/types/contact';
import { useRegisterNavigationRegion, useNavigationMediatorContext, type RegionHandler, type FocusRestorationContext } from './navigation';

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
  hideDate = false
}: BlockNoteNoteListProps) => {
  // Get labels and contacts for hashtag/mention parsing
  const { labels, createLabel } = useLabels();
  const { contacts } = useContacts();

  // Get active project for new note creation
  const { activeProjectId } = useActiveProject();

  // Navigation mediator for focus history
  const navigationMediator = useNavigationMediatorContext();

  // CQRS command dispatch for data mutations
  const dispatch = useCommandDispatch();

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

  // Track content changes for auto-save
  const pendingChangesRef = useRef(false);

  // Cache for newly created notes that haven't appeared in props yet
  // Maps blockId -> { category, deadline } for notes created via Enter key
  const newlyCreatedNotesRef = useRef<Map<string, { category: NoteCategory; deadline: string | null }>>(new Map());

  // Track previous note IDs to detect actual filtering changes
  const previousNoteIdsRef = useRef<string>('');

  // Track previous label/assignee data to avoid unnecessary syncs
  const previousLabelDataRef = useRef<string>('');
  const previousAssigneeDataRef = useRef<string>('');

  // Flag to prevent saves during programmatic updates
  const isSyncingRef = useRef(false);

  // Flag to prevent sync when deleting blocks
  const isDeletingRef = useRef(false);

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
  }), [editor, notes, setCursorAtOffset]);

  useRegisterNavigationRegion(taskListRegionHandler);

  // Function to flush pending saves immediately
  const flushPendingSaves = useCallback(() => {
    console.log('[flushPendingSaves] Called, pendingChanges:', pendingChangesRef.current);
    if (!pendingChangesRef.current) {
      console.log('[flushPendingSaves] No pending changes, skipping');
      return;
    }

    const blocks = editor.document;
    let savedCount = 0;

    console.log('[flushPendingSaves] Checking', blocks.length, 'blocks against', notes.length, 'notes, newlyCreated:', newlyCreatedNotesRef.current.size);

    // Save each block that has changed
    blocks.forEach((block) => {
      if (block.type === 'notepad') {
        const content = getBlockContent(block);
        const note = notes.find(n => n.id === block.id);

        // Check if this is a newly created note not yet in props
        const newlyCreatedInfo = newlyCreatedNotesRef.current.get(block.id);

        console.log('[flushPendingSaves] Block:', block.id, 'content:', JSON.stringify(content), 'note found:', !!note, 'newlyCreated:', !!newlyCreatedInfo);

        if (note && content !== note.content) {
          // Existing note with changed content
          console.log('[flushPendingSaves] Saving existing block:', block.id);
          dispatch(new UpdateNoteCommand({
            noteId: block.id,
            content,
            category: note.category,
            description: note.description,
          }));
          savedCount++;
        } else if (!note && newlyCreatedInfo && content) {
          // Newly created note not yet in props - save its content
          console.log('[flushPendingSaves] Saving newly created block:', block.id, 'content:', content);
          dispatch(new UpdateNoteCommand({
            noteId: block.id,
            content,
            category: newlyCreatedInfo.category,
            description: null,
          }));
          savedCount++;
        }
      }
    });

    // Emit save success event for UI feedback
    if (savedCount > 0) {
      eventBus.emit('editor:saveSuccess', { savedCount });
    }

    console.log('[flushPendingSaves] Saved', savedCount, 'blocks');
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
      console.log('[onChange] Triggered, isSyncing:', isSyncingRef.current);
      if (!isSyncingRef.current) {
        pendingChangesRef.current = true;
        console.log('[onChange] Marked pendingChanges as true');
      }
    });

    return () => unsubscribe();
  }, [editor]);

  // Clean up newly created notes cache when they appear in props
  useEffect(() => {
    const noteIds = new Set(notes.map(n => n.id));
    for (const cachedId of newlyCreatedNotesRef.current.keys()) {
      if (noteIds.has(cachedId)) {
        newlyCreatedNotesRef.current.delete(cachedId);
        console.log('[cleanup] Removed from cache (now in props):', cachedId);
      }
    }
  }, [notes]);

  // Flush saves on unmount only (use ref to avoid triggering on every flushPendingSaves change)
  useEffect(() => {
    return () => {
      if (pendingChangesRef.current) {
        flushPendingSavesRef.current();
      }
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
  useEffect(() => {
    let previousBlockId: string | null = null;

    const unsubscribe = editor.onSelectionChange(() => {
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

      // Only emit if selection actually changed
      if (blockId !== previousBlockId) {
        // Emit centralized selection event for blocks to consume
        eventBus.emit('editor:blockSelection', {
          selectedBlockId: blockId,
          previousBlockId: previousBlockId,
        });

        // Also notify parent for UI updates
        if (blockId && onSelectNote) {
          if (DEBUG_BLOCKNOTE) console.log('[BlockNote] Switching from task', previousBlockId, 'to task', blockId);
          onSelectNote(blockId);
        }

        previousBlockId = blockId;
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
  useEffect(() => {
    // Create a string of note IDs to detect changes (preserve order to detect sort changes)
    const currentNoteIds = notes.map(n => n.id).join(',');

    // Only update if the set of note IDs actually changed
    if (previousNoteIdsRef.current !== currentNoteIds) {
      const previousIds = new Set(previousNoteIdsRef.current ? previousNoteIdsRef.current.split(',').filter(Boolean) : []);
      previousNoteIdsRef.current = currentNoteIds;

      const noteIds = new Set(notes.map(note => note.id));

      // Check if notes were removed from the notes array
      const removedIds = [...previousIds].filter(id => !noteIds.has(id));

      // Distinguish between delete and filter:
      // - If removed notes are still in BlockNote's document, it's a FILTER operation (need to sync)
      // - If removed notes are NOT in BlockNote's document, it's a DELETE operation (already handled)
      const removedIdsStillInDocument = removedIds.filter(id =>
        editor.document.some(block => block.id === id)
      );

      const notesWereFiltered = removedIdsStillInDocument.length > 0;

      // Also sync if this is initial load (no previous IDs) and we have notes
      const isInitialLoad = previousIds.size === 0 && notes.length > 0;

      // Detect if only the order changed (same notes, different order)
      // This happens when user applies a sort filter
      const orderChanged = removedIds.length === 0 && previousIds.size === noteIds.size && previousIds.size > 0;

      // Sync on filtering (notes removed), initial load, or order change (sorting)
      if (notesWereFiltered || isInitialLoad || orderChanged) {
        // Hide content immediately to prevent flash during transition
        if (notesWereFiltered || orderChanged) {
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

  // Save when clicking outside the editor (more reliable than focusout for ProseMirror)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const editorElement = document.querySelector('.blocknote-note-list');
      const isOutside = editorElement && !editorElement.contains(e.target as Node);

      if (isOutside) {
        // Small delay to let any pending BlockNote operations complete
        setTimeout(() => {
          flushPendingSavesRef.current();
        }, 50);
      }
    };

    // Also save on blur from the window (e.g., switching tabs)
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

  // Listen for Tab navigation events from blocks (via event bus)
  useEventSubscription('editor:navigateToDescription', (event) => {
    // Save content before navigating away
    flushPendingSavesRef.current();

    // Push current position to history before navigating away (including cursor offset)
    if (navigationMediator) {
      navigationMediator.pushFocusHistory({
        region: 'taskList',
        noteId: event.payload.noteId,
        column: event.payload.cursorOffset,
      });
    }

    // First, select the note that triggered the event
    if (onSelectNote) {
      onSelectNote(event.payload.noteId);
    }

    // Then navigate to the description panel
    if (onNavigateToDescription) {
      onNavigateToDescription();
    }
  });

  // Listen for toggle completed events from blocks (via event bus)
  useEventSubscription('note:completed', (event) => {
    // Save content before toggling complete
    flushPendingSavesRef.current();

    // Use CQRS command for toggle completed
    dispatch(new ToggleCompletedCommand({
      noteId: event.payload.noteId,
      completed: event.payload.completed,
    }));
  });

  // Listen for lost focus events from blocks to trigger auto-save (via event bus)
  useEventSubscription('editor:focusLost', (event) => {
    // Skip save if we're in the process of deleting
    if (isDeletingRef.current) {
      if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Block lost focus during delete, skipping save');
      return;
    }
    if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Block lost focus, saving:', event.payload.noteId);
    // Save content when block loses focus
    flushPendingSavesRef.current();
  });

  // Process a block: parse hashtags/mentions, update editor, and update DB
  const processNoteBlock = useCallback(async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return null;

    const block = editor.getBlock(noteId);
    if (!block) return null;

    const content = getBlockContent(block);

    const parseContext = {
      labels: labels,
      contacts: contacts
    };
    const parsed = parseHashtags(content, parseContext);

    // 1. Update the block in the editor (clean the title)
    if (parsed.cleanedContent !== content) {
      editor.updateBlock(block, {
        content: [{ type: 'text', text: parsed.cleanedContent }]
      } as any);
    }

    // 2. Determine final category
    const finalCategory = parsed.category || note.category;

    // 3. Update the note in the database via CQRS command
    if (parsed.cleanedContent !== content || finalCategory !== note.category) {
      dispatch(new UpdateNoteCommand({
        noteId: note.id,
        content: parsed.cleanedContent,
        category: finalCategory,
        description: note.description,
      }));
    }

    // 4. Handle labels
    const inheritedLabels = noteLabelsCache.get(note.id) ?? [];
    const labelIds = inheritedLabels.map(l => l.id);

    // Create new labels via CQRS command
    if (parsed.newLabelNames.length > 0) {
      for (const labelName of parsed.newLabelNames) {
        try {
          const newLabel = await createLabel(labelName);
          if (newLabel) {
            labelIds.push(newLabel.id);
            // Use CQRS command to add label to note
            dispatch(new CreateLabelAndAddToNoteCommand({
              noteId: note.id,
              name: labelName,
              color: newLabel.color,
            }));
          }
        } catch (error) {
          console.error('[BlockNoteNoteList] ❌ Error creating label:', error);
        }
      }
    }

    // Add matched labels from hashtags via CQRS commands
    for (const hashtag of parsed.parsedHashtags) {
      if (hashtag.type === 'label' && hashtag.matchedId) {
        dispatch(new AddLabelToNoteCommand({
          noteId: note.id,
          labelId: hashtag.matchedId,
        }));
        if (!labelIds.includes(hashtag.matchedId)) {
          labelIds.push(hashtag.matchedId);
        }
      } else if (hashtag.type === 'contact' && hashtag.matchedId) {
        dispatch(new AddAssigneeToNoteCommand({
          noteId: note.id,
          contactId: hashtag.matchedId,
        }));
      }
    }

    return {
      finalCategory,
      labelIds,
      parsedAssigneeId: parsed.assigneeId,
      parsed
    };
  }, [notes, editor, labels, contacts, noteLabelsCache, createLabel, dispatch]);

  // Listen for delete events from blocks (via event bus)
  useEventSubscription('note:deleted', (event) => {
    // Set flag to prevent sync from replacing blocks during delete
    isDeletingRef.current = true;

    // Clear pending saves to avoid showing "saved" toast when deleting
    pendingChangesRef.current = false;

    // Use CQRS command for delete
    dispatch(new DeleteNoteCommand({
      noteId: event.payload.noteId,
      reason: event.payload.reason,
    }));

    // Reset flag after delete is processed (allow next render cycle to complete)
    setTimeout(() => {
      isDeletingRef.current = false;
    }, 200);
  });

  // Listen for create note events from blocks (Enter key) (via event bus)
  useEventSubscription('editor:createNoteAfter', async (event) => {
    flushPendingSavesRef.current();

    // Find the note we're creating after - could be in props or in our cache
    const afterNote = notes.find(n => n.id === event.payload.afterNoteId);
    const afterNoteFromCache = newlyCreatedNotesRef.current.get(event.payload.afterNoteId);

    // Determine category and deadline from either source
    const category = afterNote?.category || afterNoteFromCache?.category || (event.payload.category as NoteCategory) || 'todo';
    const deadline = afterNote?.deadline || afterNoteFromCache?.deadline || null;

    // Add the new note to our cache so we can save its content later
    newlyCreatedNotesRef.current.set(event.payload.newNoteId, {
      category,
      deadline,
    });
    console.log('[createNoteAfter] Added to cache:', event.payload.newNoteId, 'category:', category);

    if (afterNote) {
      // Process the block the user just finished (parse hashtags, etc.)
      const result = await processNoteBlock(afterNote.id);

      // Use CQRS command for create note after
      await dispatch(new CreateNoteAfterCommand({
        afterNoteId: afterNote.id,
        content: '',
        category: result?.finalCategory || category,
        deadline,
        labelIds: result?.labelIds || [],
        assigneeId: result?.parsedAssigneeId || null,
        newNoteId: event.payload.newNoteId,
        projectId: activeProjectId,
      }));
    } else if (afterNoteFromCache) {
      // The afterNote is a newly created note not yet in props
      // Still create the new note with inherited properties
      await dispatch(new CreateNoteAfterCommand({
        afterNoteId: event.payload.afterNoteId,
        content: '',
        category,
        deadline,
        labelIds: [],
        assigneeId: null,
        newNoteId: event.payload.newNoteId,
        projectId: activeProjectId,
      }));
    }
  });

  // Listen for toggle pin events from blocks (via event bus)
  useEventSubscription('note:pinned', (event) => {
    const noteId = event.payload.noteId;

    // Save current content before toggling pin
    flushPendingSavesRef.current();

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
    // Save current content before toggling sidebar fix
    flushPendingSavesRef.current();

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
          flushPendingSavesRef.current();
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
