import { describe, it, expect, vi } from 'vitest'
import { exportAllData } from '../exportService'

// Mock store factory
function createMockStore(data: {
  notes?: Record<string, Record<string, unknown>>
  note_history?: Record<string, Record<string, unknown>>
  labels?: Record<string, Record<string, unknown>>
  note_labels?: Record<string, Record<string, unknown>>
}) {
  return {
    getTable: vi.fn((tableName: string) => {
      switch (tableName) {
        case 'notes':
          return data.notes || {}
        case 'note_history':
          return data.note_history || {}
        case 'labels':
          return data.labels || {}
        case 'note_labels':
          return data.note_labels || {}
        default:
          return {}
      }
    }),
  }
}

describe('exportAllData', () => {
  it('exports notes from store', () => {
    const store = createMockStore({
      notes: {
        'note-1': {
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
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    expect(result.version).toBe('1.0')
    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].id).toBe('note-1')
    expect(result.notes[0].content).toBe('Test note')
  })

  it('filters out deleted notes', () => {
    const store = createMockStore({
      notes: {
        'note-1': {
          date: '2026-01-15',
          content: 'Active note',
          category: 'todo',
          completed: false,
          pinned: false,
          sort_order: 0,
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
          deleted_at: null,
        },
        'note-2': {
          date: '2026-01-15',
          content: 'Deleted note',
          category: 'todo',
          completed: false,
          pinned: false,
          sort_order: 1,
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
          deleted_at: '2026-01-16T00:00:00Z',
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    expect(result.notes).toHaveLength(1)
    expect(result.notes[0].content).toBe('Active note')
  })

  it('sorts notes by date descending, then sort_order ascending', () => {
    const store = createMockStore({
      notes: {
        'note-1': {
          date: '2026-01-14',
          content: 'Older note',
          category: 'todo',
          completed: false,
          pinned: false,
          sort_order: 0,
          created_at: '2026-01-14T00:00:00Z',
          updated_at: '2026-01-14T00:00:00Z',
          deleted_at: null,
        },
        'note-2': {
          date: '2026-01-15',
          content: 'Newer note, second',
          category: 'todo',
          completed: false,
          pinned: false,
          sort_order: 1,
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
          deleted_at: null,
        },
        'note-3': {
          date: '2026-01-15',
          content: 'Newer note, first',
          category: 'todo',
          completed: false,
          pinned: false,
          sort_order: 0,
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
          deleted_at: null,
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    expect(result.notes).toHaveLength(3)
    expect(result.notes[0].content).toBe('Newer note, first')
    expect(result.notes[1].content).toBe('Newer note, second')
    expect(result.notes[2].content).toBe('Older note')
  })

  it('exports note history sorted by changed_at descending', () => {
    const store = createMockStore({
      note_history: {
        'hist-1': {
          note_id: 'note-1',
          content: 'First version',
          description: null,
          category: 'todo',
          completed: false,
          changed_at: '2026-01-14T00:00:00Z',
          action_type: 'created',
          reason: null,
          previous_date: null,
        },
        'hist-2': {
          note_id: 'note-1',
          content: 'Second version',
          description: null,
          category: 'todo',
          completed: false,
          changed_at: '2026-01-15T00:00:00Z',
          action_type: 'edit',
          reason: null,
          previous_date: null,
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    expect(result.noteHistory).toHaveLength(2)
    expect(result.noteHistory[0].content).toBe('Second version')
    expect(result.noteHistory[1].content).toBe('First version')
  })

  it('exports labels sorted by name ascending', () => {
    const store = createMockStore({
      labels: {
        'label-1': {
          name: 'Zebra',
          color: '#000000',
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
          deleted_at: null,
        },
        'label-2': {
          name: 'Alpha',
          color: '#ffffff',
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
          deleted_at: null,
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    expect(result.labels).toHaveLength(2)
    expect(result.labels![0].name).toBe('Alpha')
    expect(result.labels![1].name).toBe('Zebra')
  })

  it('filters out deleted labels', () => {
    const store = createMockStore({
      labels: {
        'label-1': {
          name: 'Active',
          color: '#ffffff',
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
          deleted_at: null,
        },
        'label-2': {
          name: 'Deleted',
          color: '#000000',
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
          deleted_at: '2026-01-16T00:00:00Z',
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    expect(result.labels).toHaveLength(1)
    expect(result.labels![0].name).toBe('Active')
  })

  it('exports note-label relationships', () => {
    const store = createMockStore({
      note_labels: {
        'nl-1': {
          note_id: 'note-1',
          label_id: 'label-1',
          created_at: '2026-01-15T00:00:00Z',
        },
        'nl-2': {
          note_id: 'note-1',
          label_id: 'label-2',
          created_at: '2026-01-15T00:00:00Z',
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    expect(result.noteLabels).toHaveLength(2)
    expect(result.noteLabels![0].note_id).toBe('note-1')
    expect(result.noteLabels![0].label_id).toBe('label-1')
  })

  it('includes exportedAt timestamp', () => {
    const store = createMockStore({})
    const before = new Date()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    const after = new Date()
    const exportedAt = new Date(result.exportedAt)

    expect(exportedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(exportedAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('handles empty tables gracefully', () => {
    const store = createMockStore({})

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    expect(result.version).toBe('1.0')
    expect(result.notes).toEqual([])
    expect(result.noteHistory).toEqual([])
    expect(result.labels).toEqual([])
    expect(result.noteLabels).toEqual([])
  })

  it('preserves deleted_reason in exported notes', () => {
    const store = createMockStore({
      notes: {
        'note-1': {
          date: '2026-01-15',
          content: 'Test note',
          category: 'todo',
          completed: false,
          pinned: false,
          sort_order: 0,
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
          deleted_at: null,
          deleted_reason: null,
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    expect(result.notes[0]).toHaveProperty('deleted_reason')
    expect(result.notes[0].deleted_reason).toBeNull()
  })

  it('includes assignee_id and project_id in exported notes', () => {
    const store = createMockStore({
      notes: {
        'note-1': {
          date: '2026-01-15',
          content: 'Test note',
          category: 'todo',
          completed: false,
          pinned: false,
          sort_order: 0,
          created_at: '2026-01-15T00:00:00Z',
          updated_at: '2026-01-15T00:00:00Z',
          deleted_at: null,
          assignee_id: 'contact-1',
          project_id: 'project-1',
        },
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = exportAllData(store as any)

    expect(result.notes[0].assignee_id).toBe('contact-1')
    expect(result.notes[0].project_id).toBe('project-1')
  })
})
