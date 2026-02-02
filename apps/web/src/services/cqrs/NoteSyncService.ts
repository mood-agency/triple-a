import type { Note } from '@/types/note';
import type { NoteCommand, CommandResult, CreateNoteResult } from './commands';
import { findNoteDifferences, resolveConflict, type MergeStrategy, type NoteDiff } from './queries';
import { noteEventBus } from '../NoteEventBus';

/**
 * NoteSyncService - Handles bidirectional sync between client and Convex
 *
 * Responsibilities:
 * 1. Process commands (writes) with optimistic updates
 * 2. Track pending commands for offline support
 * 3. Detect and resolve conflicts when remote changes arrive
 * 4. Maintain local state consistency
 */

// Pending command with its optimistic state
interface PendingCommand {
  command: NoteCommand;
  optimisticState: Partial<Note>;
  retryCount: number;
}

// Conflict event for UI notification
export interface ConflictEvent {
  noteId: string;
  diffs: NoteDiff[];
  localTimestamp: number;
  remoteTimestamp: number;
  resolved: boolean;
  resolution?: {
    strategy: MergeStrategy;
    mergedNote: Partial<Note>;
  };
}

type ConflictHandler = (conflict: ConflictEvent) => Promise<MergeStrategy>;

class NoteSyncServiceImpl {
  // Pending commands waiting to be confirmed
  private pendingCommands = new Map<string, PendingCommand>();

  // Local optimistic state (note ID -> local changes)
  private optimisticState = new Map<string, Partial<Note>>();

  // Last known remote state (for conflict detection)
  private remoteState = new Map<string, Note>();

  // Timestamps of local edits
  private localEditTimestamps = new Map<string, number>();

  // Conflict resolution strategy
  private defaultStrategy: MergeStrategy = 'latest-wins';

  // Custom conflict handler (for manual resolution UI)
  private conflictHandler: ConflictHandler | null = null;

  // Debug mode
  private debug = false;

  private log(message: string, data?: unknown) {
    if (this.debug) {
      console.log(`[NoteSyncService] ${message}`, data ?? '');
    }
  }

  /**
   * Set the default conflict resolution strategy
   */
  setDefaultStrategy(strategy: MergeStrategy) {
    this.defaultStrategy = strategy;
  }

  /**
   * Set a custom conflict handler for manual resolution
   */
  setConflictHandler(handler: ConflictHandler | null) {
    this.conflictHandler = handler;
  }

  /**
   * Enable/disable debug logging
   */
  setDebug(enabled: boolean) {
    this.debug = enabled;
  }

  /**
   * Apply optimistic update for a command
   */
  applyOptimisticUpdate(command: NoteCommand): Partial<Note> | null {
    let optimistic: Partial<Note> | null = null;

    switch (command.type) {
      case 'UPDATE_NOTE_CONTENT':
        optimistic = {
          content: command.content,
          category: command.category,
          description: command.description,
        };
        this.optimisticState.set(command.noteId, {
          ...this.optimisticState.get(command.noteId),
          ...optimistic,
        });
        this.localEditTimestamps.set(command.noteId, command.timestamp);
        break;

      case 'TOGGLE_NOTE_COMPLETED':
        optimistic = { completed: command.completed };
        this.optimisticState.set(command.noteId, {
          ...this.optimisticState.get(command.noteId),
          ...optimistic,
        });
        break;

      case 'TOGGLE_NOTE_PIN': {
        const currentPinned = this.optimisticState.get(command.noteId)?.pinned;
        const remotePinned = this.remoteState.get(command.noteId)?.pinned;
        optimistic = { pinned: !(currentPinned ?? remotePinned ?? false) };
        this.optimisticState.set(command.noteId, {
          ...this.optimisticState.get(command.noteId),
          ...optimistic,
        });
        break;
      }
    }

    if (optimistic) {
      this.log('Applied optimistic update', { command: command.type, optimistic });
    }

    return optimistic;
  }

  /**
   * Add a pending command
   */
  addPendingCommand(command: NoteCommand) {
    const optimistic = this.applyOptimisticUpdate(command);
    this.pendingCommands.set(command.correlationId, {
      command,
      optimisticState: optimistic || {},
      retryCount: 0,
    });
    this.log('Added pending command', { correlationId: command.correlationId, type: command.type });
  }

