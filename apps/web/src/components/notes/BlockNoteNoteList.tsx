import { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { BlockNoteView } from '@blocknote/shadcn';
import '@blocknote/shadcn/style.css';
import { NotepadBlock } from '@/components/blocknote/NotepadBlock';
import { notesToBlocks, getBlockContent } from '@/utils/noteBlockAdapter';
import { getInitials } from '@/lib/utils';
import type { Note, Label, NoteCategory } from '@/types/note';
import type { Contact } from '@/types/contact';

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
  fixedNoteId = null
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
    () => notesToBlocks(notes, labelDataCache, assigneeDataCache, compactView, fixedNoteId),
    [notes, labelDataCache, assigneeDataCache, compactView, fixedNoteId]
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

  // Listen to BlockNote selection changes and sync to parent
  useEffect(() => {
    const unsubscribe = editor.onSelectionChange(() => {
      const cursor = editor.getTextCursorPosition();
      const blockId = cursor?.block.id;

      if (blockId && onSelectNote) {
        onSelectNote(blockId);
      }
    });

    return () => unsubscribe();
  }, [editor, onSelectNote]);

  // Update all blocks when compact view changes
  useEffect(() => {
    isSyncingRef.current = true;

    editor.document.forEach(block => {
      if (block.type === 'notepad') {
        editor.updateBlock(block, {
          props: { ...block.props, compact: compactView }
        } as any);
      }
    });

    setTimeout(() => {
      isSyncingRef.current = false;
    }, 100);
  }, [editor, compactView]);

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

  // Sync notes changes (for filtering) - only when the VIEW changes due to filtering
  // Don't sync when notes are added/edited (BlockNote handles this internally)
  useEffect(() => {
    // Create a sorted string of note IDs to detect changes
    const currentNoteIds = notes.map(n => n.id).sort().join(',');

    // Only update if the set of note IDs actually changed
    if (previousNoteIdsRef.current !== currentNoteIds) {
      const previousIds = new Set(previousNoteIdsRef.current ? previousNoteIdsRef.current.split(',').filter(Boolean) : []);
      previousNoteIdsRef.current = currentNoteIds;

      const noteIds = new Set(notes.map(note => note.id));

      // Check if a note that WAS in the previous set is no longer in the current set
      // This means filtering removed some notes from view
      const notesWereFiltered = [...previousIds].some(id => !noteIds.has(id));

      // Also sync if this is initial load (no previous IDs) and we have notes
      const isInitialLoad = previousIds.size === 0 && notes.length > 0;

      // Only sync on actual filtering (notes removed from view), not on note creation or deletion
      // Skip sync if we're in the middle of a delete operation (editor already handled it)
      if ((notesWereFiltered || isInitialLoad) && !isDeletingRef.current) {
        // Hide content immediately to prevent flash of unfiltered content
        if (notesWereFiltered) {
          setIsSyncingFilter(true);
        }

        // Use setTimeout to avoid flushSync issues during React render
        setTimeout(() => {
          // Set syncing flag to prevent onChange from triggering saves
          isSyncingRef.current = true;

          // Replace entire document when filtering changes
          const newContent = notesToBlocks(notes, labelDataCache, assigneeDataCache);
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
  }, [editor, notes, labelDataCache, assigneeDataCache]);

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
    <div className={`blocknote-note-list ${isSyncingFilter ? 'blocknote-syncing' : ''}`}>
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
