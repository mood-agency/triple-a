import { useCallback, useRef, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHotkeys } from 'react-hotkeys-hook';
import type { FilterCommand, FilterState, CommandHistory, SortConfigType } from '../commands/types';
import type { NoteCategory, Label } from '@/types/note';
import type { Contact } from '@/types/contact';
import {
  SetCategoryFilterCommand,
  ToggleLabelFilterCommand,
  RemoveLabelFilterCommand,
  AddAssigneeFilterCommand,
  RemoveAssigneeFilterCommand,
  SetSearchQueryCommand,
  SetSortConfigCommand,
  SetDateRangeFilterCommand,
  SetTaskStatusFilterCommand,
  SetOverdueOnlyCommand,
  SetPublicOnlyCommand,
  ClearAllFiltersCommand,
} from '../commands/FilterCommands';

const MAX_HISTORY_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 500;

interface UseFilterCommandsOptions {
  // Current filter state (from useNoteFilters or Home.tsx state)
  categoryFilter: NoteCategory | 'all';
  labelFilter: string[];
  assigneeFilter: string[];
  searchQuery: string;
  sortConfig: SortConfigType;
  dateRangeFilter: { from: Date | undefined; to: Date | undefined };
  taskStatusFilter: 'active' | 'completed' | 'deleted';
  showOverdueOnly: boolean;
  showPublicOnly: boolean;

  // Setters (from useNoteFilters or Home.tsx)
  setCategoryFilter: (value: NoteCategory | 'all') => void;
  setLabelFilter: (value: string[] | ((prev: string[]) => string[])) => void;
  setAssigneeFilter: (value: string[] | ((prev: string[]) => string[])) => void;
  setSearchQuery: (value: string) => void;
  setSortConfig: (value: SortConfigType) => void;
  setDateRangeFilter: (value: { from: Date | undefined; to: Date | undefined }) => void;
  setTaskStatusFilter: (value: 'active' | 'completed' | 'deleted') => void;
  setShowOverdueOnly: (value: boolean) => void;
  setShowPublicOnly: (value: boolean) => void;

  // Reference data for command descriptions
  labels: Label[];
  contacts: Contact[];

  // Optional: callback when undo/redo occurs
  onUndoRedo?: (action: 'undo' | 'redo', command: FilterCommand) => void;
}

interface UseFilterCommandsReturn {
  // Command execution
  executeCommand: (command: FilterCommand) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // History info
  undoStack: FilterCommand[];
  redoStack: FilterCommand[];
  lastCommand: FilterCommand | null;

  // Convenient command creators (pre-bound with translation)
  commands: {
    setCategoryFilter: (category: NoteCategory | 'all') => void;
    toggleLabelFilter: (labelId: string) => void;
    removeLabelFilter: (labelId: string) => void;
    toggleAssigneeFilter: (assigneeId: string) => void;
    removeAssigneeFilter: (assigneeId: string) => void;
    setSearchQuery: (query: string) => void;
    setSortConfig: (config: SortConfigType) => void;
    setDateRangeFilter: (range: { from: Date | undefined; to: Date | undefined }) => void;
    setTaskStatusFilter: (status: 'active' | 'completed' | 'deleted') => void;
    setShowOverdueOnly: (value: boolean) => void;
    setShowPublicOnly: (value: boolean) => void;
    clearAllFilters: () => void;
  };

  // Clear history
  clearHistory: () => void;
}

