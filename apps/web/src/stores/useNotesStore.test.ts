import { describe, it, expect, beforeEach } from 'vitest'
import { useNotesStore } from './useNotesStore'
import { createMockNote, createMockTodo } from '@tests/mocks/data/notes'

// Reset store between tests
beforeEach(() => {
  useNotesStore.setState({
    notes: [],
    loading: true,
    pendingNoteIds: new Set(),
    currentDate: undefined,
    currentProjectId: undefined,
  })
})

describe('useNotesStore', () => {
  // ---------------------------------------------------------------------------
  // Basic setters
  // ---------------------------------------------------------------------------
  describe('setLoading', () => {
    it('should set loading to false', () => {
      useNotesStore.getState().setLoading(false)
      expect(useNotesStore.getState().loading).toBe(false)
    })

    it('should set loading to true', () => {
      useNotesStore.getState().setLoading(false)
      useNotesStore.getState().setLoading(true)
      expect(useNotesStore.getState().loading).toBe(true)
    })
  })

  describe('setScope', () => {
    it('should set date and projectId', () => {
      useNotesStore.getState().setScope('2026-02-06', 'project-1')
      const state = useNotesStore.getState()
      expect(state.currentDate).toBe('2026-02-06')
      expect(state.currentProjectId).toBe('project-1')
    })

    it('should set projectId to null for inbox', () => {
      useNotesStore.getState().setScope('2026-02-06', null)
      expect(useNotesStore.getState().currentProjectId).toBeNull()
    })

    it('should set both to undefined', () => {
      useNotesStore.getState().setScope(undefined, undefined)
      const state = useNotesStore.getState()
      expect(state.currentDate).toBeUndefined()
      expect(state.currentProjectId).toBeUndefined()
    })
  })

  // ---------------------------------------------------------------------------
  // addNote
  // ---------------------------------------------------------------------------
  describe('addNote', () => {
    it('should add a note to the list', () => {
      const note = createMockTodo({ id: 'new-1', content: 'New task' })
      useNotesStore.getState().addNote(note)

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(1)
      expect(state.notes[0].id).toBe('new-1')
    })

    it('should mark the note as pending', () => {
      const note = createMockTodo({ id: 'new-1' })
      useNotesStore.getState().addNote(note)

      expect(useNotesStore.getState().pendingNoteIds.has('new-1')).toBe(true)
    })

    it('should append to existing notes', () => {
      const note1 = createMockTodo({ id: 'existing-1' })
      const note2 = createMockTodo({ id: 'new-2' })

      useNotesStore.getState().addNote(note1)
      useNotesStore.getState().addNote(note2)

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(2)
      expect(state.notes[0].id).toBe('existing-1')
      expect(state.notes[1].id).toBe('new-2')
      expect(state.pendingNoteIds.size).toBe(2)
    })
  })

  // ---------------------------------------------------------------------------
  // removeNote
  // ---------------------------------------------------------------------------
  describe('removeNote', () => {
    it('should remove a note from the list', () => {
      const note = createMockTodo({ id: 'to-remove' })
      useNotesStore.setState({ notes: [note] })

      useNotesStore.getState().removeNote('to-remove')

      expect(useNotesStore.getState().notes).toHaveLength(0)
    })

    it('should not affect other notes', () => {
      const note1 = createMockTodo({ id: 'keep-1' })
      const note2 = createMockTodo({ id: 'remove-2' })
      const note3 = createMockTodo({ id: 'keep-3' })
      useNotesStore.setState({ notes: [note1, note2, note3] })

      useNotesStore.getState().removeNote('remove-2')

      const ids = useNotesStore.getState().notes.map(n => n.id)
      expect(ids).toEqual(['keep-1', 'keep-3'])
    })

    it('should also remove the id from pendingNoteIds', () => {
      const note = createMockTodo({ id: 'pending-1' })
      useNotesStore.setState({
        notes: [note],
        pendingNoteIds: new Set(['pending-1']),
      })

      useNotesStore.getState().removeNote('pending-1')

      expect(useNotesStore.getState().pendingNoteIds.has('pending-1')).toBe(false)
      expect(useNotesStore.getState().pendingNoteIds.size).toBe(0)
    })

    it('should handle removing non-existent note gracefully', () => {
      const note = createMockTodo({ id: 'exists' })
      useNotesStore.setState({ notes: [note] })

      useNotesStore.getState().removeNote('does-not-exist')

      expect(useNotesStore.getState().notes).toHaveLength(1)
    })
  })

  // ---------------------------------------------------------------------------
  // updateNote
  // ---------------------------------------------------------------------------
  describe('updateNote', () => {
    it('should update a note content', () => {
      const note = createMockTodo({ id: 'update-1', content: 'Original' })
      useNotesStore.setState({ notes: [note] })

      useNotesStore.getState().updateNote('update-1', { content: 'Updated' })

      expect(useNotesStore.getState().notes[0].content).toBe('Updated')
    })

    it('should partially update a note', () => {
      const note = createMockTodo({
        id: 'update-1',
        content: 'Original',
        pinned: false,
      })
      useNotesStore.setState({ notes: [note] })

      useNotesStore.getState().updateNote('update-1', { pinned: true })

      const updated = useNotesStore.getState().notes[0]
      expect(updated.pinned).toBe(true)
      expect(updated.content).toBe('Original') // unchanged
    })

    it('should not affect other notes', () => {
      const note1 = createMockTodo({ id: 'n-1', content: 'First' })
      const note2 = createMockTodo({ id: 'n-2', content: 'Second' })
      useNotesStore.setState({ notes: [note1, note2] })

      useNotesStore.getState().updateNote('n-1', { content: 'Changed' })

      expect(useNotesStore.getState().notes[1].content).toBe('Second')
    })

    it('should handle updating non-existent note gracefully', () => {
      const note = createMockTodo({ id: 'exists' })
      useNotesStore.setState({ notes: [note] })

      useNotesStore.getState().updateNote('nope', { content: 'No effect' })

      expect(useNotesStore.getState().notes).toHaveLength(1)
      expect(useNotesStore.getState().notes[0].content).toBe('Test todo')
    })
  })

  // ---------------------------------------------------------------------------
  // mergeFetchedNotes — the critical sync logic
  // ---------------------------------------------------------------------------
  describe('mergeFetchedNotes', () => {
    it('should replace notes when no pending IDs', () => {
      const old = createMockTodo({ id: 'old-1' })
      useNotesStore.setState({ notes: [old], pendingNoteIds: new Set() })

      const dbNotes = [
        createMockTodo({ id: 'db-1', content: 'From DB' }),
        createMockTodo({ id: 'db-2', content: 'Also DB' }),
      ]
      useNotesStore.getState().mergeFetchedNotes(dbNotes)

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(2)
      expect(state.notes.map(n => n.id)).toEqual(['db-1', 'db-2'])
    })

    it('should clear confirmed pending IDs when they appear in DB results', () => {
      const pending = createMockTodo({ id: 'pending-1', content: 'Locally created' })
      useNotesStore.setState({
        notes: [pending],
        pendingNoteIds: new Set(['pending-1']),
      })

      // DB now contains the note → it was confirmed
      const dbNotes = [
        createMockTodo({ id: 'pending-1', content: 'Confirmed from DB' }),
      ]
      useNotesStore.getState().mergeFetchedNotes(dbNotes)

      const state = useNotesStore.getState()
      expect(state.pendingNoteIds.size).toBe(0)
      expect(state.notes).toHaveLength(1)
      expect(state.notes[0].content).toBe('Confirmed from DB')
    })

    it('should keep notes still pending (not yet in DB)', () => {
      const pending = createMockTodo({ id: 'pending-1', content: 'Still pending' })
      useNotesStore.setState({
        notes: [pending],
        pendingNoteIds: new Set(['pending-1']),
      })

      // DB does NOT contain the pending note yet
      const dbNotes = [
        createMockTodo({ id: 'existing-1', content: 'Already in DB' }),
      ]
      useNotesStore.getState().mergeFetchedNotes(dbNotes)

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(2)
      expect(state.notes[0].id).toBe('existing-1') // DB notes first
      expect(state.notes[1].id).toBe('pending-1')  // still pending appended
      expect(state.pendingNoteIds.has('pending-1')).toBe(true)
    })

    it('should NOT re-add ghost notes (create → delete → merge)', () => {
      // Simulate: user creates a note, then deletes it before DB confirms
      const pending = createMockTodo({ id: 'ghost-1' })
      useNotesStore.setState({
        notes: [pending],
        pendingNoteIds: new Set(['ghost-1']),
      })

      // User deletes — removeNote cleans both notes[] and pendingNoteIds
      useNotesStore.getState().removeNote('ghost-1')

      // Now DB delivers results that don't include ghost-1
      const dbNotes = [
        createMockTodo({ id: 'real-1' }),
      ]
      useNotesStore.getState().mergeFetchedNotes(dbNotes)

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(1)
      expect(state.notes[0].id).toBe('real-1')
      // Ghost should NOT reappear
      expect(state.notes.find(n => n.id === 'ghost-1')).toBeUndefined()
      expect(state.pendingNoteIds.size).toBe(0)
    })

    it('should handle mixed: some pending confirmed, some still pending', () => {
      const confirmed = createMockTodo({ id: 'p-1', content: 'Will be confirmed' })
      const stillPending = createMockTodo({ id: 'p-2', content: 'Still pending' })
      useNotesStore.setState({
        notes: [confirmed, stillPending],
        pendingNoteIds: new Set(['p-1', 'p-2']),
      })

      // DB has p-1 but not p-2
      const dbNotes = [
        createMockTodo({ id: 'p-1', content: 'Confirmed by DB' }),
        createMockTodo({ id: 'other', content: 'Another note' }),
      ]
      useNotesStore.getState().mergeFetchedNotes(dbNotes)

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(3)
      expect(state.notes.map(n => n.id)).toEqual(['p-1', 'other', 'p-2'])
      expect(state.pendingNoteIds.has('p-1')).toBe(false) // confirmed
      expect(state.pendingNoteIds.has('p-2')).toBe(true)  // still pending
    })

    it('should handle empty DB results with no pending', () => {
      useNotesStore.setState({ notes: [], pendingNoteIds: new Set() })

      useNotesStore.getState().mergeFetchedNotes([])

      expect(useNotesStore.getState().notes).toHaveLength(0)
    })

    it('should handle empty DB results with pending notes', () => {
      const pending = createMockTodo({ id: 'p-1' })
      useNotesStore.setState({
        notes: [pending],
        pendingNoteIds: new Set(['p-1']),
      })

      useNotesStore.getState().mergeFetchedNotes([])

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(1) // still pending preserved
      expect(state.notes[0].id).toBe('p-1')
      expect(state.pendingNoteIds.has('p-1')).toBe(true)
    })

    it('should use DB version when a pending note is confirmed', () => {
      const localVersion = createMockTodo({
        id: 'p-1',
        content: 'Local version',
        sort_order: 0,
      })
      useNotesStore.setState({
        notes: [localVersion],
        pendingNoteIds: new Set(['p-1']),
      })

      const dbVersion = createMockTodo({
        id: 'p-1',
        content: 'DB version with server sort_order',
        sort_order: 5,
      })
      useNotesStore.getState().mergeFetchedNotes([dbVersion])

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(1)
      // DB version should be used, not the local one
      expect(state.notes[0].sort_order).toBe(5)
      expect(state.notes[0].content).toBe('DB version with server sort_order')
    })
  })

  // ---------------------------------------------------------------------------
  // clearNotes
  // ---------------------------------------------------------------------------
  describe('clearNotes', () => {
    it('should clear all notes and pendingNoteIds', () => {
      const note = createMockTodo({ id: 'n-1' })
      useNotesStore.setState({
        notes: [note],
        pendingNoteIds: new Set(['n-1']),
      })

      useNotesStore.getState().clearNotes()

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(0)
      expect(state.pendingNoteIds.size).toBe(0)
    })

    it('should not affect loading or scope', () => {
      useNotesStore.setState({
        notes: [createMockTodo({ id: 'n-1' })],
        loading: false,
        currentDate: '2026-02-06',
        currentProjectId: 'proj-1',
      })

      useNotesStore.getState().clearNotes()

      const state = useNotesStore.getState()
      expect(state.loading).toBe(false)
      expect(state.currentDate).toBe('2026-02-06')
      expect(state.currentProjectId).toBe('proj-1')
    })
  })

  // ---------------------------------------------------------------------------
  // Integration: realistic sequences
  // ---------------------------------------------------------------------------
  describe('realistic sequences', () => {
    it('create → immediate merge (fast DB) → notes list is correct', () => {
      // User creates a note
      const note = createMockTodo({ id: 'fast-1', content: 'Quick save' })
      useNotesStore.getState().addNote(note)

      // DB fetch returns immediately (includes the new note)
      const dbNotes = [
        createMockTodo({ id: 'existing-1' }),
        createMockTodo({ id: 'fast-1', content: 'Quick save' }),
      ]
      useNotesStore.getState().mergeFetchedNotes(dbNotes)

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(2)
      expect(state.pendingNoteIds.size).toBe(0)
    })

    it('create → slow merge (DB doesnt have it yet) → second merge confirms', () => {
      // User creates a note
      const note = createMockTodo({ id: 'slow-1', content: 'Slow save' })
      useNotesStore.getState().addNote(note)

      // First DB fetch doesn't include the new note
      const dbNotes1 = [createMockTodo({ id: 'existing-1' })]
      useNotesStore.getState().mergeFetchedNotes(dbNotes1)

      let state = useNotesStore.getState()
      expect(state.notes).toHaveLength(2) // existing + still pending
      expect(state.pendingNoteIds.has('slow-1')).toBe(true)

      // Second DB fetch now includes it
      const dbNotes2 = [
        createMockTodo({ id: 'existing-1' }),
        createMockTodo({ id: 'slow-1', content: 'Slow save' }),
      ]
      useNotesStore.getState().mergeFetchedNotes(dbNotes2)

      state = useNotesStore.getState()
      expect(state.notes).toHaveLength(2)
      expect(state.pendingNoteIds.size).toBe(0)
    })

    it('create multiple → delete one → merge should not ghost', () => {
      // User creates two notes rapidly
      const note1 = createMockTodo({ id: 'rapid-1' })
      const note2 = createMockTodo({ id: 'rapid-2' })
      useNotesStore.getState().addNote(note1)
      useNotesStore.getState().addNote(note2)

      // User deletes the second one
      useNotesStore.getState().removeNote('rapid-2')

      // DB fetch returns with both existing notes (rapid-2 not in DB since it was deleted)
      const dbNotes = [
        createMockTodo({ id: 'old-1' }),
        createMockTodo({ id: 'rapid-1' }),
      ]
      useNotesStore.getState().mergeFetchedNotes(dbNotes)

      const state = useNotesStore.getState()
      expect(state.notes.map(n => n.id)).toEqual(['old-1', 'rapid-1'])
      expect(state.pendingNoteIds.size).toBe(0)
      // rapid-2 should NOT reappear
      expect(state.notes.find(n => n.id === 'rapid-2')).toBeUndefined()
    })

    it('create → update → merge preserves DB version', () => {
      // User creates and immediately updates
      const note = createMockTodo({ id: 'cu-1', content: 'Initial' })
      useNotesStore.getState().addNote(note)
      useNotesStore.getState().updateNote('cu-1', { content: 'Updated locally' })

      expect(useNotesStore.getState().notes[0].content).toBe('Updated locally')

      // DB confirms with server timestamp
      const dbNotes = [
        createMockTodo({
          id: 'cu-1',
          content: 'Updated locally',
          updated_at: '2026-02-06T12:00:00Z',
        }),
      ]
      useNotesStore.getState().mergeFetchedNotes(dbNotes)

      const state = useNotesStore.getState()
      expect(state.notes).toHaveLength(1)
      expect(state.pendingNoteIds.size).toBe(0)
      expect(state.notes[0].updated_at).toBe('2026-02-06T12:00:00Z')
    })
  })
})
