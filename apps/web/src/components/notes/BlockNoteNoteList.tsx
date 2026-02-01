import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/shadcn';
import '@blocknote/shadcn/style.css';
import { animate } from 'motion';
import { NotepadBlock } from '@/components/blocknote/NotepadBlock';
import { notesToBlocks, getBlockContent } from '@/utils/noteBlockAdapter';
import { getInitials } from '@/lib/utils';
import type { Note, Label, NoteCategory } from '@/types/note';
import type { Contact } from '@/types/contact';

// Debug flag - set to true to enable console logs for debugging
const DEBUG_BLOCKNOTE = true;

interface BlockNoteNoteListProps {
  notes: Note[];
  noteLabelsCache: Map<string, Label[]>;
  noteAssigneesCache: Map<string, Contact[]>;
  onNavigateToDescription?: () => void;
  onSelectNote?: (noteId: string) => void;
  onToggleCompleted?: (noteId: string, completed: boolean) => void;
  onDelete?: (note: Note, reason: string) => void;
  onCreateNoteAfter?: (afterNoteId: string, category: NoteCategory, deadline?: string | null, labelIds?: string[], assigneeId?: string | null, newNoteId?: string) => Promise<Note>;
  onEdit?: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;
  onTogglePin?: (noteId: string) => void;
  onToggleFixInSidebar?: (noteId: string) => void;
  onSaveSuccess?: (savedCount: number) => void;
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
  onToggleCompleted,
  onDelete,
  onCreateNoteAfter,
  onEdit,
  onTogglePin,
  onToggleFixInSidebar,
  onSaveSuccess,
  compactView = false,
  fixedNoteId = null,
  hideDate = false
}: BlockNoteNoteListProps) => {
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
    const cache = new Map<string, string[]>();
    noteAssigneesCache.forEach((assignees, noteId) => {
      cache.set(noteId, assignees.map(a => getInitials(a.name, a.lastname)));
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
  });

  // Track content changes for auto-save
  const pendingChangesRef = useRef(false);

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
    // Skip if no notes or container
    if (notes.length === 0 || !containerRef.current) {
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

  // Function to flush pending saves immediately
  const flushPendingSaves = useCallback(() => {
    if (!pendingChangesRef.current || !onEdit) {
      return;
    }

    const blocks = editor.document;
    let savedCount = 0;

    // Save each block that has changed
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

    // Notify parent component of successful save (parent handles toast/UI feedback)
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

  // Listen to BlockNote selection changes and sync to parent
  useEffect(() => {
    let previousBlockId: string | undefined;

    const unsubscribe = editor.onSelectionChange(() => {
      const cursor = editor.getTextCursorPosition();
      const blockId = cursor?.block.id;

      if (blockId && onSelectNote) {
        // Log when switching to a different task
        if (previousBlockId && previousBlockId !== blockId) {
          if (DEBUG_BLOCKNOTE) console.log('[BlockNote] Switching from task', previousBlockId, 'to task', blockId);
        }
        previousBlockId = blockId;
        onSelectNote(blockId);
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
          const currentlyFixed = block.props.fixedInSidebar;

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

      if (DEBUG_BLOCKNOTE) {
        console.log('[BlockNote] Sync check:', {
          currentNoteIds: currentNoteIds.substring(0, 100),
          previousSize: previousIds.size,
          currentSize: noteIds.size,
          removedIds: removedIds.length,
          notesWereFiltered,
          isInitialLoad,
          orderChanged,
        });
      }

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

  // Listen for Tab navigation events from blocks
  useEffect(() => {
    const handleNavigateToDescription = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string }>;

      // Save content before navigating away
      flushPendingSavesRef.current();

      // First, select the note that triggered the event
      if (onSelectNote) {
        onSelectNote(customEvent.detail.noteId);
      }

      // Then navigate to the description panel
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
      // Save content before toggling complete
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

  // Listen for lost focus events from blocks to trigger auto-save
  useEffect(() => {
    const handleLostFocus = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string }>;
      // Skip save if we're in the process of deleting
      if (isDeletingRef.current) {
        if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Block lost focus during delete, skipping save');
        return;
      }
      if (DEBUG_BLOCKNOTE) console.log('[BlockNoteNoteList] Block lost focus, saving:', customEvent.detail.noteId);
      // Save content when block loses focus
      flushPendingSavesRef.current();
    };

    window.addEventListener('notepad:lostFocus', handleLostFocus);
    return () => {
      window.removeEventListener('notepad:lostFocus', handleLostFocus);
    };
  }, []);

  // Listen for delete events from blocks
  useEffect(() => {
    const handleDelete = (e: Event) => {
      const customEvent = e as CustomEvent<{ noteId: string; reason: string }>;

      // Set flag to prevent sync from replacing blocks during delete
      isDeletingRef.current = true;

      // Clear pending saves to avoid showing "saved" toast when deleting
      pendingChangesRef.current = false;

      if (onDelete) {
        const note = notes.find(n => n.id === customEvent.detail.noteId);
        if (note) {
          onDelete(note, customEvent.detail.reason);
        }
      }

      // Reset flag after delete is processed (allow next render cycle to complete)
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
        // Save current content before creating new note
        flushPendingSavesRef.current();

        const afterNote = notes.find(n => n.id === customEvent.detail.afterNoteId);
        if (afterNote) {
          // Get labels for the current note to inherit them
          // Use the original noteLabelsCache prop which has full Label objects with IDs
          const labels = noteLabelsCache.get(afterNote.id) ?? [];
          const labelIds = labels.map(l => l.id);

          // Create new note with same category, deadline, and labels as the current note
          // Pass the new block's ID so the database uses it (fixes ID mismatch)
          await onCreateNoteAfter(
            afterNote.id,
            afterNote.category,
            afterNote.deadline,
            labelIds,
            null,  // assigneeId - not used in BlockNote list view
            customEvent.detail.newNoteId
          );

          // Note: BlockNote already inserted the block optimistically in InsertBlockCommand
          // The editor will sync with the new note data on the next render cycle
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

      // Find the note to get current pinned state
      const note = notes.find(n => n.id === noteId);
      if (!note) return;

      const newPinnedState = !note.pinned;

      // Update block's pinned prop
      const block = editor.getBlock(noteId);
      if (block) {
        editor.updateBlock(block, {
          props: { ...block.props, pinned: newPinnedState }
        } as any);
      }

      // Notify parent
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
    <div
      ref={containerRef}
      className={`blocknote-note-list ${isSyncingFilter ? 'blocknote-syncing' : ''} ${compactView && !isAnimatingToCompact ? 'compact-view' : ''} ${isAnimatingToFull ? 'animating-to-full' : ''} ${isAnimatingToCompact ? 'animating-to-compact' : ''}`}
      onFocus={(e) => {
        if (DEBUG_BLOCKNOTE) console.log('[DOM] Editor wrapper gained focus', e.target);
      }}
      onBlur={(e) => {
        if (DEBUG_BLOCKNOTE) console.log('[DOM] Editor wrapper lost focus', e.target, 'relatedTarget:', e.relatedTarget);
        // Only save if focus is leaving the editor entirely (not moving between blocks)
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          if (DEBUG_BLOCKNOTE) console.log('[DOM] Focus left editor entirely, triggering save');
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
