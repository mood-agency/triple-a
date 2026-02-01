import { createContext, useContext, type ReactNode } from 'react';
import type { FilterCommand, SortConfigType } from './commands/types';
import type { NoteCategory } from '@/types/note';

interface FilterCommandsContextValue {
  // Undo/Redo state
  canUndo: boolean;
  canRedo: boolean;
  lastCommand: FilterCommand | null;

  // Undo/Redo actions
  undo: () => void;
  redo: () => void;

  // Command actions (optional - can be undefined if using direct setters)
  commands?: {
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
    clearAllFilters: () => void;
  };
}

const FilterCommandsContext = createContext<FilterCommandsContextValue | null>(null);

export function FilterCommandsProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: FilterCommandsContextValue;
}) {
  return (
    <FilterCommandsContext.Provider value={value}>
      {children}
    </FilterCommandsContext.Provider>
  );
}

export function useFilterCommandsContext() {
  const context = useContext(FilterCommandsContext);
  if (!context) {
    // Return a no-op context if not provided (graceful degradation)
    return {
      canUndo: false,
      canRedo: false,
      lastCommand: null,
      undo: () => {},
      redo: () => {},
    };
  }
  return context;
}
