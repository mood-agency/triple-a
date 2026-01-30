import { getInitials } from '@/lib/utils'
import type { Note, NoteCategory, Label } from '@/types/note'
import type { Contact } from '@/types/contact'

interface TaskItemBlock {
  id?: string
  type: 'taskItem'
  props: {
    checked: boolean
    category: NoteCategory
    deadline: string
    pinned: boolean
    labelIds: string
    assigneeIds: string
    noteId: string
  }
  content: Array<
    | { type: 'text'; text: string; styles: Record<string, unknown> }
    | { type: 'labelChip'; props: { labelId: string; name: string; color: string } }
    | { type: 'assigneeChip'; props: { contactId: string; initials: string; fullName: string } }
  >
  children?: []
}

/**
 * Convert a Note to a TaskItem block
 */
export function noteToBlock(
  note: Note,
  noteLabels: Label[],
  noteAssignees: Contact[]
): TaskItemBlock {
  // Build inline content: text + label chips + assignee chips
  const content: TaskItemBlock['content'] = []

  // Main text content
  if (note.content) {
    content.push({
      type: 'text',
      text: note.content,
      styles: {},
    })
  }

  // Add label chips
  for (const label of noteLabels) {
    content.push({
      type: 'text',
      text: ' ',
      styles: {},
    })
    content.push({
      type: 'labelChip',
      props: {
        labelId: label.id,
        name: label.name,
        color: label.color,
      },
    })
  }

  // Add assignee chips
  for (const contact of noteAssignees) {
    content.push({
      type: 'text',
      text: ' ',
      styles: {},
    })
    content.push({
      type: 'assigneeChip',
      props: {
        contactId: contact.id,
        initials: getInitials(contact.name, contact.lastname),
        fullName: `${contact.name} ${contact.lastname}`.trim(),
      },
    })
  }

  return {
    id: note.id,
    type: 'taskItem',
    props: {
      checked: note.completed,
      category: note.category,
      deadline: note.deadline || '',
      pinned: note.pinned,
      labelIds: JSON.stringify(noteLabels.map((l) => l.id)),
      assigneeIds: JSON.stringify(noteAssignees.map((c) => c.id)),
      noteId: note.id,
    },
    content: content.length > 0 ? content : [{ type: 'text', text: '', styles: {} }],
    children: [],
  }
}

/**
 * Convert multiple Notes to TaskItem blocks
 */
export function notesToBlocks(
  notes: Note[],
  noteLabelsCache: Map<string, Label[]>,
  noteAssigneesCache: Map<string, Contact[]>
): TaskItemBlock[] {
  return notes.map((note) => {
    const labels = noteLabelsCache.get(note.id) || []
    const assignees = noteAssigneesCache.get(note.id) || []
    return noteToBlock(note, labels, assignees)
  })
}

/**
 * Extract text content and metadata from a TaskItem block
 * Returns partial Note update
 */
export function blockToNoteUpdate(block: TaskItemBlock): {
  content?: string
  category?: NoteCategory
  completed?: boolean
} {
  // Extract only text content (not chips)
  const textContent = block.content
    .filter((item): item is { type: 'text'; text: string; styles: Record<string, unknown> } =>
      item.type === 'text'
    )
    .map((item) => item.text)
    .join('')
    .trim()

  return {
    content: textContent,
    category: block.props.category,
    completed: block.props.checked,
  }
}

/**
 * Extract label IDs from a TaskItem block
 */
export function extractLabelIds(block: TaskItemBlock): string[] {
  // From inline chips
  const inlineLabels = block.content
    .filter((item): item is { type: 'labelChip'; props: { labelId: string; name: string; color: string } } =>
      item.type === 'labelChip'
    )
    .map((item) => item.props.labelId)

  // Merge with props (in case of discrepancy)
  try {
    const propsLabels = JSON.parse(block.props.labelIds) as string[]
    return [...new Set([...inlineLabels, ...propsLabels])]
  } catch {
    return inlineLabels
  }
}

/**
 * Extract assignee IDs from a TaskItem block
 */
export function extractAssigneeIds(block: TaskItemBlock): string[] {
  // From inline chips
  const inlineAssignees = block.content
    .filter((item): item is { type: 'assigneeChip'; props: { contactId: string; initials: string; fullName: string } } =>
      item.type === 'assigneeChip'
    )
    .map((item) => item.props.contactId)

  // Merge with props
  try {
    const propsAssignees = JSON.parse(block.props.assigneeIds) as string[]
    return [...new Set([...inlineAssignees, ...propsAssignees])]
  } catch {
    return inlineAssignees
  }
}
