import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for SupabaseDataSync helper logic
 *
 * Since the full class depends on Supabase client and MergeableStore,
 * these tests verify the core logic patterns used in sync operations
 * using mock stores and isolated function testing.
 */

// Mock store factory
function createMockStore(initialData: Record<string, Record<string, Record<string, unknown>>> = {}) {
  const tables: Record<string, Record<string, Record<string, unknown>>> = { ...initialData }
  const values: Record<string, unknown> = {}

  return {
    getTable: vi.fn((tableName: string) => tables[tableName] || {}),
    getRow: vi.fn((tableName: string, id: string) => tables[tableName]?.[id] || {}),
    setRow: vi.fn((tableName: string, id: string, data: Record<string, unknown>) => {
      if (!tables[tableName]) tables[tableName] = {}
      tables[tableName][id] = data
    }),
    setPartialRow: vi.fn((tableName: string, id: string, data: Record<string, unknown>) => {
      if (!tables[tableName]) tables[tableName] = {}
      if (!tables[tableName][id]) tables[tableName][id] = {}
      tables[tableName][id] = { ...tables[tableName][id], ...data }
    }),
    setCell: vi.fn((tableName: string, id: string, key: string, value: unknown) => {
      if (!tables[tableName]) tables[tableName] = {}
      if (!tables[tableName][id]) tables[tableName][id] = {}
      tables[tableName][id][key] = value
    }),
    getValue: vi.fn((key: string) => values[key]),
    setValue: vi.fn((key: string, value: unknown) => {
      values[key] = value
    }),
    startTransaction: vi.fn(),
    finishTransaction: vi.fn(),
    _tables: tables,
    _values: values,
  }
}

describe('Remote ID Cache building', () => {
  it('builds cache from rows with remote_id', () => {
    const store = createMockStore({
      notes: {
        'local-1': { content: 'Note 1', remote_id: 'remote-1' },
        'local-2': { content: 'Note 2', remote_id: 'remote-2' },
        'local-3': { content: 'Note 3', remote_id: null },
      },
    })

    // Simulate buildRemoteIdCache logic
    const cache = new Map<string, string>()
    const table = store.getTable('notes')
    for (const [localId, row] of Object.entries(table)) {
      const remoteId = (row as Record<string, unknown>).remote_id as string | undefined
      if (remoteId) {
        cache.set(remoteId, localId)
      }
    }

    expect(cache.size).toBe(2)
    expect(cache.get('remote-1')).toBe('local-1')
    expect(cache.get('remote-2')).toBe('local-2')
    expect(cache.has('remote-3')).toBe(false)
  })

  it('handles empty table', () => {
    const store = createMockStore({})
    const cache = new Map<string, string>()
    const table = store.getTable('notes')
    for (const [localId, row] of Object.entries(table)) {
      const remoteId = (row as Record<string, unknown>).remote_id as string | undefined
      if (remoteId) {
        cache.set(remoteId, localId)
      }
    }

    expect(cache.size).toBe(0)
  })
})

describe('Find local ID by remote ID', () => {
  it('finds local ID from cache', () => {
    const cache = new Map<string, string>([
      ['remote-1', 'local-1'],
      ['remote-2', 'local-2'],
    ])

    expect(cache.get('remote-1')).toBe('local-1')
    expect(cache.get('remote-2')).toBe('local-2')
    expect(cache.get('remote-3')).toBeUndefined()
  })

  it('falls back to linear scan when cache miss', () => {
    const store = createMockStore({
      notes: {
        'local-1': { content: 'Note 1', remote_id: 'remote-1' },
        'local-2': { content: 'Note 2', remote_id: 'remote-2' },
      },
    })

    // Simulate fallback linear scan
    function findLocalIdByRemoteId(tableName: string, remoteId: string): string | null {
      const table = store.getTable(tableName)
      for (const [localId, row] of Object.entries(table)) {
        if ((row as Record<string, unknown>).remote_id === remoteId) {
          return localId
        }
      }
      return null
    }

    expect(findLocalIdByRemoteId('notes', 'remote-1')).toBe('local-1')
    expect(findLocalIdByRemoteId('notes', 'remote-2')).toBe('local-2')
    expect(findLocalIdByRemoteId('notes', 'remote-3')).toBeNull()
  })
})

