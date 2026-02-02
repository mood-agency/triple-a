import { useEffect, useRef, useCallback } from 'react';
import { noteEventBus, type NoteEvent } from '@/services/NoteEventBus';
import { createCommand, noteSyncService, type ConflictEvent } from '@/services/cqrs';
import type { Note, NoteCategory } from '@/types/note';

/**
 * Configuration for the note persistence service
 */
export interface NotePersistenceConfig {
  /** Notes array from Convex query (real-time updates) */
  notes: Note[];

  /** Edit a note's content */
  onEdit?: (id: string, content: string, category?: NoteCategory, description?: string | null) => void;

  /** Create a new note after another */
  onCreateNoteAfter?: (
    afterNoteId: string,
    category: NoteCategory,
    deadline?: string | null,
    labelIds?: string[],
    assigneeId?: string | null,
    newNoteId?: string
  ) => Promise<Note>;

  /** Delete a note */
  onDelete?: (note: Note, reason: string) => void;

  /** Toggle completed status */
  onToggleCompleted?: (noteId: string, completed: boolean) => void;

  /** Toggle pin status */
  onTogglePin?: (noteId: string) => void;

  /** Toggle fix in sidebar */
  onToggleFixInSidebar?: (noteId: string) => void;

  /** Add a label to a note */
  onAddLabel?: (noteId: string, labelId: string) => void;

  /** Create a new label and add to note */
  onCreateLabelAndAdd?: (noteId: string, labelName: string) => void;

  /** Add an assignee to a note */
  onAddAssignee?: (noteId: string, contactId: string) => void;

  /** Called when a note is selected */
  onSelectNote?: (noteId: string) => void;

  /** Called when navigating to description */
  onNavigateToDescription?: () => void;

  /** Called after successful save */
  onSaveSuccess?: (savedCount: number) => void;

  /** Called when a conflict is detected */
  onConflict?: (conflict: ConflictEvent) => void;

  /** Debug mode */
  debug?: boolean;
}

/**
 * useNotePersistence - CQRS-based persistence hook
 *
 * This hook:
 * 1. Subscribes to NoteEventBus for user actions (commands)
 * 2. Applies optimistic updates via NoteSyncService
 * 3. Executes Convex mutations
 * 4. Detects and resolves conflicts when remote changes arrive
 */
