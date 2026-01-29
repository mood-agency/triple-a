import { describe, it, expect } from 'vitest'
import type { Note, Label } from '@/types/note'
import {
  sortNotesByCategory,
  sortNotes,
  sortCompletedNotes,
  filterNotes,
  isTaskCategory,
  separateNotesByStatus,
} from '../noteUtils'

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'note-1',
    date: '2026-01-15',
    content: 'Test note',
    description: null,
    category: 'todo',
    completed: false,
    completed_at: null,
    deadline: null,
    pinned: false,
    sort_order: 0,
    created_at: '2026-01-15T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    deleted_at: null,
    deleted_reason: null,
    assignee_id: null,
    project_id: null,
    ...overrides,
  }
}

describe('sortNotesByCategory', () => {
  it('sorts pinned notes first', () => {
    const notes = [
      makeNote({ id: 'a', pinned: false }),
      makeNote({ id: 'b', pinned: true }),
    ]
    const sorted = sortNotesByCategory(notes)
    expect(sorted[0].id).toBe('b')
  })

  it('sorts by category order: todo < followup < meeting < notes', () => {
    const notes = [
      makeNote({ id: 'notes', category: 'notes' }),
      makeNote({ id: 'meeting', category: 'meeting' }),
      makeNote({ id: 'todo', category: 'todo' }),
      makeNote({ id: 'followup', category: 'followup' }),
    ]
    const sorted = sortNotesByCategory(notes)
    expect(sorted.map(n => n.id)).toEqual(['todo', 'followup', 'meeting', 'notes'])
  })

  it('does not mutate original array', () => {
    const notes = [
      makeNote({ id: 'b', category: 'notes' }),
      makeNote({ id: 'a', category: 'todo' }),
    ]
    sortNotesByCategory(notes)
    expect(notes[0].id).toBe('b')
  })

  it('pinned notes maintain category order among themselves', () => {
    const notes = [
      makeNote({ id: 'a', pinned: true, category: 'notes' }),
      makeNote({ id: 'b', pinned: true, category: 'todo' }),
    ]
    const sorted = sortNotesByCategory(notes)
    expect(sorted[0].id).toBe('b') // todo comes before notes
  })
})

describe('sortNotes', () => {
  it('sorts by category ascending', () => {
    const notes = [
      makeNote({ id: 'a', category: 'notes' }),
      makeNote({ id: 'b', category: 'todo' }),
    ]
    const sorted = sortNotes(notes, { category: 'asc' })
    expect(sorted[0].id).toBe('b')
  })

  it('sorts by category descending', () => {
    const notes = [
      makeNote({ id: 'a', category: 'todo' }),
      makeNote({ id: 'b', category: 'notes' }),
    ]
    const sorted = sortNotes(notes, { category: 'desc' })
    expect(sorted[0].id).toBe('b')
  })

  it('sorts by deadline ascending', () => {
    const notes = [
      makeNote({ id: 'a', deadline: '2026-01-20' }),
      makeNote({ id: 'b', deadline: '2026-01-10' }),
    ]
    const sorted = sortNotes(notes, { deadline: 'asc' })
    expect(sorted[0].id).toBe('b')
  })

  it('sorts by deadline descending', () => {
    const notes = [
      makeNote({ id: 'a', deadline: '2026-01-10' }),
      makeNote({ id: 'b', deadline: '2026-01-20' }),
    ]
    const sorted = sortNotes(notes, { deadline: 'desc' })
    expect(sorted[0].id).toBe('b')
  })

  it('puts notes without deadline at the end when sorting by deadline', () => {
    const notes = [
      makeNote({ id: 'no-deadline', deadline: null }),
      makeNote({ id: 'has-deadline', deadline: '2026-01-10' }),
    ]
    const sorted = sortNotes(notes, { deadline: 'asc' })
    expect(sorted[0].id).toBe('has-deadline')
    expect(sorted[1].id).toBe('no-deadline')
  })

  it('sorts by assignee with cache', () => {
    const cache = new Map([
      ['a', 'Charlie'],
      ['b', 'Alice'],
    ])
    const notes = [
      makeNote({ id: 'a' }),
      makeNote({ id: 'b' }),
    ]
    const sorted = sortNotes(notes, { assignee: 'asc' }, cache)
    expect(sorted[0].id).toBe('b') // Alice before Charlie
  })

  it('puts unassigned notes after assigned ones', () => {
    const cache = new Map([
      ['a', 'Alice'],
      ['b', ''],
    ])
    const notes = [
      makeNote({ id: 'b' }),
      makeNote({ id: 'a' }),
    ]
    const sorted = sortNotes(notes, { assignee: 'asc' }, cache)
    expect(sorted[0].id).toBe('a')
  })

  it('pinned notes always come first regardless of sort config', () => {
    const notes = [
      makeNote({ id: 'unpinned', pinned: false, deadline: '2026-01-01' }),
      makeNote({ id: 'pinned', pinned: true, deadline: '2026-12-31' }),
    ]
    const sorted = sortNotes(notes, { deadline: 'asc' })
    expect(sorted[0].id).toBe('pinned')
  })
})