export function useFilterCommands(options: UseFilterCommandsOptions): UseFilterCommandsReturn {
  const { t } = useTranslation();
  const {
    categoryFilter,
    labelFilter,
    assigneeFilter,
    searchQuery,
    sortConfig,
    dateRangeFilter,
    taskStatusFilter,
    showOverdueOnly,
    showPublicOnly,
    setCategoryFilter,
    setLabelFilter,
    setAssigneeFilter,
    setSearchQuery: setSearchQueryProp,
    setSortConfig,
    setDateRangeFilter,
    setTaskStatusFilter,
    setShowOverdueOnly,
    setShowPublicOnly,
    labels,
    contacts,
    onUndoRedo,
  } = options;

  // History management using ref to avoid unnecessary re-renders
  const historyRef = useRef<CommandHistory>({
    undoStack: [],
    redoStack: [],
    maxSize: MAX_HISTORY_SIZE,
  });

  // Track history version for triggering re-renders when needed
  const [historyVersion, setHistoryVersion] = useState(0);

  // Search debounce ref
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get current filter state
  const getCurrentState = useCallback(
    (): FilterState => ({
      categoryFilter,
      labelFilter,
      assigneeFilter,
      searchQuery,
      sortConfig,
      dateRangeFilter,
      taskStatusFilter,
      showOverdueOnly,
      showPublicOnly,
    }),
    [
      categoryFilter,
      labelFilter,
      assigneeFilter,
      searchQuery,
      sortConfig,
      dateRangeFilter,
      taskStatusFilter,
      showOverdueOnly,
      showPublicOnly,
    ]
  );

  // Apply filter state to actual state setters
  const applyState = useCallback(
    (state: FilterState) => {
      setCategoryFilter(state.categoryFilter);
      setLabelFilter(state.labelFilter);
      setAssigneeFilter(state.assigneeFilter);
      setSearchQueryProp(state.searchQuery);
      setSortConfig(state.sortConfig);
      setDateRangeFilter(state.dateRangeFilter);
      setTaskStatusFilter(state.taskStatusFilter);
      setShowOverdueOnly(state.showOverdueOnly);
      setShowPublicOnly(state.showPublicOnly);
    },
    [
      setCategoryFilter,
      setLabelFilter,
      setAssigneeFilter,
      setSearchQueryProp,
      setSortConfig,
      setDateRangeFilter,
      setTaskStatusFilter,
      setShowOverdueOnly,
      setShowPublicOnly,
    ]
  );

  // Execute a command and add to history
  const executeCommand = useCallback(
    (command: FilterCommand) => {
      const currentState = getCurrentState();
      const newState = command.execute(currentState);

      // Apply the new state
      applyState(newState);

      // Add to undo stack
      const history = historyRef.current;
      history.undoStack.push(command);

      // Clear redo stack on new command
      history.redoStack = [];

      // Trim history if exceeds max size
      if (history.undoStack.length > history.maxSize) {
        history.undoStack.shift();
      }

      setHistoryVersion((v) => v + 1);
    },
    [getCurrentState, applyState]
  );

  // Undo the last command
  const undo = useCallback(() => {
    const history = historyRef.current;
    const command = history.undoStack.pop();

    if (!command) return;

    const currentState = getCurrentState();
    const previousState = command.undo(currentState);

    // Apply the previous state
    applyState(previousState);

    // Add to redo stack
    history.redoStack.push(command);

    setHistoryVersion((v) => v + 1);
    onUndoRedo?.('undo', command);
  }, [getCurrentState, applyState, onUndoRedo]);

  // Redo the last undone command
  const redo = useCallback(() => {
    const history = historyRef.current;
    const command = history.redoStack.pop();

    if (!command) return;

    const currentState = getCurrentState();
    const newState = command.execute(currentState);

    // Apply the new state
    applyState(newState);

    // Add back to undo stack
    history.undoStack.push(command);

    setHistoryVersion((v) => v + 1);
    onUndoRedo?.('redo', command);
  }, [getCurrentState, applyState, onUndoRedo]);

  // Clear all history
  const clearHistory = useCallback(() => {
    historyRef.current.undoStack = [];
    historyRef.current.redoStack = [];
    setHistoryVersion((v) => v + 1);
  }, []);

  // Keyboard shortcuts for undo/redo
  useHotkeys(
    'ctrl+z, meta+z',
    (e) => {
      e.preventDefault();
      undo();
    },
    { enableOnFormTags: false, enableOnContentEditable: false },
    [undo]
  );

  useHotkeys(
    'ctrl+shift+z, meta+shift+z, ctrl+y, meta+y',
    (e) => {
      e.preventDefault();
      redo();
    },
    { enableOnFormTags: false, enableOnContentEditable: false },
    [redo]
  );

  // Helper to find label name by ID
  const getLabelName = useCallback(
    (labelId: string) => {
      return labels.find((l) => l.id === labelId)?.name ?? labelId;
    },
    [labels]
  );

  // Helper to find contact name by ID
  const getContactName = useCallback(
    (contactId: string) => {
      const contact = contacts.find((c) => c.id === contactId);
      return contact ? `${contact.name} ${contact.lastname}`.trim() : contactId;
    },
    [contacts]
  );

  // Convenient command creators
  const commands = useMemo(
    () => ({
      setCategoryFilter: (category: NoteCategory | 'all') => {
        const command = new SetCategoryFilterCommand(category, t);
        executeCommand(command);
      },

      toggleLabelFilter: (labelId: string) => {
        const command = new ToggleLabelFilterCommand(labelId, getLabelName(labelId), t);
        executeCommand(command);
      },

      removeLabelFilter: (labelId: string) => {
        const command = new RemoveLabelFilterCommand(labelId, getLabelName(labelId), t);
        executeCommand(command);
      },

      toggleAssigneeFilter: (assigneeId: string) => {
        // Determine if we're adding or removing
        const isCurrentlySelected = assigneeFilter.includes(assigneeId);
        const command = isCurrentlySelected
          ? new RemoveAssigneeFilterCommand(assigneeId, getContactName(assigneeId), t)
          : new AddAssigneeFilterCommand(assigneeId, getContactName(assigneeId), t);
        executeCommand(command);
      },

      removeAssigneeFilter: (assigneeId: string) => {
        const command = new RemoveAssigneeFilterCommand(assigneeId, getContactName(assigneeId), t);
        executeCommand(command);
      },

      setSearchQuery: (query: string) => {
        // Debounce search commands to avoid flooding history
        if (searchDebounceRef.current) {
          clearTimeout(searchDebounceRef.current);
        }

        // Immediately update the UI
        setSearchQueryProp(query);

        // Debounce the history entry
        const prevQuery = searchQuery;
        searchDebounceRef.current = setTimeout(() => {
          const command = new SetSearchQueryCommand(query, prevQuery, t);
          // Only add to history, don't re-apply state
          const history = historyRef.current;
          history.undoStack.push(command);
          history.redoStack = [];
          if (history.undoStack.length > history.maxSize) {
            history.undoStack.shift();
          }
          setHistoryVersion((v) => v + 1);
        }, SEARCH_DEBOUNCE_MS);
      },

      setSortConfig: (config: SortConfigType) => {
        const command = new SetSortConfigCommand(config, t);
        executeCommand(command);
      },

      setDateRangeFilter: (range: { from: Date | undefined; to: Date | undefined }) => {
        const command = new SetDateRangeFilterCommand(range, t);
        executeCommand(command);
      },

      setTaskStatusFilter: (status: 'active' | 'completed' | 'deleted') => {
        const command = new SetTaskStatusFilterCommand(status, t);
        executeCommand(command);
      },

      setShowOverdueOnly: (value: boolean) => {
        const command = new SetOverdueOnlyCommand(value, t);
        executeCommand(command);
      },

      setShowPublicOnly: (value: boolean) => {
        const command = new SetPublicOnlyCommand(value, t);
        executeCommand(command);
      },

      clearAllFilters: () => {
        const command = new ClearAllFiltersCommand(t);
        executeCommand(command);
      },
    }),
    [
      t,
      executeCommand,
      getLabelName,
      getContactName,
      assigneeFilter,
      setSearchQueryProp,
      searchQuery,
    ]
  );

  // Derived state for canUndo/canRedo - use historyVersion to trigger re-render
  void historyVersion; // Ensure we depend on historyVersion
  const canUndo = historyRef.current.undoStack.length > 0;
  const canRedo = historyRef.current.redoStack.length > 0;
  const lastCommand = historyRef.current.undoStack[historyRef.current.undoStack.length - 1] ?? null;

  return {
    executeCommand,
    undo,
    redo,
    canUndo,
    canRedo,
    undoStack: historyRef.current.undoStack,
    redoStack: historyRef.current.redoStack,
    lastCommand,
    commands,
    clearHistory,
  };
}
