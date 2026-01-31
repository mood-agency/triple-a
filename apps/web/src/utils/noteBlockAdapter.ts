import type { Note } from '@/types/note';

/**
 * Adapter pattern: Converts Note entities to BlockNote block format
 */

export interface LabelData {
  name: string;
  color: string;
}

export interface NotepadBlockProps {
  isChecked: boolean;
  category: string;
  date: string;
  labels: LabelData[];
  assignees: string[];
  pinned: boolean;
}

export interface NotepadBlockData {
  type: 'notepad';
  id: string;
  props: NotepadBlockProps;
  content: string;
}

/**
 * Convert a single Note to a BlockNote notepad block
 */
export function noteToBlock(
  note: Note,
  labels: LabelData[],
  assignees: string[]
): NotepadBlockData {
  return {
    type: 'notepad',
    id: note.id,
    props: {
      isChecked: note.completed,
      category: note.category,
      date: note.deadline || note.date,
      labels,
      assignees,
      pinned: note.pinned,
    },
    content: note.content,
  };
}

/**
 * Convert multiple Notes to BlockNote blocks
 * Note: This function should receive pre-computed label and assignee data
 */
export function notesToBlocks(
  notes: Note[],
  noteLabelsCache: Map<string, LabelData[]>,
  noteAssigneesCache: Map<string, string[]>
): NotepadBlockData[] {
  return notes.map((note) => {
    const labels = noteLabelsCache.get(note.id) ?? [];
    const assignees = noteAssigneesCache.get(note.id) ?? [];
    return noteToBlock(note, labels, assignees);
  });
}

/**
 * Extract text content from a block (for reverse conversion)
 */
export function getBlockContent(block: { content: unknown }): string {
  if (typeof block.content === 'string') {
    return block.content;
  }
  // Handle BlockNote's inline content array format
  if (Array.isArray(block.content)) {
    return block.content
      .map((node: any) => {
        // Handle text nodes
        if (node.type === 'text' || node.text) {
          return node.text || '';
        }
        // Handle other inline content types
        return '';
      })
      .join('');
  }
  return '';
}