  /**
   * Mark a command as completed (confirmed by server)
   */
  confirmCommand(correlationId: string, result: CommandResult) {
    const pending = this.pendingCommands.get(correlationId);
    if (!pending) {
      this.log('Command not found for confirmation', { correlationId });
      return;
    }

    this.pendingCommands.delete(correlationId);

    if (result.success) {
      this.log('Command confirmed', { correlationId, type: pending.command.type });

      // For create commands, emit the mapping
      if (pending.command.type === 'CREATE_NOTE' && (result as CreateNoteResult).noteId) {
        noteEventBus.emit({
          type: 'NOTE_CREATED',
          tempBlockId: pending.command.tempId,
          noteId: (result as CreateNoteResult).noteId!,
        });
      }
    } else {
      this.log('Command failed', { correlationId, error: result.error });
      // Rollback optimistic update
      this.rollbackOptimisticUpdate(pending);
    }
  }

  /**
   * Rollback an optimistic update
   */
  private rollbackOptimisticUpdate(pending: PendingCommand) {
    const { command } = pending;

    switch (command.type) {
      case 'UPDATE_NOTE_CONTENT':
      case 'TOGGLE_NOTE_COMPLETED':
      case 'TOGGLE_NOTE_PIN':
        // Remove optimistic state, let remote state take over
        if ('noteId' in command) {
          this.optimisticState.delete(command.noteId);
        }
        break;
    }

    this.log('Rolled back optimistic update', { type: command.type });
  }

  /**
   * Handle remote state update from Convex
   * Returns true if there was a conflict that was resolved
   */
  async handleRemoteUpdate(note: Note): Promise<ConflictEvent | null> {
    const _previousRemote = this.remoteState.get(note.id);
    this.remoteState.set(note.id, note);

    // Check for conflicts with local optimistic state
    const localState = this.optimisticState.get(note.id);
    if (!localState) {
      // No local changes, just accept remote
      return null;
    }

    const diffs = findNoteDifferences(localState, note);
    if (diffs.length === 0) {
      // No conflicts, clear optimistic state
      this.optimisticState.delete(note.id);
      return null;
    }

    // There's a conflict
    const localTimestamp = this.localEditTimestamps.get(note.id) || 0;
    const remoteTimestamp = new Date(note.updated_at).getTime();

    this.log('Conflict detected', {
      noteId: note.id,
      diffs,
      localTimestamp,
      remoteTimestamp,
    });

    const conflict: ConflictEvent = {
      noteId: note.id,
      diffs,
      localTimestamp,
      remoteTimestamp,
      resolved: false,
    };

    // Determine resolution strategy
    let strategy = this.defaultStrategy;
    if (this.conflictHandler && strategy === 'manual') {
      strategy = await this.conflictHandler(conflict);
    }

    // Resolve each diff
    const mergedNote: Partial<Note> = {};
    for (const diff of diffs) {
      const resolution = resolveConflict(diff, localTimestamp, remoteTimestamp, strategy);
      (mergedNote as any)[diff.field] = resolution.resolvedValue;
    }

    conflict.resolved = true;
    conflict.resolution = { strategy, mergedNote };

    // Apply resolution
    if (strategy === 'local-wins') {
      // Keep optimistic state, re-emit the command
      this.log('Conflict resolved: local wins', { noteId: note.id });
      noteEventBus.emit({
        type: 'NOTE_CONTENT_CHANGED',
        noteId: note.id,
        content: (mergedNote.content as string) || note.content,
        category: mergedNote.category as any,
        description: mergedNote.description as string | null,
      });
    } else {
      // Accept remote, clear optimistic state
      this.optimisticState.delete(note.id);
      this.localEditTimestamps.delete(note.id);
      this.log('Conflict resolved: remote wins', { noteId: note.id });
    }

    return conflict;
  }

  /**
   * Get the current merged state for a note (remote + optimistic)
   */
  getMergedState(note: Note): Note {
    const optimistic = this.optimisticState.get(note.id);
    if (!optimistic) {
      return note;
    }

    return {
      ...note,
      ...optimistic,
    } as Note;
  }

  /**
   * Check if a note has pending local changes
   */
  hasPendingChanges(noteId: string): boolean {
    return this.optimisticState.has(noteId);
  }

  /**
   * Get all pending commands (for offline queue display)
   */
  getPendingCommands(): NoteCommand[] {
    return Array.from(this.pendingCommands.values()).map(p => p.command);
  }

  /**
   * Clear all state (e.g., on logout)
   */
  clear() {
    this.pendingCommands.clear();
    this.optimisticState.clear();
    this.remoteState.clear();
    this.localEditTimestamps.clear();
    this.log('Cleared all state');
  }
}

// Singleton instance
export const noteSyncService = new NoteSyncServiceImpl();