describe('Prepare data for Supabase', () => {
  it('removes local-only fields', () => {
    const row = {
      content: 'Test note',
      date: '2026-01-15',
      remote_id: 'remote-1',
      sync_status: 'pending',
      last_synced_at: '2026-01-14T00:00:00Z',
    }

    // Simulate prepareForSupabase logic
    const data = { ...row }
    delete data.remote_id
    delete data.sync_status
    delete data.last_synced_at

    expect(data).toEqual({
      content: 'Test note',
      date: '2026-01-15',
    })
    expect(data).not.toHaveProperty('remote_id')
    expect(data).not.toHaveProperty('sync_status')
    expect(data).not.toHaveProperty('last_synced_at')
  })

  it('maps assignee_id foreign key from local to remote', () => {
    const store = createMockStore({
      contacts: {
        'contact-local-1': { name: 'John', remote_id: 'contact-remote-1' },
      },
    })

    const noteRow = {
      content: 'Test note',
      assignee_id: 'contact-local-1',
    }

    // Simulate foreign key mapping
    const data = { ...noteRow }
    if (data.assignee_id) {
      const contact = store.getRow('contacts', data.assignee_id as string)
      if (contact?.remote_id) {
        data.assignee_id = contact.remote_id as string
      } else {
        data.assignee_id = null
      }
    }

    expect(data.assignee_id).toBe('contact-remote-1')
  })

  it('clears assignee_id if contact has no remote_id', () => {
    const store = createMockStore({
      contacts: {
        'contact-local-1': { name: 'John', remote_id: null },
      },
    })

    const noteRow = {
      content: 'Test note',
      assignee_id: 'contact-local-1',
    }

    const data = { ...noteRow }
    if (data.assignee_id) {
      const contact = store.getRow('contacts', data.assignee_id as string)
      if (contact?.remote_id) {
        data.assignee_id = contact.remote_id as string
      } else {
        data.assignee_id = null
      }
    }

    expect(data.assignee_id).toBeNull()
  })

  it('maps project_id foreign key', () => {
    const store = createMockStore({
      projects: {
        'project-local-1': { name: 'Project A', remote_id: 'project-remote-1' },
      },
    })

    const noteRow = {
      content: 'Test note',
      project_id: 'project-local-1',
    }

    const data = { ...noteRow }
    if (data.project_id) {
      const project = store.getRow('projects', data.project_id as string)
      if (project?.remote_id) {
        data.project_id = project.remote_id as string
      } else {
        data.project_id = null
      }
    }

    expect(data.project_id).toBe('project-remote-1')
  })

  it('maps note_labels foreign keys', () => {
    const store = createMockStore({
      notes: {
        'note-local-1': { content: 'Note', remote_id: 'note-remote-1' },
      },
      labels: {
        'label-local-1': { name: 'Urgent', remote_id: 'label-remote-1' },
      },
    })

    const noteLabelRow = {
      note_id: 'note-local-1',
      label_id: 'label-local-1',
    }

    const data = { ...noteLabelRow }
    const note = store.getRow('notes', data.note_id as string)
    const label = store.getRow('labels', data.label_id as string)
    if (note?.remote_id) data.note_id = note.remote_id as string
    if (label?.remote_id) data.label_id = label.remote_id as string

    expect(data.note_id).toBe('note-remote-1')
    expect(data.label_id).toBe('label-remote-1')
  })
})

describe('Map data from Supabase', () => {
  it('removes Supabase-specific fields', () => {
    const remoteRow = {
      id: 'remote-1',
      user_id: 'user-123',
      content: 'Test note',
      date: '2026-01-15',
    }

    const data = { ...remoteRow }
    delete (data as Record<string, unknown>).id
    delete (data as Record<string, unknown>).user_id

    expect(data).toEqual({
      content: 'Test note',
      date: '2026-01-15',
    })
  })

  it('maps assignee_id from remote to local', () => {
    // Build remote ID cache
    const cache = new Map<string, string>([
      ['contact-remote-1', 'contact-local-1'],
    ])

    const remoteRow = {
      content: 'Test note',
      assignee_id: 'contact-remote-1',
    }

    const data = { ...remoteRow }
    if (data.assignee_id) {
      const localContactId = cache.get(data.assignee_id as string)
      data.assignee_id = localContactId || null
    }

    expect(data.assignee_id).toBe('contact-local-1')
  })

  it('clears assignee_id if no local mapping exists', () => {
    const cache = new Map<string, string>()

    const remoteRow = {
      content: 'Test note',
      assignee_id: 'contact-remote-unknown',
    }

    const data = { ...remoteRow }
    if (data.assignee_id) {
      const localContactId = cache.get(data.assignee_id as string)
      data.assignee_id = localContactId || null
    }

    expect(data.assignee_id).toBeNull()
  })
})

describe('Mark row as synced', () => {
  it('sets sync_status and last_synced_at', () => {
    const store = createMockStore({
      notes: {
        'note-1': { content: 'Test', sync_status: 'pending' },
      },
    })

    // Simulate markSynced
    store.setPartialRow('notes', 'note-1', {
      sync_status: 'synced',
      last_synced_at: '2026-01-15T00:00:00Z',
    })

    expect(store.setPartialRow).toHaveBeenCalledWith('notes', 'note-1', {
      sync_status: 'synced',
      last_synced_at: '2026-01-15T00:00:00Z',
    })
  })
})