describe('sortCompletedNotes', () => {
  it('sorts by completed_at descending (most recent first)', () => {
    const notes = [
      makeNote({ id: 'old', completed: true, completed_at: '2026-01-01T00:00:00Z' }),
      makeNote({ id: 'new', completed: true, completed_at: '2026-01-15T00:00:00Z' }),
    ]
    const sorted = sortCompletedNotes(notes)
    expect(sorted[0].id).toBe('new')
  })

  it('pinned notes come first even in completed list', () => {
    const notes = [
      makeNote({ id: 'new', completed: true, completed_at: '2026-01-15T00:00:00Z' }),
      makeNote({ id: 'pinned', completed: true, completed_at: '2026-01-01T00:00:00Z', pinned: true }),
    ]
    const sorted = sortCompletedNotes(notes)
    expect(sorted[0].id).toBe('pinned')
  })

  it('handles null completed_at', () => {
    const notes = [
      makeNote({ id: 'a', completed: true, completed_at: null }),
      makeNote({ id: 'b', completed: true, completed_at: '2026-01-15T00:00:00Z' }),
    ]
    const sorted = sortCompletedNotes(notes)
    expect(sorted[0].id).toBe('b')
  })
})

describe('filterNotes', () => {
  it('filters by category', () => {
    const notes = [
      makeNote({ id: 'a', category: 'todo' }),
      makeNote({ id: 'b', category: 'meeting' }),
    ]
    const result = filterNotes(notes, { categoryFilter: 'todo' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('returns all notes when categoryFilter is "all"', () => {
    const notes = [
      makeNote({ id: 'a', category: 'todo' }),
      makeNote({ id: 'b', category: 'meeting' }),
    ]
    const result = filterNotes(notes, { categoryFilter: 'all' })
    expect(result).toHaveLength(2)
  })

  it('filters by completed status', () => {
    const notes = [
      makeNote({ id: 'a', completed: false }),
      makeNote({ id: 'b', completed: true }),
    ]
    const result = filterNotes(notes, { showCompleted: true })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })

  it('filters out completed notes', () => {
    const notes = [
      makeNote({ id: 'a', completed: false }),
      makeNote({ id: 'b', completed: true }),
    ]
    const result = filterNotes(notes, { showCompleted: false })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('filters by search query in content', () => {
    const notes = [
      makeNote({ id: 'a', content: 'Fix bug in login' }),
      makeNote({ id: 'b', content: 'Add new feature' }),
    ]
    const result = filterNotes(notes, { searchQuery: 'bug' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('filters by search query in description', () => {
    const notes = [
      makeNote({ id: 'a', content: 'Task', description: 'Related to authentication' }),
      makeNote({ id: 'b', content: 'Task', description: 'Related to styling' }),
    ]
    const result = filterNotes(notes, { searchQuery: 'authentication' })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('search is case-insensitive', () => {
    const notes = [makeNote({ id: 'a', content: 'Fix BUG in Login' })]
    const result = filterNotes(notes, { searchQuery: 'fix bug' })
    expect(result).toHaveLength(1)
  })

  it('filters by labels', () => {
    const notes = [
      makeNote({ id: 'a' }),
      makeNote({ id: 'b' }),
    ]
    const labelsCache = new Map<string, Label[]>([
      ['a', [{ id: 'label-1', name: 'urgent', color: 'red', created_at: '', updated_at: '' }]],
      ['b', []],
    ])
    const result = filterNotes(notes, { labelFilter: ['label-1'] }, labelsCache)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('filters by assignee', () => {
    const notes = [
      makeNote({ id: 'a', assignee_id: 'contact-1' }),
      makeNote({ id: 'b', assignee_id: 'contact-2' }),
      makeNote({ id: 'c', assignee_id: null }),
    ]
    const result = filterNotes(notes, { assigneeFilter: ['contact-1'] })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
  })

  it('filters overdue only', () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 7)
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 7)

    const notes = [
      makeNote({ id: 'overdue', deadline: pastDate.toISOString().split('T')[0], completed: false }),
      makeNote({ id: 'future', deadline: futureDate.toISOString().split('T')[0], completed: false }),
      makeNote({ id: 'no-deadline', deadline: null, completed: false }),
      makeNote({ id: 'completed-overdue', deadline: pastDate.toISOString().split('T')[0], completed: true }),
    ]
    const result = filterNotes(notes, { showOverdueOnly: true })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('overdue')
  })

  it('filters by date range', () => {
    const notes = [
      makeNote({ id: 'in-range', deadline: '2026-01-15' }),
      makeNote({ id: 'out-range', deadline: '2026-02-15' }),
      makeNote({ id: 'no-deadline', deadline: null }),
    ]
    const result = filterNotes(notes, {
      dateRangeFilter: {
        start: new Date(2026, 0, 10),
        end: new Date(2026, 0, 20),
      },
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('in-range')
  })

  it('filters deleted notes', () => {
    const notes = [
      makeNote({ id: 'a', deleted_at: null }),
      makeNote({ id: 'b', deleted_at: '2026-01-15T00:00:00Z' }),
    ]
    const result = filterNotes(notes, { showDeleted: true })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('b')
  })

  it('combines multiple filters', () => {
    const notes = [
      makeNote({ id: 'match', category: 'todo', completed: false, content: 'Fix bug' }),
      makeNote({ id: 'wrong-cat', category: 'meeting', completed: false, content: 'Fix bug' }),
      makeNote({ id: 'completed', category: 'todo', completed: true, content: 'Fix bug' }),
      makeNote({ id: 'no-match', category: 'todo', completed: false, content: 'Add feature' }),
    ]
    const result = filterNotes(notes, {
      categoryFilter: 'todo',
      showCompleted: false,
      searchQuery: 'bug',
    })
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('match')
  })

  it('returns empty array when no notes match', () => {
    const notes = [makeNote({ id: 'a', category: 'todo' })]
    const result = filterNotes(notes, { categoryFilter: 'meeting' })
    expect(result).toHaveLength(0)
  })

  it('handles empty search query as no filter', () => {
    const notes = [makeNote({ id: 'a' })]
    const result = filterNotes(notes, { searchQuery: '  ' })
    expect(result).toHaveLength(1)
  })
})

describe('isTaskCategory', () => {
  it('returns true for todo', () => {
    expect(isTaskCategory('todo')).toBe(true)
  })

  it('returns true for followup', () => {
    expect(isTaskCategory('followup')).toBe(true)
  })

  it('returns true for meeting', () => {
    expect(isTaskCategory('meeting')).toBe(true)
  })

  it('returns false for notes', () => {
    expect(isTaskCategory('notes')).toBe(false)
  })
})

describe('separateNotesByStatus', () => {
  it('separates active and completed notes', () => {
    const notes = [
      makeNote({ id: 'a', completed: false }),
      makeNote({ id: 'b', completed: true }),
      makeNote({ id: 'c', completed: false }),
    ]
    const { active, completed } = separateNotesByStatus(notes)
    expect(active).toHaveLength(2)
    expect(completed).toHaveLength(1)
    expect(active.map(n => n.id)).toEqual(['a', 'c'])
    expect(completed[0].id).toBe('b')
  })

  it('handles all active', () => {
    const notes = [makeNote({ completed: false }), makeNote({ id: '2', completed: false })]
    const { active, completed } = separateNotesByStatus(notes)
    expect(active).toHaveLength(2)
    expect(completed).toHaveLength(0)
  })

  it('handles all completed', () => {
    const notes = [makeNote({ completed: true }), makeNote({ id: '2', completed: true })]
    const { active, completed } = separateNotesByStatus(notes)
    expect(active).toHaveLength(0)
    expect(completed).toHaveLength(2)
  })

  it('handles empty array', () => {
    const { active, completed } = separateNotesByStatus([])
    expect(active).toHaveLength(0)
    expect(completed).toHaveLength(0)
  })
})
