import { describe, it, expect } from 'vitest'
import {
  sortNotesByCategory,
  sortNotes,
  sortCompletedNotes,
  filterNotes,
  isTaskCategory,
  separateNotesByStatus,
  type NoteSortConfig,
  type NoteFilterConfig,
} from './noteUtils'
import { createMockNote, createMockTodo, createMockMeeting, createMockFollowup, createMockLabel } from '@tests/mocks/data/notes'
import type { Label } from '@triple-a/types'

describe('noteUtils', () => {
  describe('sortNotesByCategory', () => {
    it('should place pinned notes first', () => {
      const notes = [
        createMockNote({ id: '1', content: 'Regular', pinned: false }),
        createMockNote({ id: '2', content: 'Pinned', pinned: true }),
        createMockNote({ id: '3', content: 'Another regular', pinned: false }),
      ]

      const result = sortNotesByCategory(notes)

      expect(result[0].id).toBe('2')
      expect(result[0].pinned).toBe(true)
    })

    it('should sort by category order after pinned', () => {
      const notes = [
        createMockNote({ id: '1', category: 'notes', pinned: false }),
        createMockTodo({ id: '2', pinned: false }),
        createMockMeeting({ id: '3', pinned: false }),
        createMockFollowup({ id: '4', pinned: false }),
      ]

      const result = sortNotesByCategory(notes)

      // Category order should be: todo, followup, meeting, notes
      expect(result[0].category).toBe('todo')
      expect(result[1].category).toBe('followup')
      expect(result[2].category).toBe('meeting')
      expect(result[3].category).toBe('notes')
    })

    it('should not modify original array', () => {
      const notes = [
        createMockNote({ id: '1', category: 'notes' }),
        createMockTodo({ id: '2' }),
      ]
      const originalLength = notes.length
      const originalFirst = notes[0].id

      sortNotesByCategory(notes)

      expect(notes.length).toBe(originalLength)
      expect(notes[0].id).toBe(originalFirst)
    })

    it('should handle empty array', () => {
      const result = sortNotesByCategory([])

      expect(result).toEqual([])
    })
  })

  describe('sortNotes', () => {
    it('should sort by category ascending', () => {
      const notes = [
        createMockNote({ id: '1', category: 'notes' }),
        createMockTodo({ id: '2' }),
        createMockMeeting({ id: '3' }),
      ]
      const sortConfig: NoteSortConfig = { category: 'asc' }

      const result = sortNotes(notes, sortConfig)

      expect(result[0].category).toBe('todo')
      expect(result[2].category).toBe('notes')
    })

    it('should sort by category descending', () => {
      const notes = [
        createMockTodo({ id: '1' }),
        createMockNote({ id: '2', category: 'notes' }),
      ]
      const sortConfig: NoteSortConfig = { category: 'desc' }

      const result = sortNotes(notes, sortConfig)

      expect(result[0].category).toBe('notes')
      expect(result[1].category).toBe('todo')
    })

    it('should sort by deadline ascending', () => {
      const notes = [
        createMockTodo({ id: '1', deadline: '2026-02-20T10:00:00' }),
        createMockTodo({ id: '2', deadline: '2026-02-15T10:00:00' }),
        createMockTodo({ id: '3', deadline: '2026-02-25T10:00:00' }),
      ]
      const sortConfig: NoteSortConfig = { deadline: 'asc' }

      const result = sortNotes(notes, sortConfig)

      expect(result[0].id).toBe('2') // Feb 15
      expect(result[1].id).toBe('1') // Feb 20
      expect(result[2].id).toBe('3') // Feb 25
    })

    it('should sort by deadline descending', () => {
      const notes = [
        createMockTodo({ id: '1', deadline: '2026-02-15T10:00:00' }),
        createMockTodo({ id: '2', deadline: '2026-02-25T10:00:00' }),
      ]
      const sortConfig: NoteSortConfig = { deadline: 'desc' }

      const result = sortNotes(notes, sortConfig)

      expect(result[0].id).toBe('2') // Feb 25 first
      expect(result[1].id).toBe('1') // Feb 15 second
    })

    it('should place notes without deadline at the end when sorting by deadline', () => {
      const notes = [
        createMockTodo({ id: '1', deadline: null }),
        createMockTodo({ id: '2', deadline: '2026-02-15T10:00:00' }),
        createMockTodo({ id: '3', deadline: null }),
      ]
      const sortConfig: NoteSortConfig = { deadline: 'asc' }

      const result = sortNotes(notes, sortConfig)

      expect(result[0].id).toBe('2')
      expect(result[0].deadline).not.toBeNull()
      expect(result[1].deadline).toBeNull()
      expect(result[2].deadline).toBeNull()
    })

    it('should sort by assignee when cache provided', () => {
      const notes = [
        createMockTodo({ id: '1' }),
        createMockTodo({ id: '2' }),
        createMockTodo({ id: '3' }),
      ]
      const assigneeCache = new Map([
        ['1', 'Charlie'],
        ['2', 'Alice'],
        ['3', null],
      ])
      const sortConfig: NoteSortConfig = { assignee: 'asc' }

      const result = sortNotes(notes, sortConfig, assigneeCache)

      expect(result[0].id).toBe('2') // Alice
      expect(result[1].id).toBe('1') // Charlie
      expect(result[2].id).toBe('3') // No assignee
    })

    it('should sort pinned notes by deadline when sort is active', () => {
      const notes = [
        createMockTodo({ id: '1', pinned: false, deadline: '2026-02-15T10:00:00' }),
        createMockTodo({ id: '2', pinned: true, deadline: '2026-02-25T10:00:00' }),
      ]
      const sortConfig: NoteSortConfig = { deadline: 'asc' }

      const result = sortNotes(notes, sortConfig)

      expect(result[0].id).toBe('1') // Earlier deadline comes first, pinned doesn't override
      expect(result[1].id).toBe('2')
    })

    it('should place pinned notes first when no sort is active', () => {
      const notes = [
        createMockTodo({ id: '1', pinned: false }),
        createMockTodo({ id: '2', pinned: true }),
      ]
      const sortConfig: NoteSortConfig = {}

      const result = sortNotes(notes, sortConfig)

      expect(result[0].id).toBe('2') // Pinned first when no sort active
      expect(result[0].pinned).toBe(true)
    })

    it('should handle empty sort config', () => {
      const notes = [
        createMockTodo({ id: '1' }),
        createMockTodo({ id: '2' }),
      ]
      const sortConfig: NoteSortConfig = {}

      const result = sortNotes(notes, sortConfig)

      expect(result.length).toBe(2)
    })
  })

  describe('sortCompletedNotes', () => {
    it('should sort by completion date descending (most recent first)', () => {
      const notes = [
        createMockTodo({ id: '1', completed: true, completed_at: '2026-02-15T10:00:00' }),
        createMockTodo({ id: '2', completed: true, completed_at: '2026-02-20T10:00:00' }),
        createMockTodo({ id: '3', completed: true, completed_at: '2026-02-10T10:00:00' }),
      ]

      const result = sortCompletedNotes(notes)

      expect(result[0].id).toBe('2') // Feb 20 (most recent)
      expect(result[1].id).toBe('1') // Feb 15
      expect(result[2].id).toBe('3') // Feb 10
    })

    it('should place pinned notes first even in completed section', () => {
      const notes = [
        createMockTodo({ id: '1', completed: true, completed_at: '2026-02-20T10:00:00', pinned: false }),
        createMockTodo({ id: '2', completed: true, completed_at: '2026-02-10T10:00:00', pinned: true }),
      ]

      const result = sortCompletedNotes(notes)

      expect(result[0].id).toBe('2') // Pinned first
      expect(result[0].pinned).toBe(true)
    })

    it('should handle notes without completed_at', () => {
      const notes = [
        createMockTodo({ id: '1', completed: true, completed_at: null }),
        createMockTodo({ id: '2', completed: true, completed_at: '2026-02-15T10:00:00' }),
      ]

      const result = sortCompletedNotes(notes)

      expect(result.length).toBe(2)
      expect(result[0].id).toBe('2') // With date comes first
    })
  })

  describe('filterNotes', () => {
    it('should filter by category', () => {
      const notes = [
        createMockTodo({ id: '1' }),
        createMockNote({ id: '2', category: 'notes' }),
        createMockMeeting({ id: '3' }),
      ]
      const config: NoteFilterConfig = { categoryFilter: 'todo' }

      const result = filterNotes(notes, config)

      expect(result.length).toBe(1)
      expect(result[0].category).toBe('todo')
    })

    it('should show all when category filter is "all"', () => {
      const notes = [
        createMockTodo({ id: '1' }),
        createMockNote({ id: '2', category: 'notes' }),
      ]
      const config: NoteFilterConfig = { categoryFilter: 'all' }

      const result = filterNotes(notes, config)

      expect(result.length).toBe(2)
    })

    it('should filter by completed status', () => {
      const notes = [
        createMockTodo({ id: '1', completed: true }),
        createMockTodo({ id: '2', completed: false }),
        createMockTodo({ id: '3', completed: true }),
      ]
      const config: NoteFilterConfig = { showCompleted: true }

      const result = filterNotes(notes, config)

      expect(result.length).toBe(2)
      expect(result.every(n => n.completed)).toBe(true)
    })

    it('should filter by deleted status', () => {
      const now = new Date().toISOString()
      const notes = [
        createMockTodo({ id: '1', deleted_at: now }),
        createMockTodo({ id: '2', deleted_at: null }),
      ]
      const config: NoteFilterConfig = { showDeleted: true }

      const result = filterNotes(notes, config)

      expect(result.length).toBe(1)
      expect(result[0].deleted_at).not.toBeNull()
    })

    it('should filter by search query in content', () => {
      const notes = [
        createMockTodo({ id: '1', content: 'Buy groceries' }),
        createMockTodo({ id: '2', content: 'Call client' }),
        createMockTodo({ id: '3', content: 'Buy coffee' }),
      ]
      const config: NoteFilterConfig = { searchQuery: 'buy' }

      const result = filterNotes(notes, config)

      expect(result.length).toBe(2)
      expect(result[0].content).toContain('Buy')
      expect(result[1].content).toContain('Buy')
    })

    it('should filter by search query in description', () => {
      const notes = [
        createMockTodo({ id: '1', content: 'Task', description: 'Important meeting notes' }),
        createMockTodo({ id: '2', content: 'Another', description: 'Regular task' }),
      ]
      const config: NoteFilterConfig = { searchQuery: 'meeting' }

      const result = filterNotes(notes, config)

      expect(result.length).toBe(1)
      expect(result[0].description).toContain('meeting')
    })

    it('should filter by overdue only', () => {
      const past = '2026-01-01T10:00:00'
      const future = '2026-12-31T10:00:00'
      const notes = [
        createMockTodo({ id: '1', deadline: past, completed: false }),
        createMockTodo({ id: '2', deadline: future, completed: false }),
        createMockTodo({ id: '3', deadline: past, completed: true }),
      ]
      const config: NoteFilterConfig = { showOverdueOnly: true }

      const result = filterNotes(notes, config)

      expect(result.length).toBe(1)
      expect(result[0].id).toBe('1') // Overdue and not completed
    })

    it('should filter by date range', () => {
      const notes = [
        createMockTodo({ id: '1', deadline: '2026-02-15T10:00:00' }),
        createMockTodo({ id: '2', deadline: '2026-02-20T10:00:00' }),
        createMockTodo({ id: '3', deadline: '2026-03-01T10:00:00' }),
      ]
      const config: NoteFilterConfig = {
        dateRangeFilter: {
          start: new Date('2026-02-14'),
          end: new Date('2026-02-21'),
        },
      }

      const result = filterNotes(notes, config)

      expect(result.length).toBe(2)
      expect(result[0].id).toBe('1')
      expect(result[1].id).toBe('2')
    })

    it('should filter by labels when cache provided', () => {
      const notes = [
        createMockTodo({ id: '1' }),
        createMockTodo({ id: '2' }),
        createMockTodo({ id: '3' }),
      ]
      const label1 = createMockLabel({ id: 'label-1', name: 'Urgent' })
      const label2 = createMockLabel({ id: 'label-2', name: 'Work' })
      const noteLabelsCache = new Map<string, Label[]>([
        ['1', [label1]],
        ['2', [label2]],
        ['3', []],
      ])
      const config: NoteFilterConfig = { labelFilter: ['label-1'] }

      const result = filterNotes(notes, config, noteLabelsCache)

      expect(result.length).toBe(1)
      expect(result[0].id).toBe('1')
    })

    it('should filter by assignees when cache provided', () => {
      const notes = [
        createMockTodo({ id: '1' }),
        createMockTodo({ id: '2' }),
      ]
      const noteAssigneesCache = new Map<string, string[]>([
        ['1', ['contact-1']],
        ['2', ['contact-2']],
      ])
      const config: NoteFilterConfig = { assigneeFilter: ['contact-1'] }

      const result = filterNotes(notes, config, undefined, noteAssigneesCache)

      expect(result.length).toBe(1)
      expect(result[0].id).toBe('1')
    })

    it('should handle multiple filters combined', () => {
      const notes = [
        createMockTodo({ id: '1', content: 'Buy milk', completed: false }),
        createMockNote({ id: '2', content: 'Buy coffee', category: 'notes', completed: false }),
        createMockTodo({ id: '3', content: 'Call client', completed: false }),
      ]
      const config: NoteFilterConfig = {
        categoryFilter: 'todo',
        searchQuery: 'buy',
      }

      const result = filterNotes(notes, config)

      expect(result.length).toBe(1)
      expect(result[0].id).toBe('1')
    })

    it('should return all notes when no filters applied', () => {
      const notes = [
        createMockTodo({ id: '1' }),
        createMockNote({ id: '2', category: 'notes' }),
      ]
      const config: NoteFilterConfig = {}

      const result = filterNotes(notes, config)

      expect(result.length).toBe(2)
    })
  })

  describe('isTaskCategory', () => {
    it('should return true for todo', () => {
      expect(isTaskCategory('todo')).toBe(true)
    })

    it('should return true for followup', () => {
      expect(isTaskCategory('followup')).toBe(true)
    })

    it('should return true for meeting', () => {
      expect(isTaskCategory('meeting')).toBe(true)
    })

    it('should return false for notes', () => {
      expect(isTaskCategory('notes')).toBe(false)
    })
  })

  describe('separateNotesByStatus', () => {
    it('should separate active and completed notes', () => {
      const notes = [
        createMockTodo({ id: '1', completed: false }),
        createMockTodo({ id: '2', completed: true }),
        createMockTodo({ id: '3', completed: false }),
        createMockTodo({ id: '4', completed: true }),
      ]

      const result = separateNotesByStatus(notes)

      expect(result.active.length).toBe(2)
      expect(result.completed.length).toBe(2)
      expect(result.active.every(n => !n.completed)).toBe(true)
      expect(result.completed.every(n => n.completed)).toBe(true)
    })

    it('should handle all active notes', () => {
      const notes = [
        createMockTodo({ id: '1', completed: false }),
        createMockTodo({ id: '2', completed: false }),
      ]

      const result = separateNotesByStatus(notes)

      expect(result.active.length).toBe(2)
      expect(result.completed.length).toBe(0)
    })

    it('should handle all completed notes', () => {
      const notes = [
        createMockTodo({ id: '1', completed: true }),
        createMockTodo({ id: '2', completed: true }),
      ]

      const result = separateNotesByStatus(notes)

      expect(result.active.length).toBe(0)
      expect(result.completed.length).toBe(2)
    })

    it('should handle empty array', () => {
      const result = separateNotesByStatus([])

      expect(result.active).toEqual([])
      expect(result.completed).toEqual([])
    })
  })
})
