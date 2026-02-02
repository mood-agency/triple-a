/**
 * CQRS Module
 *
 * Implements Command Query Responsibility Segregation pattern for note operations.
 *
 * Architecture:
 * - Commands: Represent intentions to change state (write operations)
 * - Queries: Transform and select data for display (read operations)
 * - NoteSyncService: Handles bidirectional sync with conflict resolution
 *
 * Usage:
 * ```typescript
 * import { createCommand, noteSyncService, toNoteViewModel } from '@/services/cqrs';
 *
 * // Create a command
 * const cmd = createCommand({
 *   type: 'UPDATE_NOTE_CONTENT',
 *   noteId: '123',
 *   content: 'New content',
 * });
 *
 * // Apply optimistic update
 * noteSyncService.addPendingCommand(cmd);
 *
 * // Execute the actual mutation
 * await updateNoteMutation(cmd);
 *
 * // Confirm when done
 * noteSyncService.confirmCommand(cmd.correlationId, { success: true, correlationId: cmd.correlationId });
 * ```
 */

// Commands
export {
  type Command,
  type NoteCommand,
  type UpdateNoteContentCommand,
  type CreateNoteCommand,
  type DeleteNoteCommand,
  type ToggleNoteCompletedCommand,
  type ToggleNotePinCommand,
  type ToggleNoteFixInSidebarCommand,
  type AddLabelToNoteCommand,
  type CreateAndAddLabelCommand,
  type AddAssigneeToNoteCommand,
  type CommandResult,
  type CreateNoteResult,
  createCommand,
} from './commands';

// Queries
export {
  type QueryResult,
  type NoteViewModel,
  type NoteDiff,
  type MergeStrategy,
  type ConflictResolution,
  hasTimeComponent,
  isNoteOverdue,
  toNoteViewModel,
  filterByCategory,
  filterActiveNotes,
  filterCompletedNotes,
  sortNotesByPinnedAndOrder,
  findNoteDifferences,
  resolveConflict,
} from './queries';

// Sync Service
export {
  noteSyncService,
  type ConflictEvent,
} from './NoteSyncService';
