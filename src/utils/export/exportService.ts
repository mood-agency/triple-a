import type { MergeableStore } from 'tinybase';
import type { Note, NoteHistory, Label, NoteLabel, ExportData } from '@/types/note';
import type { NoteRow, LabelRow, NoteLabelRow, NoteHistoryRow } from '@/store/schema';

const EXPORT_VERSION = '1.0';

/**
 * Export all data from the TinyBase store
 * Retrieves notes, history, labels, and note-label relationships
 */
export function exportAllData(store: MergeableStore): ExportData {
  // Get notes table
  const notesTable = store.getTable('notes') as unknown as Record<string, NoteRow> | undefined;
  const notes: Note[] = notesTable
    ? Object.entries(notesTable)
        .filter(([, row]) => !row.deleted_at)
        .map(([id, row]) => ({
          id,
          date: row.date,
          content: row.content,
          description: row.description,
          category: row.category,
          completed: row.completed,
          completed_at: row.completed_at,
          deadline: row.deadline,
          pinned: row.pinned,
          sort_order: row.sort_order,
          created_at: row.created_at,
          updated_at: row.updated_at,
          deleted_at: row.deleted_at,
          assignee_id: row.assignee_id,
          project_id: row.project_id,
        }))
        .sort((a, b) => {
          if (a.date !== b.date) return b.date.localeCompare(a.date);
          return a.sort_order - b.sort_order;
        })
    : [];

  // Get note history table
  const historyTable = store.getTable('note_history') as unknown as Record<string, NoteHistoryRow> | undefined;
  const noteHistory: NoteHistory[] = historyTable
    ? Object.entries(historyTable)
        .map(([id, row]) => ({
          id,
          note_id: row.note_id,
          content: row.content,
          description: row.description,
          category: row.category,
          completed: row.completed,
          changed_at: row.changed_at,
          action_type: row.action_type,
          reason: row.reason,
          previous_date: row.previous_date,
        }))
        .sort((a, b) => b.changed_at.localeCompare(a.changed_at))
    : [];

  // Get labels table
  const labelsTable = store.getTable('labels') as unknown as Record<string, LabelRow> | undefined;
  const labels: Label[] = labelsTable
    ? Object.entries(labelsTable)
        .filter(([, row]) => !row.deleted_at)
        .map(([id, row]) => ({
          id,
          name: row.name,
          color: row.color,
          created_at: row.created_at,
          updated_at: row.updated_at,
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  // Get note-label relationships
  const noteLabelsTable = store.getTable('note_labels') as unknown as Record<string, NoteLabelRow> | undefined;
  const noteLabels: NoteLabel[] = noteLabelsTable
    ? Object.entries(noteLabelsTable).map(([, row]) => ({
        note_id: row.note_id,
        label_id: row.label_id,
        created_at: row.created_at,
      }))
    : [];

  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    notes,
    noteHistory,
    labels,
    noteLabels,
  };
}

/**
 * Download exported data as JSON file
 * Creates a Blob, generates download link, and triggers download
 */
export function downloadExportFile(data: ExportData): void {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date().toISOString().split('T')[0];
  const filename = `notes-backup-${date}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
