/**
 * Mediator Module
 *
 * Implements the Mediator pattern for coordinating complex workflows.
 *
 * The Mediator:
 * - Provides a single point of control for multi-step operations
 * - Decouples components (they only talk to the mediator)
 * - Centralizes business logic and error handling
 * - Supports workflow progress tracking and rollback
 *
 * Usage:
 * ```typescript
 * import { noteMediator } from '@/services/mediator';
 *
 * // Configure dependencies (once, at app startup)
 * noteMediator.configure({
 *   createNote: async (...) => { ... },
 *   updateNote: (...) => { ... },
 *   showToast: (msg) => toast(msg),
 * });
 *
 * // Execute workflows
 * const result = await noteMediator.createNote({
 *   afterNoteId: '123',
 *   tempBlockId: 'temp-456',
 *   category: 'todo',
 * });
 * ```
 */

// Workflows
export {
  type Workflow,
  type WorkflowEvent,
  type CreateNoteInput,
  type CreateNoteOutput,
  type SaveAndNavigateInput,
  type SaveAndNavigateOutput,
  type ConflictResolutionInput,
  type ConflictResolutionOutput,
  type BulkOperationInput,
  type BulkOperationOutput,
  type ParseAndSaveInput,
  type ParseAndSaveOutput,
  type NoteWorkflow,
  createWorkflow,
} from './workflows';

// Mediator
export {
  noteMediator,
  type MediatorDependencies,
} from './NoteMediator';
