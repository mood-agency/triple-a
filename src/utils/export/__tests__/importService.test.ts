import { describe, it, expect, vi, beforeEach } from 'vitest'
import { importData } from '../importService'
import type { ExportData } from '@/types/note'

// Mock MergeableStore
function createMockStore() {
  const tables: Record<string, Record<string, Record<string, unknown>>> = {}

  return {
    getRow: vi.fn((table: string, id: string) => {
      return tables[table]?.[id] || {}
    }),
    setRow: vi.fn((table: string, id: string, data: Record<string, unknown>) => {
      if (!tables[table]) tables[table] = {}
      tables[table][id] = data
    }),
    // Expose tables for assertions
    _tables: tables,
  }
}

function makeValidExportData(overrides: Partial<ExportData> = {}): ExportData {
  return {
    version: '1.0',
    exportedAt: '2026-01-15T00:00:00Z',
    notes: [
      {
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
      },
    ],
    noteHistory: [],
    ...overrides,
  }
}

describe('importData', () => {
  it('imports notes into the store', async () => {
    const store = createMockStore()
    const data = makeValidExportData()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await importData(store as any, data)

    expect(result.success).toBe(true)
    expect(result.notesImported).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(store.setRow).toHaveBeenCalledWith(
      'notes',
      'note-1',
      expect.objectContaining({
        content: 'Test note',
        category: 'todo',
        sync_status: 'pending',
      })
    )
  })

  it('updates existing notes', async () => {
    const store = createMockStore()
    // Pre-populate with existing note
    store._tables['notes'] = {
      'note-1': { content: 'Old content', id: 'note-1' },
    }
    store.getRow.mockImplementation((table: string, id: string) => {
      return store._tables[table]?.[id] || {}
    })

    const data = makeValidExportData()
    data.notes[0].content = 'Updated content'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await importData(store as any, data)

    expect(result.notesImported).toBe(1)
    // Should have been called with updated content
    expect(store.setRow).toHaveBeenCalledWith(
      'notes',
      'note-1',
      expect.objectContaining({ content: 'Updated content' })
    )
  })

  it('uses current date when useCurrentDate option is set', async () => {
    const store = createMockStore()
    const data = makeValidExportData()
    const today = new Date().toISOString().split('T')[0]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await importData(store as any, data, { useCurrentDate: true })

    expect(store.setRow).toHaveBeenCalledWith(
      'notes',
      'note-1',
      expect.objectContaining({ date: today })
    )
  })

  it('preserves original date when useCurrentDate is not set', async () => {
    const store = createMockStore()
    const data = makeValidExportData()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await importData(store as any, data)

    expect(store.setRow).toHaveBeenCalledWith(
      'notes',
      'note-1',
      expect.objectContaining({ date: '2026-01-15' })
    )
  })

  it('imports multiple notes', async () => {
    const store = createMockStore()
    const data = makeValidExportData()
    data.notes.push({
      ...data.notes[0],
      id: 'note-2',
      content: 'Second note',
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await importData(store as any, data)

    expect(result.notesImported).toBe(2)
  })

  it('imports labels', async () => {
    const store = createMockStore()
    const data = makeValidExportData({
      labels: [{
        id: 'label-1',
        name: 'urgent',
        color: '#ff0000',
        created_at: '2026-01-15T00:00:00Z',
        updated_at: '2026-01-15T00:00:00Z',
      }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await importData(store as any, data)

    expect(store.setRow).toHaveBeenCalledWith(
      'labels',
      'label-1',
      expect.objectContaining({
        name: 'urgent',
        color: '#ff0000',
        sync_status: 'pending',
      })
    )
  })

  it('imports note-label relationships', async () => {
    const store = createMockStore()
    const data = makeValidExportData({
      noteLabels: [{
        note_id: 'note-1',
        label_id: 'label-1',
        created_at: '2026-01-15T00:00:00Z',
      }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await importData(store as any, data)

    expect(store.setRow).toHaveBeenCalledWith(
      'note_labels',
      'note-1_label-1',
      expect.objectContaining({
        note_id: 'note-1',
        label_id: 'label-1',
      })
    )
  })

  it('imports legacy note history', async () => {
    const store = createMockStore()
    const data = makeValidExportData({
      noteHistory: [{
        id: 'hist-1',
        note_id: 'note-1',
        content: 'Original content',
        description: null,
        category: 'todo',
        completed: false,
        changed_at: '2026-01-14T00:00:00Z',
        action_type: 'created',
        reason: null,
        previous_date: null,
      }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await importData(store as any, data)

    expect(result.historyImported).toBe(1)
    expect(store.setRow).toHaveBeenCalledWith(
      'note_history',
      'hist-1',
      expect.objectContaining({
        note_id: 'note-1',
        content: 'Original content',
        action_type: 'created',
      })
    )
  })

  it('migrates old history format with shifted fields', async () => {
    const store = createMockStore()
    // Old format: description contains category, category contains completed (as number)
    const data = makeValidExportData({
      noteHistory: [{
        id: 'hist-1',
        note_id: 'note-1',
        content: 'Content',
        description: 'followup' as unknown as null,
        category: 1 as unknown as 'todo',
        completed: false,
        changed_at: '2026-01-14T00:00:00Z',
        action_type: 'edit',
        reason: null,
        previous_date: null,
      }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await importData(store as any, data)

    expect(result.historyImported).toBe(1)
    // Should have migrated: category should be 'followup', completed should be true (1)
    expect(store.setRow).toHaveBeenCalledWith(
      'note_history',
      'hist-1',
      expect.objectContaining({
        category: 'followup',
        completed: true,
        description: null,
      })
    )
  })

  it('skips duplicate history entries', async () => {
    const store = createMockStore()
    // Pre-populate existing history
    store._tables['note_history'] = {
      'hist-1': { id: 'hist-1', note_id: 'note-1' },
    }
    store.getRow.mockImplementation((table: string, id: string) => {
      return store._tables[table]?.[id] || {}
    })

    const data = makeValidExportData({
      noteHistory: [{
        id: 'hist-1',
        note_id: 'note-1',
        content: 'Content',
        description: null,
        category: 'todo',
        completed: false,
        changed_at: '2026-01-14T00:00:00Z',
        action_type: 'created',
        reason: null,
        previous_date: null,
      }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await importData(store as any, data)

    // History should not be imported since it already exists
    expect(result.historyImported).toBe(0)
  })

  it('skips duplicate note-label relationships', async () => {
    const store = createMockStore()
    store._tables['note_labels'] = {
      'note-1_label-1': { note_id: 'note-1', label_id: 'label-1' },
    }
    store.getRow.mockImplementation((table: string, id: string) => {
      return store._tables[table]?.[id] || {}
    })

    const data = makeValidExportData({
      noteLabels: [{
        note_id: 'note-1',
        label_id: 'label-1',
        created_at: '2026-01-15T00:00:00Z',
      }],
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await importData(store as any, data)

    // setRow for note_labels should not have been called (excluding notes)
    const noteLabelCalls = store.setRow.mock.calls.filter(
      (call: unknown[]) => call[0] === 'note_labels'
    )
    expect(noteLabelCalls).toHaveLength(0)
  })

  it('handles empty export data', async () => {
    const store = createMockStore()
    const data = makeValidExportData({ notes: [], noteHistory: [] })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await importData(store as any, data)

    expect(result.success).toBe(true)
    expect(result.notesImported).toBe(0)
    expect(result.historyImported).toBe(0)
  })

  it('sets sync_status to pending for new notes', async () => {
    const store = createMockStore()
    const data = makeValidExportData()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await importData(store as any, data)

    expect(store.setRow).toHaveBeenCalledWith(
      'notes',
      'note-1',
      expect.objectContaining({ sync_status: 'pending' })
    )
  })

  it('sets remote_id to null for imported notes', async () => {
    const store = createMockStore()
    const data = makeValidExportData()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await importData(store as any, data)

    expect(store.setRow).toHaveBeenCalledWith(
      'notes',
      'note-1',
      expect.objectContaining({ remote_id: null })
    )
  })

  it('handles null description gracefully', async () => {
    const store = createMockStore()
    const data = makeValidExportData()
    data.notes[0].description = null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await importData(store as any, data)

    expect(result.success).toBe(true)
    expect(store.setRow).toHaveBeenCalledWith(
      'notes',
      'note-1',
      expect.objectContaining({ description: null })
    )
  })
})