describe('Merge remote row logic', () => {
  it('updates existing row when remote is newer and local not pending', () => {
    const localRow = {
      content: 'Old content',
      updated_at: '2026-01-14T00:00:00Z',
      sync_status: 'synced',
      remote_id: 'remote-1',
    }
    const remoteRow = {
      content: 'New content',
      updated_at: '2026-01-15T00:00:00Z',
    }

    const localUpdatedAt = new Date(localRow.updated_at)
    const remoteUpdatedAt = new Date(remoteRow.updated_at)
    const shouldUpdate = remoteUpdatedAt > localUpdatedAt && localRow.sync_status !== 'pending'

    expect(shouldUpdate).toBe(true)
  })

  it('does not update when local has pending changes', () => {
    const localRow = {
      content: 'Local changes',
      updated_at: '2026-01-14T00:00:00Z',
      sync_status: 'pending',
      remote_id: 'remote-1',
    }
    const remoteRow = {
      content: 'Remote content',
      updated_at: '2026-01-15T00:00:00Z',
    }

    const localUpdatedAt = new Date(localRow.updated_at)
    const remoteUpdatedAt = new Date(remoteRow.updated_at)
    const shouldUpdate = remoteUpdatedAt > localUpdatedAt && localRow.sync_status !== 'pending'

    expect(shouldUpdate).toBe(false)
  })

  it('does not update when local is newer', () => {
    const localRow = {
      content: 'Newer local',
      updated_at: '2026-01-16T00:00:00Z',
      sync_status: 'synced',
      remote_id: 'remote-1',
    }
    const remoteRow = {
      content: 'Older remote',
      updated_at: '2026-01-15T00:00:00Z',
    }

    const localUpdatedAt = new Date(localRow.updated_at)
    const remoteUpdatedAt = new Date(remoteRow.updated_at)
    const shouldUpdate = remoteUpdatedAt > localUpdatedAt && localRow.sync_status !== 'pending'

    expect(shouldUpdate).toBe(false)
  })
})

describe('Corrupt data repair', () => {
  it('repairs note with missing date using created_at', () => {
    const row = {
      content: 'Test note',
      created_at: '2026-01-15T10:30:00Z',
      date: undefined,
    }

    // Simulate repair logic
    let repairedDate: string | undefined
    if (!row.date) {
      repairedDate = row.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)
    }

    expect(repairedDate).toBe('2026-01-15')
  })

  it('repairs note with missing date using current date as fallback', () => {
    const row = {
      content: 'Test note',
      created_at: undefined,
      date: undefined,
    }

    const today = new Date().toISOString().slice(0, 10)

    let repairedDate: string | undefined
    if (!row.date) {
      repairedDate = row.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10)
    }

    expect(repairedDate).toBe(today)
  })
})

describe('Pending rows filtering', () => {
  it('filters rows with local or pending sync_status', () => {
    const table = {
      'note-1': { content: 'Note 1', sync_status: 'local' },
      'note-2': { content: 'Note 2', sync_status: 'pending' },
      'note-3': { content: 'Note 3', sync_status: 'synced' },
      'note-4': { content: 'Note 4', sync_status: 'conflict' },
    }

    const rows = Object.entries(table)
    const pendingRows = rows.filter(([, row]) => {
      const syncStatus = row.sync_status
      return syncStatus === 'local' || syncStatus === 'pending'
    })

    expect(pendingRows.length).toBe(2)
    expect(pendingRows.map(([id]) => id)).toEqual(['note-1', 'note-2'])
  })
})

describe('Junction table deduplication', () => {
  it('detects existing note_label by composite key', () => {
    const table = {
      'note-1_label-1': { note_id: 'note-1', label_id: 'label-1' },
      'note-1_label-2': { note_id: 'note-1', label_id: 'label-2' },
    }

    const newRow = { note_id: 'note-1', label_id: 'label-1' }

    const exists = Object.values(table).some(
      (row) => row.note_id === newRow.note_id && row.label_id === newRow.label_id
    )

    expect(exists).toBe(true)
  })

  it('allows new note_label with different composite key', () => {
    const table = {
      'note-1_label-1': { note_id: 'note-1', label_id: 'label-1' },
    }

    const newRow = { note_id: 'note-1', label_id: 'label-3' }

    const exists = Object.values(table).some(
      (row) => row.note_id === newRow.note_id && row.label_id === newRow.label_id
    )

    expect(exists).toBe(false)
  })

  it('generates consistent ID for junction table rows', () => {
    const noteId = 'note-123'
    const labelId = 'label-456'

    const localId = `${noteId}-${labelId}`

    expect(localId).toBe('note-123-label-456')
  })
})

describe('Sync concurrency guard', () => {
  it('prevents concurrent sync operations', () => {
    let isSyncing = false

    function startSync(): boolean {
      if (isSyncing) return false
      isSyncing = true
      return true
    }

    function finishSync(): void {
      isSyncing = false
    }

    expect(startSync()).toBe(true)
    expect(startSync()).toBe(false) // Should be blocked
    finishSync()
    expect(startSync()).toBe(true) // Should work again
  })
})

describe('Incremental sync timestamp filtering', () => {
  it('uses updated_at for standard tables', () => {
    const tableName = 'notes'
    const useCreatedAt = ['note_versions', 'note_actions', 'note_labels', 'note_assignees'].includes(tableName)

    expect(useCreatedAt).toBe(false)
  })

  it('uses created_at for junction/history tables', () => {
    const junctionTables = ['note_versions', 'note_actions', 'note_labels', 'note_assignees']

    for (const tableName of junctionTables) {
      const useCreatedAt = junctionTables.includes(tableName)
      expect(useCreatedAt).toBe(true)
    }
  })
})
