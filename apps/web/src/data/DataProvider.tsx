import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { Repositories } from './types';
import { registerHandlers } from '@/cqrs/registerHandlers';

const DataContext = createContext<Repositories | null>(null);

interface DataProviderProps {
  repositories: Repositories;
  children: ReactNode;
}

export function DataProvider({ repositories, children }: DataProviderProps) {
  // Register CQRS handlers when repositories are available
  useEffect(() => {
    registerHandlers(repositories);
  }, [repositories]);

  return <DataContext.Provider value={repositories}>{children}</DataContext.Provider>;
}

export function useData(): Repositories {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}

export function useNoteRepository() {
  return useData().notes;
}

export function useLabelRepository() {
  return useData().labels;
}

export function useAssigneeRepository() {
  return useData().assignees;
}
