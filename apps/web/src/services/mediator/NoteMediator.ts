import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import { noteEventBus } from '../NoteEventBus';
import { parseHashtags } from '@/utils/hashtagParser';
import {
  createWorkflow,
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
} from './workflows';

/**
 * NoteMediator - Central coordinator for complex workflows
 *
 * The Mediator pattern provides:
 * 1. Single point of control for multi-step operations
 * 2. Decoupling between components (they only talk to the mediator)
 * 3. Centralized business logic and error handling
 * 4. Workflow progress tracking and rollback support
 */

// Mediator dependencies (injected)
export interface MediatorDependencies {
  // Note operations
  createNote: (
    afterNoteId: string,
    category: NoteCategory,
    deadline?: string | null,
    labelIds?: string[],
    assigneeId?: string | null,
    tempId?: string
  ) => Promise<Note>;
  updateNote: (
    noteId: string,
    content: string,
    category?: NoteCategory,
    description?: string | null
  ) => void;
  deleteNote: (noteId: string, reason: string) => void;
  toggleCompleted: (noteId: string, completed: boolean) => void;
  togglePin: (noteId: string) => void;

  // Label operations
  addLabel: (noteId: string, labelId: string) => void;
  removeLabel: (noteId: string, labelId: string) => void;
  createLabel: (name: string) => Promise<Label>;

  // Navigation
  focusDescription: () => void;
  focusNote: (noteId: string) => void;
  selectNote: (noteId: string) => void;

  // UI
  showToast: (message: string, type?: 'success' | 'error' | 'warning') => void;
  showConflictDialog: (input: ConflictResolutionInput) => Promise<'local-wins' | 'remote-wins' | 'merged'>;

  // Data access
  getNotes: () => Note[];
  getLabels: () => Label[];
  getContacts: () => Contact[];
  getSelectedNote: () => Note | null;
}

type WorkflowListener = (event: WorkflowEvent) => void;

class NoteMediatorImpl {
  private dependencies: Partial<MediatorDependencies> = {};
  private activeWorkflows = new Map<string, NoteWorkflow & { id: string }>();
  private listeners = new Set<WorkflowListener>();
  private debug = false;

  private log(message: string, data?: unknown) {
    if (this.debug) {
      console.log(`[NoteMediator] ${message}`, data ?? '');
    }
  }

  private emit(event: WorkflowEvent) {
    this.listeners.forEach(listener => listener(event));
  }

  /**
   * Configure the mediator with dependencies
   */
  configure(deps: Partial<MediatorDependencies>) {
    this.dependencies = { ...this.dependencies, ...deps };
    this.log('Configured with dependencies', Object.keys(deps));
  }

  /**
   * Enable/disable debug logging
   */
  setDebug(enabled: boolean) {
    this.debug = enabled;
  }