export function useNotePersistence(config: NotePersistenceConfig) {
  const configRef = useRef(config);
  configRef.current = config;

  // Track previous notes for change detection
  const previousNotesRef = useRef<Map<string, Note>>(new Map());

  // Map to track pending block IDs and their created note IDs
  const pendingBlocksRef = useRef<Set<string>>(new Set());
  const blockToNoteIdRef = useRef<Map<string, string>>(new Map());

  // Track pending content changes for batched saves
  const pendingChangesRef = useRef<Map<string, { content: string; category?: NoteCategory; description?: string | null }>>(new Map());

  const log = useCallback((message: string, data?: unknown) => {
    if (configRef.current.debug) {
      console.log(`[NotePersistence] ${message}`, data ?? '');
    }
  }, []);

  // Handle remote updates from Convex (detect changes and conflicts)
  useEffect(() => {
    const { notes, onConflict } = configRef.current;

    // Build current notes map
    const currentNotesMap = new Map<string, Note>();
    for (const note of notes) {
      currentNotesMap.set(note.id, note);
    }

    // Check each note for changes
    for (const note of notes) {
      const previousNote = previousNotesRef.current.get(note.id);

      if (!previousNote) {
        // New note from remote - no conflict possible
        continue;
      }

      // Check if remote note changed
      if (previousNote.updated_at !== note.updated_at) {
        // Remote update detected - check for conflicts
        noteSyncService.handleRemoteUpdate(note).then((conflict) => {
          if (conflict && onConflict) {
            onConflict(conflict);
          }
        });
      }
    }

    // Update previous notes reference
    previousNotesRef.current = currentNotesMap;
  }, [config.notes]);

  // Flush pending saves
  const flushPendingSaves = useCallback(() => {
    const { notes, onEdit, onSaveSuccess } = configRef.current;
    const changes = pendingChangesRef.current;

    if (changes.size === 0) {
      log('No pending changes to flush');
      return;
    }

    let savedCount = 0;

    changes.forEach((change, blockId) => {
      // Skip pending blocks (not yet created in DB)
      if (pendingBlocksRef.current.has(blockId)) {
        log('Skipping pending block', blockId);
        return;
      }

      // Get the actual note ID (may be different from block ID for new notes)
      const noteId = blockToNoteIdRef.current.get(blockId) || blockId;
      const note = notes.find(n => n.id === noteId);

      if (!note) {
        log('Note not found, skipping', { blockId, noteId });
        return;
      }

      // Only save if content actually changed
      if (change.content !== note.content && onEdit) {
        // Create command for CQRS tracking
        const cmd = createCommand({
          type: 'UPDATE_NOTE_CONTENT',
          noteId,
          content: change.content,
          category: change.category || note.category,
          description: change.description ?? note.description,
        });

        // Apply optimistic update
        noteSyncService.addPendingCommand(cmd);

        log('Saving note', { noteId, content: change.content, correlationId: cmd.correlationId });
        onEdit(noteId, change.content, change.category || note.category, change.description ?? note.description);

        // Confirm command (in real app, this would be after mutation succeeds)
        noteSyncService.confirmCommand(cmd.correlationId, {
          success: true,
          correlationId: cmd.correlationId,
        });

        savedCount++;
      }
    });

    // Clear pending changes
    pendingChangesRef.current.clear();

    if (savedCount > 0 && onSaveSuccess) {
      onSaveSuccess(savedCount);
    }

    log('Flushed saves', { savedCount });
  }, [log]);

  // Handle events from the event bus
  useEffect(() => {
    const handleEvent = async (event: NoteEvent) => {
      const config = configRef.current;

      switch (event.type) {
        case 'NOTE_CONTENT_CHANGED': {
          // Buffer the change for later flush
          pendingChangesRef.current.set(event.noteId, {
            content: event.content,
            category: event.category,
            description: event.description,
          });
          log('Content change buffered', { noteId: event.noteId });
          break;
        }

        case 'BLOCK_MARKED_PENDING': {
          pendingBlocksRef.current.add(event.blockId);
          log('Block marked as pending', event.blockId);
          break;
        }

        case 'NOTE_CREATE_REQUESTED': {
          if (!config.onCreateNoteAfter) break;

          // Create command
          const cmd = createCommand({
            type: 'CREATE_NOTE',
            tempId: event.tempBlockId,
            afterNoteId: event.afterNoteId,
            category: event.category,
            deadline: event.deadline,
            labelIds: event.labelIds,
            assigneeId: event.assigneeId,
          });

          // Mark as pending
          pendingBlocksRef.current.add(event.tempBlockId);
          noteSyncService.addPendingCommand(cmd);

          // Flush existing changes first
          flushPendingSaves();

          const afterNote = config.notes.find(n => n.id === event.afterNoteId);
          if (!afterNote) {
            log('After note not found', event.afterNoteId);
            pendingBlocksRef.current.delete(event.tempBlockId);
            noteSyncService.confirmCommand(cmd.correlationId, {
              success: false,
              correlationId: cmd.correlationId,
              error: 'After note not found',
            });
            break;
          }

          try {
            const createdNote = await config.onCreateNoteAfter(
              event.afterNoteId,
              event.category,
              event.deadline,
              event.labelIds,
              event.assigneeId,
              event.tempBlockId
            );

            if (createdNote) {
              // Store mapping and remove from pending
              blockToNoteIdRef.current.set(event.tempBlockId, createdNote.id);
              pendingBlocksRef.current.delete(event.tempBlockId);

              // Confirm command
              noteSyncService.confirmCommand(cmd.correlationId, {
                success: true,
                correlationId: cmd.correlationId,
                noteId: createdNote.id,
              });

              log('Note created', { tempBlockId: event.tempBlockId, noteId: createdNote.id });
            }
          } catch (error) {
            log('Error creating note', error);
            pendingBlocksRef.current.delete(event.tempBlockId);
            noteSyncService.confirmCommand(cmd.correlationId, {
              success: false,
              correlationId: cmd.correlationId,
              error: String(error),
            });
          }
          break;
        }

        case 'NOTE_DELETE_REQUESTED': {
          if (!config.onDelete) break;

          const cmd = createCommand({
            type: 'DELETE_NOTE',
            noteId: event.noteId,
            reason: event.reason,
          });

          noteSyncService.addPendingCommand(cmd);

          const note = config.notes.find(n => n.id === event.noteId);
          if (note) {
            // Clear any pending changes for this note
            pendingChangesRef.current.delete(event.noteId);
            config.onDelete(note, event.reason);

            noteSyncService.confirmCommand(cmd.correlationId, {
              success: true,
              correlationId: cmd.correlationId,
            });
            log('Note deleted', event.noteId);
          }
          break;
        }

        case 'NOTE_COMPLETED_TOGGLED': {
          if (!config.onToggleCompleted) break;

          const cmd = createCommand({
            type: 'TOGGLE_NOTE_COMPLETED',
            noteId: event.noteId,
            completed: event.completed,
          });

          noteSyncService.addPendingCommand(cmd);
          flushPendingSaves();
          config.onToggleCompleted(event.noteId, event.completed);

          noteSyncService.confirmCommand(cmd.correlationId, {
            success: true,
            correlationId: cmd.correlationId,
          });
          log('Completion toggled', { noteId: event.noteId, completed: event.completed });
          break;
        }

        case 'NOTE_PIN_TOGGLED': {
          if (!config.onTogglePin) break;

          const cmd = createCommand({
            type: 'TOGGLE_NOTE_PIN',
            noteId: event.noteId,
          });

          noteSyncService.addPendingCommand(cmd);
          flushPendingSaves();
          config.onTogglePin(event.noteId);

          noteSyncService.confirmCommand(cmd.correlationId, {
            success: true,
            correlationId: cmd.correlationId,
          });
          log('Pin toggled', event.noteId);
          break;
        }

        case 'NOTE_FIX_IN_SIDEBAR_TOGGLED': {
          if (!config.onToggleFixInSidebar) break;

          const cmd = createCommand({
            type: 'TOGGLE_NOTE_FIX_IN_SIDEBAR',
            noteId: event.noteId,
          });

          noteSyncService.addPendingCommand(cmd);
          flushPendingSaves();
          config.onToggleFixInSidebar(event.noteId);

          noteSyncService.confirmCommand(cmd.correlationId, {
            success: true,
            correlationId: cmd.correlationId,
          });
          log('Fix in sidebar toggled', event.noteId);
          break;
        }

        case 'NOTE_LABEL_ADDED': {
          const cmd = createCommand({
            type: 'ADD_LABEL_TO_NOTE',
            noteId: event.noteId,
            labelId: event.labelId,
          });

          noteSyncService.addPendingCommand(cmd);
          config.onAddLabel?.(event.noteId, event.labelId);

          noteSyncService.confirmCommand(cmd.correlationId, {
            success: true,
            correlationId: cmd.correlationId,
          });
          log('Label added', { noteId: event.noteId, labelId: event.labelId });
          break;
        }

        case 'NOTE_LABEL_CREATED_AND_ADDED': {
          const cmd = createCommand({
            type: 'CREATE_AND_ADD_LABEL',
            noteId: event.noteId,
            labelName: event.labelName,
          });

          noteSyncService.addPendingCommand(cmd);
          config.onCreateLabelAndAdd?.(event.noteId, event.labelName);

          noteSyncService.confirmCommand(cmd.correlationId, {
            success: true,
            correlationId: cmd.correlationId,
          });
          log('Label created and added', { noteId: event.noteId, labelName: event.labelName });
          break;
        }

        case 'NOTE_ASSIGNEE_ADDED': {
          const cmd = createCommand({
            type: 'ADD_ASSIGNEE_TO_NOTE',
            noteId: event.noteId,
            contactId: event.contactId,
          });

          noteSyncService.addPendingCommand(cmd);
          config.onAddAssignee?.(event.noteId, event.contactId);

          noteSyncService.confirmCommand(cmd.correlationId, {
            success: true,
            correlationId: cmd.correlationId,
          });
          log('Assignee added', { noteId: event.noteId, contactId: event.contactId });
          break;
        }

        case 'NOTE_SELECTED': {
          // Get the actual note ID (may be different from block ID)
          const noteId = blockToNoteIdRef.current.get(event.noteId) || event.noteId;

          // Skip if this is a pending block
          if (pendingBlocksRef.current.has(event.noteId)) {
            log('Skipping selection for pending block', event.noteId);
            break;
          }

          config.onSelectNote?.(noteId);
          log('Note selected', noteId);
          break;
        }

        case 'NAVIGATE_TO_DESCRIPTION': {
          flushPendingSaves();
          config.onNavigateToDescription?.();
          log('Navigating to description', event.noteId);
          break;
        }

        case 'FLUSH_PENDING_SAVES': {
          flushPendingSaves();
          break;
        }
      }
    };

    // Subscribe to all events
    const unsubscribe = noteEventBus.onAll(handleEvent);

    return () => {
      unsubscribe();
      // Flush any remaining changes on unmount
      flushPendingSaves();
    };
  }, [flushPendingSaves, log]);

  // Return utilities for the component
  return {
    /** Manually flush pending saves */
    flushPendingSaves,
    /** Check if a block is pending */
    isBlockPending: (blockId: string) => pendingBlocksRef.current.has(blockId),
    /** Get the note ID for a block ID */
    getNoteIdForBlock: (blockId: string) => blockToNoteIdRef.current.get(blockId) || blockId,
    /** Check if a note has pending local changes */
    hasPendingChanges: (noteId: string) => noteSyncService.hasPendingChanges(noteId),
    /** Get all pending commands */
    getPendingCommands: () => noteSyncService.getPendingCommands(),
  };
}
