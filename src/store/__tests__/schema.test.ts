import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAppStore, generateId, now } from '../schema'

describe('generateId', () => {
  it('returns a string', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
  })

  it('returns a valid UUID format', () => {
    const id = generateId()
    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    expect(id).toMatch(uuidRegex)
  })

  it('returns unique IDs on successive calls', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 1000; i++) {
      ids.add(generateId())
    }
    expect(ids.size).toBe(1000)
  })

  it('returns 36-character string', () => {
    const id = generateId()
    expect(id.length).toBe(36)
  })
})

describe('now', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns ISO 8601 timestamp string', () => {
    const timestamp = now()
    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    expect(timestamp).toMatch(isoRegex)
  })

  it('returns current time', () => {
    const testDate = new Date('2026-01-15T10:30:00.000Z')
    vi.setSystemTime(testDate)

    const timestamp = now()
    expect(timestamp).toBe('2026-01-15T10:30:00.000Z')
  })

  it('returns different values at different times', () => {
    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))
    const t1 = now()

    vi.setSystemTime(new Date('2026-01-15T10:00:01.000Z'))
    const t2 = now()

    expect(t1).not.toBe(t2)
  })

  it('includes milliseconds', () => {
    vi.setSystemTime(new Date('2026-01-15T10:30:00.123Z'))
    const timestamp = now()
    expect(timestamp).toContain('.123Z')
  })
})

describe('createAppStore', () => {
  it('returns a store object', () => {
    const store = createAppStore()
    expect(store).toBeDefined()
    expect(typeof store.getTable).toBe('function')
    expect(typeof store.setRow).toBe('function')
  })

  it('sets default last_synced_at value to empty string', () => {
    const store = createAppStore()
    const lastSyncedAt = store.getValue('last_synced_at')
    expect(lastSyncedAt).toBe('')
  })

  it('sets default schema_version to 1', () => {
    const store = createAppStore()
    const schemaVersion = store.getValue('schema_version')
    expect(schemaVersion).toBe('1')
  })

  it('can store and retrieve notes', () => {
    const store = createAppStore()

    store.setRow('notes', 'test-1', {
      date: '2026-01-15',
      content: 'Test note',
      category: 'todo',
      completed: false,
    })

    const row = store.getRow('notes', 'test-1')
    expect(row.content).toBe('Test note')
    expect(row.category).toBe('todo')
  })

  it('can store and retrieve labels', () => {
    const store = createAppStore()

    store.setRow('labels', 'label-1', {
      name: 'Urgent',
      color: '#ff0000',
    })

    const row = store.getRow('labels', 'label-1')
    expect(row.name).toBe('Urgent')
    expect(row.color).toBe('#ff0000')
  })

  it('can store and retrieve contacts', () => {
    const store = createAppStore()

    store.setRow('contacts', 'contact-1', {
      name: 'John',
      lastname: 'Doe',
      email: 'john@example.com',
    })

    const row = store.getRow('contacts', 'contact-1')
    expect(row.name).toBe('John')
    expect(row.email).toBe('john@example.com')
  })

  it('can store and retrieve projects', () => {
    const store = createAppStore()

    store.setRow('projects', 'project-1', {
      name: 'Project A',
      status: 'active',
    })

    const row = store.getRow('projects', 'project-1')
    expect(row.name).toBe('Project A')
    expect(row.status).toBe('active')
  })

  it('can store and retrieve note_labels junction', () => {
    const store = createAppStore()

    store.setRow('note_labels', 'nl-1', {
      note_id: 'note-1',
      label_id: 'label-1',
    })

    const row = store.getRow('note_labels', 'nl-1')
    expect(row.note_id).toBe('note-1')
    expect(row.label_id).toBe('label-1')
  })

  it('returns empty object for non-existent row', () => {
    const store = createAppStore()
    const row = store.getRow('notes', 'non-existent')
    expect(row).toEqual({})
  })

  it('returns empty object for non-existent table', () => {
    const store = createAppStore()
    const table = store.getTable('non_existent_table')
    expect(table).toEqual({})
  })

  it('can update values', () => {
    const store = createAppStore()

    store.setValue('last_synced_at', '2026-01-15T10:00:00Z')
    expect(store.getValue('last_synced_at')).toBe('2026-01-15T10:00:00Z')

    store.setValue('last_synced_at', '2026-01-16T10:00:00Z')
    expect(store.getValue('last_synced_at')).toBe('2026-01-16T10:00:00Z')
  })
})