  /**
   * Subscribe to workflow events
   */
  subscribe(listener: WorkflowListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Get active workflows
   */
  getActiveWorkflows(): Array<NoteWorkflow & { id: string }> {
    return Array.from(this.activeWorkflows.values());
  }

  // ============================================
  // WORKFLOW: Create Note
  // ============================================
  async createNote(input: CreateNoteInput): Promise<CreateNoteOutput | null> {
    const workflow = createWorkflow<CreateNoteInput, CreateNoteOutput>('CREATE_NOTE', input);
    this.activeWorkflows.set(workflow.id, workflow as any);
    workflow.status = 'running';
    workflow.startedAt = Date.now();

    this.emit({
      workflowId: workflow.id,
      type: 'started',
      timestamp: Date.now(),
    });

    try {
      const { createNote, getNotes, selectNote } = this.dependencies;
      if (!createNote) throw new Error('createNote dependency not configured');

      // Step 1: Flush pending saves
      this.log('Step 1: Flushing pending saves');
      noteEventBus.emit({ type: 'FLUSH_PENDING_SAVES' });
      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'flush-saves',
        timestamp: Date.now(),
      });

      // Step 2: Get the "after" note for inheriting properties
      const notes = getNotes?.() || [];
      const afterNote = notes.find(n => n.id === input.afterNoteId);
      if (!afterNote) {
        throw new Error(`Note ${input.afterNoteId} not found`);
      }
      this.log('Step 2: Found after note', { id: afterNote.id, category: afterNote.category });

      // Step 3: Create the note
      this.log('Step 3: Creating note in database');
      const note = await createNote(
        input.afterNoteId,
        input.category || afterNote.category,
        input.deadline ?? afterNote.deadline,
        input.labelIds || [],
        input.assigneeId || null,
        input.tempBlockId
      );
      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'create-note',
        data: { noteId: note.id },
        timestamp: Date.now(),
      });

      // Step 4: Emit NOTE_CREATED for ID mapping
      this.log('Step 4: Emitting NOTE_CREATED event');
      noteEventBus.emit({
        type: 'NOTE_CREATED',
        tempBlockId: input.tempBlockId,
        noteId: note.id,
      });

      // Step 5: Select the new note
      if (selectNote) {
        this.log('Step 5: Selecting new note');
        selectNote(note.id);
      }

      // Complete workflow
      const output: CreateNoteOutput = { note, blockId: input.tempBlockId };
      workflow.output = output;
      workflow.status = 'completed';
      workflow.completedAt = Date.now();

      this.emit({
        workflowId: workflow.id,
        type: 'completed',
        data: output,
        timestamp: Date.now(),
      });

      this.log('Workflow completed', { noteId: note.id });
      return output;

    } catch (error) {
      workflow.status = 'failed';
      workflow.error = String(error);
      workflow.completedAt = Date.now();

      this.emit({
        workflowId: workflow.id,
        type: 'failed',
        data: { error: String(error) },
        timestamp: Date.now(),
      });

      this.log('Workflow failed', { error });
      this.dependencies.showToast?.(`Failed to create note: ${error}`, 'error');
      return null;

    } finally {
      this.activeWorkflows.delete(workflow.id);
    }
  }

  // ============================================
  // WORKFLOW: Save and Navigate
  // ============================================
  async saveAndNavigate(input: SaveAndNavigateInput): Promise<SaveAndNavigateOutput> {
    const workflow = createWorkflow<SaveAndNavigateInput, SaveAndNavigateOutput>('SAVE_AND_NAVIGATE', input);
    this.activeWorkflows.set(workflow.id, workflow as any);
    workflow.status = 'running';
    workflow.startedAt = Date.now();

    this.emit({
      workflowId: workflow.id,
      type: 'started',
      timestamp: Date.now(),
    });

    try {
      const { updateNote, focusDescription, focusNote, getNotes, getSelectedNote } = this.dependencies;

      // Step 1: Save content
      this.log('Step 1: Saving content');
      if (updateNote && input.content) {
        const selectedNote = getSelectedNote?.();
        if (selectedNote) {
          updateNote(input.noteId, input.content, selectedNote.category, selectedNote.description);
        }
      }
      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'save',
        timestamp: Date.now(),
      });

      // Step 2: Navigate
      this.log('Step 2: Navigating to', input.destination);
      let navigated = false;

      switch (input.destination) {
        case 'description':
          if (focusDescription) {
            focusDescription();
            navigated = true;
          }
          break;

        case 'next-note':
        case 'previous-note': {
          const notes = getNotes?.() || [];
          const currentIndex = notes.findIndex(n => n.id === input.noteId);
          const nextIndex = input.destination === 'next-note'
            ? Math.min(currentIndex + 1, notes.length - 1)
            : Math.max(currentIndex - 1, 0);

          if (notes[nextIndex] && focusNote) {
            focusNote(notes[nextIndex].id);
            navigated = true;
          }
          break;
        }
      }

      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'navigate',
        data: { navigated },
        timestamp: Date.now(),
      });

      // Complete
      const output: SaveAndNavigateOutput = { saved: true, navigated };
      workflow.output = output;
      workflow.status = 'completed';
      workflow.completedAt = Date.now();

      this.emit({
        workflowId: workflow.id,
        type: 'completed',
        data: output,
        timestamp: Date.now(),
      });

      return output;

    } catch (error) {
      workflow.status = 'failed';
      workflow.error = String(error);
      this.emit({
        workflowId: workflow.id,
        type: 'failed',
        data: { error: String(error) },
        timestamp: Date.now(),
      });
      return { saved: false, navigated: false };

    } finally {
      this.activeWorkflows.delete(workflow.id);
    }
  }

  // ============================================
  // WORKFLOW: Conflict Resolution
  // ============================================
  async resolveConflict(input: ConflictResolutionInput): Promise<ConflictResolutionOutput> {
    const workflow = createWorkflow<ConflictResolutionInput, ConflictResolutionOutput>('CONFLICT_RESOLUTION', input);
    this.activeWorkflows.set(workflow.id, workflow as any);
    workflow.status = 'running';
    workflow.startedAt = Date.now();

    this.emit({
      workflowId: workflow.id,
      type: 'started',
      timestamp: Date.now(),
    });

    try {
      const { showConflictDialog, updateNote, showToast } = this.dependencies;

      // Step 1: Determine resolution strategy
      this.log('Step 1: Getting resolution strategy');
      let strategy: 'local-wins' | 'remote-wins' | 'merged' = 'remote-wins';

      if (showConflictDialog) {
        strategy = await showConflictDialog(input);
      } else {
        // Default: latest wins
        strategy = input.localTimestamp > input.remoteTimestamp ? 'local-wins' : 'remote-wins';
      }

      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'determine-strategy',
        data: { strategy },
        timestamp: Date.now(),
      });

      // Step 2: Apply resolution
      this.log('Step 2: Applying resolution', { strategy });
      let resolvedContent: string;

      switch (strategy) {
        case 'local-wins':
          resolvedContent = input.localContent;
          if (updateNote) {
            updateNote(input.noteId, input.localContent);
          }
          break;

        case 'remote-wins':
          resolvedContent = input.remoteContent;
          // Remote is already in sync, just clear local state
          break;

        case 'merged':
          // Simple merge: append local changes to remote
          resolvedContent = input.remoteContent + '\n---\n' + input.localContent;
          if (updateNote) {
            updateNote(input.noteId, resolvedContent);
          }
          break;
      }

      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'apply-resolution',
        timestamp: Date.now(),
      });

      // Step 3: Notify user
      showToast?.(`Conflict resolved: ${strategy}`, 'success');

      // Complete
      const output: ConflictResolutionOutput = { strategy, resolvedContent };
      workflow.output = output;
      workflow.status = 'completed';
      workflow.completedAt = Date.now();

      this.emit({
        workflowId: workflow.id,
        type: 'completed',
        data: output,
        timestamp: Date.now(),
      });

      return output;

    } catch (error) {
      workflow.status = 'failed';
      workflow.error = String(error);
      this.emit({
        workflowId: workflow.id,
        type: 'failed',
        data: { error: String(error) },
        timestamp: Date.now(),
      });
      return { strategy: 'remote-wins', resolvedContent: input.remoteContent };

    } finally {
      this.activeWorkflows.delete(workflow.id);
    }
  }

  // ============================================
  // WORKFLOW: Bulk Operation
  // ============================================
  async bulkOperation(input: BulkOperationInput): Promise<BulkOperationOutput> {
    const workflow = createWorkflow<BulkOperationInput, BulkOperationOutput>('BULK_OPERATION', input);
    this.activeWorkflows.set(workflow.id, workflow as any);
    workflow.status = 'running';
    workflow.startedAt = Date.now();

    this.emit({
      workflowId: workflow.id,
      type: 'started',
      data: { count: input.noteIds.length, operation: input.operation },
      timestamp: Date.now(),
    });

    const succeeded: string[] = [];
    const failed: Array<{ noteId: string; error: string }> = [];

    try {
      const { toggleCompleted, deleteNote, togglePin, addLabel, removeLabel, showToast } = this.dependencies;

      for (const noteId of input.noteIds) {
        try {
          switch (input.operation) {
            case 'complete':
              if (toggleCompleted) toggleCompleted(noteId, true);
              break;
            case 'delete':
              if (deleteNote) deleteNote(noteId, input.params?.reason || 'Bulk delete');
              break;
            case 'pin':
              if (togglePin) togglePin(noteId);
              break;
            case 'add-label':
              if (addLabel && input.params?.labelId) addLabel(noteId, input.params.labelId);
              break;
            case 'remove-label':
              if (removeLabel && input.params?.labelId) removeLabel(noteId, input.params.labelId);
              break;
          }
          succeeded.push(noteId);
        } catch (error) {
          failed.push({ noteId, error: String(error) });
        }
      }

      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'process-all',
        data: { succeeded: succeeded.length, failed: failed.length },
        timestamp: Date.now(),
      });

      // Show summary toast
      if (succeeded.length > 0) {
        showToast?.(`${input.operation}: ${succeeded.length} notes updated`, 'success');
      }
      if (failed.length > 0) {
        showToast?.(`${failed.length} notes failed`, 'error');
      }

      // Complete
      const output: BulkOperationOutput = { succeeded, failed };
      workflow.output = output;
      workflow.status = 'completed';
      workflow.completedAt = Date.now();

      this.emit({
        workflowId: workflow.id,
        type: 'completed',
        data: output,
        timestamp: Date.now(),
      });

      return output;

    } catch (error) {
      workflow.status = 'failed';
      workflow.error = String(error);
      this.emit({
        workflowId: workflow.id,
        type: 'failed',
        data: { error: String(error) },
        timestamp: Date.now(),
      });
      return { succeeded, failed };

    } finally {
      this.activeWorkflows.delete(workflow.id);
    }
  }

  // ============================================
  // WORKFLOW: Parse and Save (hashtag parsing)
  // ============================================
  async parseAndSave(input: ParseAndSaveInput): Promise<ParseAndSaveOutput> {
    const workflow = createWorkflow<ParseAndSaveInput, ParseAndSaveOutput>('PARSE_AND_SAVE', input);
    this.activeWorkflows.set(workflow.id, workflow as any);
    workflow.status = 'running';
    workflow.startedAt = Date.now();

    this.emit({
      workflowId: workflow.id,
      type: 'started',
      timestamp: Date.now(),
    });

    try {
      const { updateNote, addLabel, createLabel, getNotes } = this.dependencies;

      // Step 1: Parse hashtags and mentions
      this.log('Step 1: Parsing content');
      const parsed = parseHashtags(input.content, {
        labels: input.labels,
        contacts: input.contacts,
      });

      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'parse',
        data: {
          cleanedContent: parsed.cleanedContent,
          hashtagCount: parsed.parsedHashtags.length,
        },
        timestamp: Date.now(),
      });

      // Step 2: Create new labels
      this.log('Step 2: Creating new labels', parsed.newLabelNames);
      const newLabelIds: string[] = [];
      if (createLabel && addLabel) {
        for (const labelName of parsed.newLabelNames) {
          try {
            const newLabel = await createLabel(labelName);
            if (newLabel) {
              newLabelIds.push(newLabel.id);
              addLabel(input.noteId, newLabel.id);
            }
          } catch (error) {
            this.log('Failed to create label', { labelName, error });
          }
        }
      }

      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'create-labels',
        data: { created: newLabelIds.length },
        timestamp: Date.now(),
      });

      // Step 3: Add matched labels
      this.log('Step 3: Adding matched labels');
      const matchedLabelIds: string[] = [];
      if (addLabel) {
        for (const hashtag of parsed.parsedHashtags) {
          if (hashtag.type === 'label' && hashtag.matchedId) {
            addLabel(input.noteId, hashtag.matchedId);
            matchedLabelIds.push(hashtag.matchedId);
          }
        }
      }

      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'add-labels',
        data: { added: matchedLabelIds.length },
        timestamp: Date.now(),
      });

      // Step 4: Update note with cleaned content
      this.log('Step 4: Updating note');
      const note = getNotes?.().find(n => n.id === input.noteId);
      if (updateNote && note && parsed.cleanedContent !== input.content) {
        updateNote(
          input.noteId,
          parsed.cleanedContent,
          parsed.category || note.category,
          note.description
        );
      }

      this.emit({
        workflowId: workflow.id,
        type: 'step-completed',
        step: 'update-note',
        timestamp: Date.now(),
      });

      // Complete
      const output: ParseAndSaveOutput = {
        cleanedContent: parsed.cleanedContent,
        detectedCategory: parsed.category,
        matchedLabels: matchedLabelIds,
        newLabels: newLabelIds,
        matchedContact: parsed.assigneeId || undefined,
      };
      workflow.output = output;
      workflow.status = 'completed';
      workflow.completedAt = Date.now();

      this.emit({
        workflowId: workflow.id,
        type: 'completed',
        data: output,
        timestamp: Date.now(),
      });

      return output;

    } catch (error) {
      workflow.status = 'failed';
      workflow.error = String(error);
      this.emit({
        workflowId: workflow.id,
        type: 'failed',
        data: { error: String(error) },
        timestamp: Date.now(),
      });
      return {
        cleanedContent: input.content,
        matchedLabels: [],
        newLabels: [],
      };

    } finally {
      this.activeWorkflows.delete(workflow.id);
    }
  }
}

// Singleton instance
export const noteMediator = new NoteMediatorImpl();
