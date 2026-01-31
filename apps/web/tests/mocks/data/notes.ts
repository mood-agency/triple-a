import { nanoid } from 'nanoid'
import type { Note, NoteCategory, Label, NoteLabel } from '@triple-a/types'

/**
 * Create a mock note with default values
 *
 * @example
 * ```tsx
 * const note = createMockNote({ content: 'Test task', category: 'todo' })
 * ```
 */
export function createMockNote(overrides?: Partial<Note>): Note {
  const now = new Date().toISOString()
  const date = overrides?.date || new Date().toISOString().split('T')[0]

  return {
    id: nanoid(),
    date,
    content: 'Test note',
    description: null,
    category: 'notes',
    completed: false,
    completed_at: null,
    deadline: null,
    pinned: false,
    sort_order: 0,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    deleted_reason: null,
    project_id: null,
    last_postpone_reason: null,
    remote_id: null,
    sync_status: 'local',
    last_synced_at: null,
    gcal_event_id: null,
    is_public: false,
    public_slug: null,
    ...overrides,
  }
}

/**
 * Create a mock todo task
 */
export function createMockTodo(overrides?: Partial<Note>): Note {
  return createMockNote({
    category: 'todo',
    content: 'Test todo',
    ...overrides,
  })
}

/**
 * Create a mock completed task
 */
export function createMockCompletedTodo(overrides?: Partial<Note>): Note {
  const now = new Date().toISOString()
  return createMockNote({
    category: 'todo',
    content: 'Completed task',
    completed: true,
    completed_at: now,
    ...overrides,
  })
}

/**
 * Create a mock meeting note
 */
export function createMockMeeting(overrides?: Partial<Note>): Note {
  const deadline = new Date()
  deadline.setDate(deadline.getDate() + 7) // 1 week from now

  return createMockNote({
    category: 'meeting',
    content: 'Team meeting',
    deadline: deadline.toISOString(),
    ...overrides,
  })
}

/**
 * Create a mock follow-up task
 */
export function createMockFollowup(overrides?: Partial<Note>): Note {
  return createMockNote({
    category: 'followup',
    content: 'Follow up with client',
    ...overrides,
  })
}

/**
 * Create a mock label
 */
export function createMockLabel(overrides?: Partial<Label>): Label {
  const now = new Date().toISOString()

  return {
    id: nanoid(),
    name: 'Test Label',
    color: '#3b82f6',
    created_at: now,
    updated_at: now,
    remote_id: null,
    sync_status: 'local',
    last_synced_at: null,
    ...overrides,
  }
}

/**
 * Create a mock note-label relationship
 */
export function createMockNoteLabel(
  noteId: string,
  labelId: string,
  overrides?: Partial<NoteLabel>
): NoteLabel {
  return {
    note_id: noteId,
    label_id: labelId,
    created_at: new Date().toISOString(),
    ...overrides,
  }
}

/**
 * Pre-defined mock notes for common test scenarios
 */
export const mockNotes: Note[] = [
  createMockNote({
    id: 'note-1',
    content: 'First note',
    category: 'notes',
  }),
  createMockTodo({
    id: 'todo-1',
    content: 'Buy groceries',
  }),
  createMockTodo({
    id: 'todo-2',
    content: 'Finish project',
    pinned: true,
  }),
  createMockCompletedTodo({
    id: 'todo-3',
    content: 'Completed task',
  }),
  createMockMeeting({
    id: 'meeting-1',
    content: 'Weekly standup',
  }),
  createMockFollowup({
    id: 'followup-1',
    content: 'Check on proposal',
  }),
]

/**
 * Pre-defined mock labels
 */
export const mockLabels: Label[] = [
  createMockLabel({
    id: 'label-1',
    name: 'Urgent',
    color: '#ef4444',
  }),
  createMockLabel({
    id: 'label-2',
    name: 'Work',
    color: '#3b82f6',
  }),
  createMockLabel({
    id: 'label-3',
    name: 'Personal',
    color: '#8b5cf6',
  }),
]

/**
 * Create multiple mock notes
 *
 * @example
 * ```tsx
 * const notes = createMockNotes(10) // Creates 10 notes
 * const todos = createMockNotes(5, { category: 'todo' })
 * ```
 */
export function createMockNotes(count: number, overrides?: Partial<Note>): Note[] {
  return Array.from({ length: count }, (_, i) =>
    createMockNote({
      content: `Test note ${i + 1}`,
      sort_order: i,
      ...overrides,
    })
  )
}
