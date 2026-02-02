import { useEffect, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { noteMediator, type MediatorDependencies, type WorkflowEvent } from '@/services/mediator';
import type { Note, NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';

/**
 * Configuration for the note mediator hook
 */
export interface UseNoteMediatorConfig {
  // Data
  notes: Note[];
  labels: Label[];
  contacts: Contact[];
  selectedNote: Note | null;

  // Note operations
  onCreateNoteAfter?: (
    afterNoteId: string,
    category: NoteCategory,
    deadline?: string | null,
    labelIds?: string[],
    assigneeId?: string | null,
    tempId?: string
  ) => Promise<Note>;
  onEdit?: (
    noteId: string,
    content: string,
    category?: NoteCategory,
    description?: string | null
  ) => void;
  onDelete?: (noteId: string, reason: string) => void;
  onToggleCompleted?: (noteId: string, completed: boolean) => void;
  onTogglePin?: (noteId: string) => void;

  // Label operations
  onAddLabel?: (noteId: string, labelId: string) => void;
  onRemoveLabel?: (noteId: string, labelId: string) => void;
  onCreateLabel?: (name: string) => Promise<Label>;

  // Navigation
  onFocusDescription?: () => void;
  onFocusNote?: (noteId: string) => void;
  onSelectNote?: (noteId: string) => void;

  // Debug mode
  debug?: boolean;
}

/**
 * useNoteMediator - Hook to use the NoteMediator in React components
 *
 * This hook:
 * 1. Configures the mediator with component dependencies
 * 2. Provides workflow execution methods
 * 3. Tracks active workflows for UI feedback
 */
export function useNoteMediator(config: UseNoteMediatorConfig) {
  const { t: _t } = useTranslation();
  const [activeWorkflows, setActiveWorkflows] = useState<WorkflowEvent[]>([]);

  // Configure mediator with dependencies
  useEffect(() => {
    const deps: MediatorDependencies = {
      // Note operations
      createNote: config.onCreateNoteAfter
        ? async (afterNoteId, category, deadline, labelIds, assigneeId, tempId) => {
            return config.onCreateNoteAfter!(afterNoteId, category, deadline, labelIds, assigneeId, tempId);
          }
        : undefined,
      updateNote: config.onEdit,
      deleteNote: config.onDelete,
      toggleCompleted: config.onToggleCompleted,
      togglePin: config.onTogglePin,

      // Label operations
      addLabel: config.onAddLabel,
      removeLabel: config.onRemoveLabel,
      createLabel: config.onCreateLabel,

      // Navigation
      focusDescription: config.onFocusDescription,
      focusNote: config.onFocusNote,
      selectNote: config.onSelectNote,

      // UI
      showToast: (message, type = 'success') => {
        switch (type) {
          case 'success':
            toast.success(message);
            break;
          case 'error':
            toast.error(message);
            break;
          case 'warning':
            toast.warning(message);
            break;
        }
      },
      showConflictDialog: async (input) => {
        // Default: latest wins
        // In a real implementation, this would show a dialog
        return input.localTimestamp > input.remoteTimestamp ? 'local-wins' : 'remote-wins';
      },

      // Data access
      getNotes: () => config.notes,
      getLabels: () => config.labels,
      getContacts: () => config.contacts,
      getSelectedNote: () => config.selectedNote,
    };

    noteMediator.configure(deps);
    noteMediator.setDebug(config.debug ?? false);
  }, [
    config.notes,
    config.labels,
    config.contacts,
    config.selectedNote,
    config.onCreateNoteAfter,
    config.onEdit,
    config.onDelete,
    config.onToggleCompleted,
    config.onTogglePin,
    config.onAddLabel,
    config.onRemoveLabel,
    config.onCreateLabel,
    config.onFocusDescription,
    config.onFocusNote,
    config.onSelectNote,
    config.debug,
  ]);

  // Subscribe to workflow events
  useEffect(() => {
    const unsubscribe = noteMediator.subscribe((event) => {
      setActiveWorkflows((prev) => {
        if (event.type === 'started') {
          return [...prev, event];
        } else if (event.type === 'completed' || event.type === 'failed') {
          return prev.filter((e) => e.workflowId !== event.workflowId);
        }
        return prev;
      });
    });

    return () => unsubscribe();
  }, []);

  // Workflow execution methods
  const createNote = useCallback(
    async (input: Parameters<typeof noteMediator.createNote>[0]) => {
      return noteMediator.createNote(input);
    },
    []
  );

  const saveAndNavigate = useCallback(
    async (input: Parameters<typeof noteMediator.saveAndNavigate>[0]) => {
      return noteMediator.saveAndNavigate(input);
    },
    []
  );

  const resolveConflict = useCallback(
    async (input: Parameters<typeof noteMediator.resolveConflict>[0]) => {
      return noteMediator.resolveConflict(input);
    },
    []
  );

  const bulkOperation = useCallback(
    async (input: Parameters<typeof noteMediator.bulkOperation>[0]) => {
      return noteMediator.bulkOperation(input);
    },
    []
  );

  const parseAndSave = useCallback(
    async (input: Parameters<typeof noteMediator.parseAndSave>[0]) => {
      return noteMediator.parseAndSave(input);
    },
    []
  );

  return {
    // Workflow methods
    createNote,
    saveAndNavigate,
    resolveConflict,
    bulkOperation,
    parseAndSave,

    // State
    activeWorkflows,
    isProcessing: activeWorkflows.length > 0,

    // Direct mediator access (for advanced usage)
    mediator: noteMediator,
  };
}
