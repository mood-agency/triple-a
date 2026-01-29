import { describe, it, expect } from 'vitest'
import { validateImportData } from '../dataValidation'

function makeValidExportData() {
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
        pinned: false,
        sort_order: 0,
        created_at: '2026-01-15T00:00:00Z',
        updated_at: '2026-01-15T00:00:00Z',
      },
    ],
    noteHistory: [
      {
        id: 'hist-1',
        note_id: 'note-1',
        content: 'Test note',
        description: null,
        category: 'todo',
        completed: false,
        changed_at: '2026-01-15T00:00:00Z',
        action_type: 'created',
      },
    ],
  }
}

describe('validateImportData', () => {
  it('accepts valid export data', () => {
    expect(validateImportData(makeValidExportData())).toBe(true)
  })

  it('rejects null', () => {
    expect(validateImportData(null)).toBe(false)
  })

  it('rejects undefined', () => {
    expect(validateImportData(undefined)).toBe(false)
  })

  it('rejects non-object', () => {
    expect(validateImportData('string')).toBe(false)
  })

  it('rejects missing version', () => {
    const data = makeValidExportData()
    delete (data as Record<string, unknown>).version
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects non-string version', () => {
    const data = makeValidExportData() as Record<string, unknown>
    data.version = 123
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects missing exportedAt', () => {
    const data = makeValidExportData()
    delete (data as Record<string, unknown>).exportedAt
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects non-array notes', () => {
    const data = makeValidExportData() as Record<string, unknown>
    data.notes = 'not an array'
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects non-array noteHistory', () => {
    const data = makeValidExportData() as Record<string, unknown>
    data.noteHistory = 'not an array'
    expect(validateImportData(data)).toBe(false)
  })

  it('accepts empty notes array', () => {
    const data = makeValidExportData()
    data.notes = []
    expect(validateImportData(data)).toBe(true)
  })

  it('rejects note with missing id', () => {
    const data = makeValidExportData()
    delete (data.notes[0] as Record<string, unknown>).id
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects note with missing date', () => {
    const data = makeValidExportData()
    delete (data.notes[0] as Record<string, unknown>).date
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects note with missing content', () => {
    const data = makeValidExportData()
    delete (data.notes[0] as Record<string, unknown>).content
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects note with invalid category', () => {
    const data = makeValidExportData();
    (data.notes[0] as Record<string, unknown>).category = 'invalid'
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects note with non-boolean completed', () => {
    const data = makeValidExportData();
    (data.notes[0] as Record<string, unknown>).completed = 'yes'
    expect(validateImportData(data)).toBe(false)
  })

  it('accepts note with null description', () => {
    const data = makeValidExportData()
    data.notes[0].description = null
    expect(validateImportData(data)).toBe(true)
  })

  it('rejects note with invalid description type', () => {
    const data = makeValidExportData();
    (data.notes[0] as Record<string, unknown>).description = 123
    expect(validateImportData(data)).toBe(false)
  })

  it('accepts valid labels', () => {
    const data = makeValidExportData() as Record<string, unknown>
    data.labels = [{
      id: 'label-1',
      name: 'urgent',
      color: '#ff0000',
      created_at: '2026-01-15T00:00:00Z',
      updated_at: '2026-01-15T00:00:00Z',
    }]
    expect(validateImportData(data)).toBe(true)
  })

  it('rejects label with missing name', () => {
    const data = makeValidExportData() as Record<string, unknown>
    data.labels = [{ id: 'l1', color: '#fff', created_at: '', updated_at: '' }]
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects non-array labels', () => {
    const data = makeValidExportData() as Record<string, unknown>
    data.labels = 'not array'
    expect(validateImportData(data)).toBe(false)
  })

  it('accepts valid noteLabels', () => {
    const data = makeValidExportData() as Record<string, unknown>
    data.noteLabels = [{
      note_id: 'note-1',
      label_id: 'label-1',
      created_at: '2026-01-15T00:00:00Z',
    }]
    expect(validateImportData(data)).toBe(true)
  })

  it('rejects noteLabel with missing note_id', () => {
    const data = makeValidExportData() as Record<string, unknown>
    data.noteLabels = [{ label_id: 'l1', created_at: '' }]
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects non-array noteLabels', () => {
    const data = makeValidExportData() as Record<string, unknown>
    data.noteLabels = 'invalid'
    expect(validateImportData(data)).toBe(false)
  })

  it('accepts history with old format (numeric category)', () => {
    const data = makeValidExportData();
    (data.noteHistory[0] as Record<string, unknown>).category = 0;
    (data.noteHistory[0] as Record<string, unknown>).completed = 0
    expect(validateImportData(data)).toBe(true)
  })

  it('rejects history entry with missing note_id', () => {
    const data = makeValidExportData()
    delete (data.noteHistory[0] as Record<string, unknown>).note_id
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects history entry with missing content', () => {
    const data = makeValidExportData()
    delete (data.noteHistory[0] as Record<string, unknown>).content
    expect(validateImportData(data)).toBe(false)
  })

  it('rejects history entry with missing changed_at', () => {
    const data = makeValidExportData()
    delete (data.noteHistory[0] as Record<string, unknown>).changed_at
    expect(validateImportData(data)).toBe(false)
  })

  it('accepts note with optional deadline as null', () => {
    const data = makeValidExportData();
    (data.notes[0] as Record<string, unknown>).deadline = null
    expect(validateImportData(data)).toBe(true)
  })

  it('rejects note with invalid deadline type', () => {
    const data = makeValidExportData();
    (data.notes[0] as Record<string, unknown>).deadline = 12345
    expect(validateImportData(data)).toBe(false)
  })

  it('accepts note with optional pinned field', () => {
    const data = makeValidExportData();
    (data.notes[0] as Record<string, unknown>).pinned = true
    expect(validateImportData(data)).toBe(true)
  })

  it('rejects note with invalid pinned type', () => {
    const data = makeValidExportData();
    (data.notes[0] as Record<string, unknown>).pinned = 'yes'
    expect(validateImportData(data)).toBe(false)
  })

  it('accepts note with valid followup category', () => {
    const data = makeValidExportData()
    data.notes[0].category = 'followup' as 'todo'
    expect(validateImportData(data)).toBe(true)
  })

  it('accepts note with valid notes category', () => {
    const data = makeValidExportData()
    data.notes[0].category = 'notes' as 'todo'
    expect(validateImportData(data)).toBe(true)
  })
})
