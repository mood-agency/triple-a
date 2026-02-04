import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLabelsSupabase } from '@/hooks/supabase/useLabelsSupabase';
import type { Label } from '@/types/note';

interface LabelsContextValue {
  labels: Label[];
  loading: boolean;
  noteLabelVersion: number;
  createLabel: (name: string, color?: string) => Promise<Label>;
  updateLabel: (id: string, name: string, color: string) => Promise<Label>;
  deleteLabel: (id: string) => Promise<void>;
  getLabelsForNote: (noteId: string) => Label[];
  addLabelToNote: (noteId: string, labelId: string) => Promise<void>;
  removeLabelFromNote: (noteId: string, labelId: string) => Promise<void>;
  setLabelsForNote: (noteId: string, labelIds: string[]) => Promise<void>;
}

const LabelsContext = createContext<LabelsContextValue | null>(null);

interface LabelsProviderProps {
  children: ReactNode;
}

export function LabelsProvider({ children }: LabelsProviderProps) {
  const {
    labels,
    loading,
    noteLabelVersion,
    createLabel,
    updateLabel,
    deleteLabel,
    getLabelsForNote,
    addLabelToNote,
    removeLabelFromNote,
    setLabelsForNote,
  } = useLabelsSupabase();

  const value = useMemo(() => ({
    labels,
    loading,
    noteLabelVersion,
    createLabel,
    updateLabel,
    deleteLabel,
    getLabelsForNote,
    addLabelToNote,
    removeLabelFromNote,
    setLabelsForNote,
  }), [
    labels,
    loading,
    noteLabelVersion,
    createLabel,
    updateLabel,
    deleteLabel,
    getLabelsForNote,
    addLabelToNote,
    removeLabelFromNote,
    setLabelsForNote,
  ]);

  return (
    <LabelsContext.Provider value={value}>
      {children}
    </LabelsContext.Provider>
  );
}

export function useLabelsContext() {
  const context = useContext(LabelsContext);
  if (!context) {
    throw new Error('useLabelsContext must be used within a LabelsProvider');
  }
  return context;
}
