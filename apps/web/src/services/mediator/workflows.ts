import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';

/**
 * Workflow Types
 *
 * Each workflow represents a complex multi-step operation.
 * The mediator coordinates the execution of these workflows.
 */

// Base workflow interface
export interface Workflow<TInput, TOutput> {
  type: string;
  input: TInput;
  output?: TOutput;
  status: 'pending' | 'running' | 'completed' | 'failed';
  error?: string;
  startedAt?: number;
  completedAt?: number;
}

// Workflow input/output types

export interface CreateNoteInput {
  afterNoteId: string;
  tempBlockId: string;
  category: NoteCategory;
  deadline?: string | null;
  labelIds?: string[];
  assigneeId?: string | null;
  content?: string;
}

export interface CreateNoteOutput {
  note: Note;
  blockId: string;
}

export interface SaveAndNavigateInput {
  noteId: string;
  content: string;
  destination: 'description' | 'next-note' | 'previous-note';
}

export interface SaveAndNavigateOutput {
  saved: boolean;
  navigated: boolean;
}

export interface ConflictResolutionInput {
  noteId: string;
  localContent: string;
  remoteContent: string;
  localTimestamp: number;
  remoteTimestamp: number;
}

export interface ConflictResolutionOutput {
  strategy: 'local-wins' | 'remote-wins' | 'merged';
  resolvedContent: string;
}

export interface BulkOperationInput {
  noteIds: string[];
  operation: 'complete' | 'delete' | 'pin' | 'add-label' | 'remove-label';
  params?: {
    labelId?: string;
    reason?: string;
  };
}

export interface BulkOperationOutput {
  succeeded: string[];
  failed: Array<{ noteId: string; error: string }>;
}

export interface ParseAndSaveInput {
  noteId: string;
  content: string;
  labels: Label[];
  contacts: Contact[];
}

export interface ParseAndSaveOutput {
  cleanedContent: string;
  detectedCategory?: NoteCategory;
  matchedLabels: string[];
  newLabels: string[];
  matchedContact?: string;
}

// Workflow type definitions
export type CreateNoteWorkflow = Workflow<CreateNoteInput, CreateNoteOutput>;
export type SaveAndNavigateWorkflow = Workflow<SaveAndNavigateInput, SaveAndNavigateOutput>;
export type ConflictResolutionWorkflow = Workflow<ConflictResolutionInput, ConflictResolutionOutput>;
export type BulkOperationWorkflow = Workflow<BulkOperationInput, BulkOperationOutput>;
export type ParseAndSaveWorkflow = Workflow<ParseAndSaveInput, ParseAndSaveOutput>;

// Union of all workflow types
export type NoteWorkflow =
  | CreateNoteWorkflow
  | SaveAndNavigateWorkflow
  | ConflictResolutionWorkflow
  | BulkOperationWorkflow
  | ParseAndSaveWorkflow;

// Workflow events (for progress tracking)
export interface WorkflowEvent {
  workflowId: string;
  type: 'started' | 'step-completed' | 'completed' | 'failed';
  step?: string;
  data?: unknown;
  timestamp: number;
}

// Helper to create workflows
let workflowCounter = 0;
export function createWorkflow<TInput, TOutput>(
  type: string,
  input: TInput
): Workflow<TInput, TOutput> & { id: string } {
  return {
    id: `wf-${Date.now()}-${++workflowCounter}`,
    type,
    input,
    status: 'pending',
  };
}
