import type { Note } from '@/types/note';
import { hasTimeComponent, getHourFromDeadline } from './dateUtils';

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
  compact: boolean;
  fixedInSidebar: boolean;
  hideDate: boolean;
}

export interface NotepadBlockData {
  type: 'notepad';
  id: string;
  props: NotepadBlockProps;
  content: string;
}

export interface HourDividerBlockData {
  type: 'hourDivider';
  id: string;
  props: {
    hour: number;
    isEmpty: boolean;
  };
}

export type TimelineBlockData = NotepadBlockData | HourDividerBlockData;

/**
 * Convert a single Note to a BlockNote notepad block
 */
export function noteToBlock(
  note: Note,
  labels: LabelData[],
  assignees: string[],
  compact: boolean = false,
  fixedNoteId: string | null = null,
  hideDate: boolean = false
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
      compact,
      fixedInSidebar: note.id === fixedNoteId,
      hideDate,
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
  noteAssigneesCache: Map<string, string[]>,
  compact: boolean = false,
  fixedNoteId: string | null = null,
  hideDate: boolean = false
): NotepadBlockData[] {
  return notes.map((note) => {
    const labels = noteLabelsCache.get(note.id) ?? [];
    const assignees = noteAssigneesCache.get(note.id) ?? [];
    return noteToBlock(note, labels, assignees, compact, fixedNoteId, hideDate);
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

// Special hour value for "All Day" section
export const ALL_DAY_HOUR = -1;

/**
 * Create an hour divider block
 * Use hour = -1 (ALL_DAY_HOUR) for the "All Day" section
 */
export function createHourDividerBlock(hour: number, isEmpty: boolean = true): HourDividerBlockData {
  return {
    type: 'hourDivider',
    id: hour === ALL_DAY_HOUR ? 'hour-all-day' : `hour-${hour}`,
    props: {
      hour,
      isEmpty,
    },
  };
}

/**
 * Convert notes to timeline blocks with hour dividers.
 * Groups notes by hour and inserts hour divider blocks between groups.
 *
 * @param timedNotes - Notes that have a time component in their deadline
 * @param allDayNotes - Notes without a specific time (all-day tasks)
 * @param noteLabelsCache - Map of note ID to label data
 * @param noteAssigneesCache - Map of note ID to assignee initials
 * @param startHour - First hour to show (default 8)
 * @param endHour - Last hour to show (default 20)
 * @param hideEmptyHours - Whether to hide hours with no tasks (default true)
 * @param compact - Whether to use compact view
 * @param fixedNoteId - ID of the note fixed in sidebar
 */
export function notesToTimelineBlocks(
  timedNotes: Note[],
  allDayNotes: Note[],
  noteLabelsCache: Map<string, LabelData[]>,
  noteAssigneesCache: Map<string, string[]>,
  startHour: number = 8,
  endHour: number = 20,
  hideEmptyHours: boolean = true,
  compact: boolean = false,
  fixedNoteId: string | null = null
): TimelineBlockData[] {
  const blocks: TimelineBlockData[] = [];

  // Add "All Day" section at the top if there are all-day notes
  if (allDayNotes.length > 0) {
    blocks.push(createHourDividerBlock(ALL_DAY_HOUR, false));
    for (const note of allDayNotes) {
      const labels = noteLabelsCache.get(note.id) ?? [];
      const assignees = noteAssigneesCache.get(note.id) ?? [];
      blocks.push(noteToBlock(note, labels, assignees, compact, fixedNoteId));
    }
  }

  // Group timed notes by hour
  const notesByHour = new Map<number, Note[]>();
  for (const note of timedNotes) {
    if (!note.deadline) continue;
    const hour = getHourFromDeadline(note.deadline);
    const existing = notesByHour.get(hour) || [];
    notesByHour.set(hour, [...existing, note]);
  }

  // Expand hour range if there are notes outside default range
  let actualStartHour = startHour;
  let actualEndHour = endHour;
  for (const hour of notesByHour.keys()) {
    if (hour < actualStartHour) actualStartHour = hour;
    if (hour > actualEndHour) actualEndHour = hour + 1;
  }

  // Build timeline blocks for timed notes
  for (let hour = actualStartHour; hour <= actualEndHour; hour++) {
    const notesForHour = notesByHour.get(hour) || [];
    const hasNotes = notesForHour.length > 0;

    // Skip empty hours if hideEmptyHours is enabled
    if (hideEmptyHours && !hasNotes) {
      continue;
    }

    // Add hour divider
    blocks.push(createHourDividerBlock(hour, !hasNotes));

    // Add notes for this hour
    for (const note of notesForHour) {
      const labels = noteLabelsCache.get(note.id) ?? [];
      const assignees = noteAssigneesCache.get(note.id) ?? [];
      blocks.push(noteToBlock(note, labels, assignees, compact, fixedNoteId));
    }
  }

  return blocks;
}

/**
 * Separate notes into timed and all-day categories
 */
export function separateNotesByTime(notes: Note[]): { timedNotes: Note[]; allDayNotes: Note[] } {
  const timedNotes: Note[] = [];
  const allDayNotes: Note[] = [];

  for (const note of notes) {
    if (note.deadline && hasTimeComponent(note.deadline)) {
      timedNotes.push(note);
    } else {
      allDayNotes.push(note);
    }
  }

  return { timedNotes, allDayNotes };
}
