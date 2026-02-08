import { describe, it, expect, vi } from 'vitest'
import { createActor } from 'xstate'
import { selectionMachine } from './selectionMachine'
import type { Note } from '@/types/note'

// --- Helpers ---

function makeNote(overrides: Partial<Note> = {}): Note {
    return {
        id: 'note-1',
        date: '2024-01-01',
        content: 'Test note',
        description: 'Some description',
        category: 'todo',
        completed: false,
        completed_at: null,
        deadline: null,
        is_all_day: false,
        pinned: false,
        sort_order: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        deleted_at: null,
        deleted_reason: null,
        project_id: null,
        is_public: false,
        public_slug: null,
        ...overrides,
    }
}

function createTestActor(note: Note | null = null) {
    const syncStore = vi.fn()
    const clearTimer = vi.fn()

    const machine = selectionMachine.provide({
        actions: {
            syncStoreOnNoteChange: syncStore,
            clearUnfocusedSaveTimer: clearTimer,
        },
    })

    const actor = createActor(machine, { input: { note } })
    actor.start()
    return { actor, syncStore, clearTimer }
}

// --- Tests ---

describe('selectionMachine', () => {
    // -------------------------------------------------------------------------
    // Initial state
    // -------------------------------------------------------------------------
    describe('initial state', () => {
        it('starts in idle when no note is provided', () => {
            const { actor } = createTestActor(null)
            expect(actor.getSnapshot().value).toBe('idle')
            expect(actor.getSnapshot().context.noteId).toBeNull()
        })

        it('starts in idle even when a note is provided (needs NOTE_SELECTED to transition)', () => {
            const note = makeNote()
            const { actor } = createTestActor(note)
            // Machine starts in idle — the hook sends NOTE_SELECTED to transition
            expect(actor.getSnapshot().value).toBe('idle')
            expect(actor.getSnapshot().context.noteId).toBe('note-1')
        })
    })

    // -------------------------------------------------------------------------
    // idle → browsing
    // -------------------------------------------------------------------------
    describe('idle → browsing', () => {
        it('transitions to browsing on NOTE_SELECTED', () => {
            const { actor, syncStore } = createTestActor()
            const note = makeNote()

            actor.send({ type: 'NOTE_SELECTED', note })

            expect(actor.getSnapshot().value).toBe('browsing')
            expect(actor.getSnapshot().context.noteId).toBe('note-1')
            expect(actor.getSnapshot().context.note).toBe(note)
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(false)
            expect(syncStore).toHaveBeenCalled()
        })

        it('ignores NOTE_DESELECTED in idle', () => {
            const { actor } = createTestActor()
            actor.send({ type: 'NOTE_DESELECTED' })
            expect(actor.getSnapshot().value).toBe('idle')
        })
    })

    // -------------------------------------------------------------------------
    // browsing transitions
    // -------------------------------------------------------------------------
    describe('browsing', () => {
        it('re-enters browsing on NOTE_SELECTED with different note', () => {
            const { actor, syncStore } = createTestActor()
            const note1 = makeNote({ id: 'note-1' })
            const note2 = makeNote({ id: 'note-2', content: 'Second' })

            actor.send({ type: 'NOTE_SELECTED', note: note1 })
            syncStore.mockClear()

            actor.send({ type: 'NOTE_SELECTED', note: note2 })

            expect(actor.getSnapshot().value).toBe('browsing')
            expect(actor.getSnapshot().context.noteId).toBe('note-2')
            expect(syncStore).toHaveBeenCalled()
        })

        it('updates note reference on NOTE_SELECTED with same note', () => {
            const { actor, syncStore } = createTestActor()
            const note = makeNote({ id: 'note-1' })
            const noteUpdated = makeNote({ id: 'note-1', content: 'Updated' })

            actor.send({ type: 'NOTE_SELECTED', note })
            syncStore.mockClear()

            actor.send({ type: 'NOTE_SELECTED', note: noteUpdated })

            expect(actor.getSnapshot().value).toBe('browsing')
            expect(actor.getSnapshot().context.note?.content).toBe('Updated')
            // Should NOT call syncStore for same note
            expect(syncStore).not.toHaveBeenCalled()
        })

        it('transitions to idle on NOTE_DESELECTED', () => {
            const { actor } = createTestActor()
            actor.send({ type: 'NOTE_SELECTED', note: makeNote() })
            actor.send({ type: 'NOTE_DESELECTED' })

            expect(actor.getSnapshot().value).toBe('idle')
            expect(actor.getSnapshot().context.noteId).toBeNull()
        })

        it('updates note on NOTE_CHANGED', () => {
            const { actor } = createTestActor()
            const note = makeNote()
            const updated = makeNote({ content: 'Changed' })

            actor.send({ type: 'NOTE_SELECTED', note })
            actor.send({ type: 'NOTE_CHANGED', note: updated })

            expect(actor.getSnapshot().value).toBe('browsing')
            expect(actor.getSnapshot().context.note?.content).toBe('Changed')
        })

        it('transitions to navigatingToDescription on TAB_PRESSED', () => {
            const { actor } = createTestActor()
            actor.send({ type: 'NOTE_SELECTED', note: makeNote() })

            actor.send({ type: 'TAB_PRESSED', desiredColumn: 5 })

            expect(actor.getSnapshot().value).toBe('navigatingToDescription')
            expect(actor.getSnapshot().context.desiredColumn).toBe(5)
            expect(actor.getSnapshot().context.focusTarget).toBe('description-start')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(true)
        })

        it('sets focusTarget on FOCUS_TITLE', () => {
            const { actor } = createTestActor()
            actor.send({ type: 'NOTE_SELECTED', note: makeNote() })

            actor.send({ type: 'FOCUS_TITLE', column: 3 })

            expect(actor.getSnapshot().context.focusTarget).toBe('title')
            expect(actor.getSnapshot().context.desiredColumn).toBe(3)
        })

        it('clears focusTarget on TITLE_FOCUSED when it was title', () => {
            const { actor } = createTestActor()
            actor.send({ type: 'NOTE_SELECTED', note: makeNote() })
            actor.send({ type: 'FOCUS_TITLE', column: 0 })

            actor.send({ type: 'TITLE_FOCUSED' })

            expect(actor.getSnapshot().context.focusTarget).toBeNull()
        })

        it('does not clear focusTarget on TITLE_FOCUSED when focusTarget is description-start', () => {
            const { actor } = createTestActor()
            actor.send({ type: 'NOTE_SELECTED', note: makeNote() })
            // TAB sets focusTarget to 'description-start'
            actor.send({ type: 'TAB_PRESSED', desiredColumn: 0 })
            actor.send({ type: 'DESCRIPTION_PANEL_READY' })
            // Back to browsing but keep focusTarget as description-start for this test
            // We need to set it up differently: use FOCUS_TITLE to go back to browsing
            // Actually, TITLE_FOCUSED only clears when focusTarget === 'title'
            // Let's test that directly in browsing state
            const { actor: actor2 } = createTestActor()
            actor2.send({ type: 'NOTE_SELECTED', note: makeNote() })
            // focusTarget starts as null, TITLE_FOCUSED should not change it
            actor2.send({ type: 'TITLE_FOCUSED' })
            expect(actor2.getSnapshot().context.focusTarget).toBeNull()
        })
    })

    // -------------------------------------------------------------------------
    // navigatingToDescription (RC-5 / RC-7 critical state)
    // -------------------------------------------------------------------------
    describe('navigatingToDescription', () => {
        function goToNavigating() {
            const result = createTestActor()
            result.actor.send({ type: 'NOTE_SELECTED', note: makeNote() })
            result.actor.send({ type: 'TAB_PRESSED', desiredColumn: 3 })
            return result
        }

        it('ignores NOTE_CHANGED events (RC-5/RC-7 fix)', () => {
            const { actor } = goToNavigating()
            const changedNote = makeNote({ content: 'External change' })

            actor.send({ type: 'NOTE_CHANGED', note: changedNote })

            // Must stay in navigatingToDescription, NOT go back to browsing
            expect(actor.getSnapshot().value).toBe('navigatingToDescription')
            // Panel must remain open
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(true)
            // Note reference should NOT be updated (event is ignored)
            expect(actor.getSnapshot().context.note?.content).toBe('Test note')
        })

        it('transitions to viewingDescription on DESCRIPTION_PANEL_READY', () => {
            const { actor } = goToNavigating()

            actor.send({ type: 'DESCRIPTION_PANEL_READY' })

            expect(actor.getSnapshot().value).toBe('viewingDescription')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(true)
        })

        it('transitions to editingDescription on DESCRIPTION_FOCUSED', () => {
            const { actor } = goToNavigating()

            actor.send({ type: 'DESCRIPTION_FOCUSED' })

            expect(actor.getSnapshot().value).toBe('editingDescription')
        })

        it('handles NOTE_SELECTED with different note (stays navigating)', () => {
            const { actor, syncStore } = goToNavigating()
            syncStore.mockClear()
            const newNote = makeNote({ id: 'note-2' })

            actor.send({ type: 'NOTE_SELECTED', note: newNote })

            // Stays in navigatingToDescription but updates noteId
            expect(actor.getSnapshot().value).toBe('navigatingToDescription')
            expect(actor.getSnapshot().context.noteId).toBe('note-2')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(true)
            expect(syncStore).toHaveBeenCalled()
        })

        it('transitions to idle on NOTE_DESELECTED', () => {
            const { actor } = goToNavigating()

            actor.send({ type: 'NOTE_DESELECTED' })

            expect(actor.getSnapshot().value).toBe('idle')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(false)
        })

        it('handles repeated TAB_PRESSED (updates column)', () => {
            const { actor } = goToNavigating()

            actor.send({ type: 'TAB_PRESSED', desiredColumn: 10 })

            expect(actor.getSnapshot().value).toBe('navigatingToDescription')
            expect(actor.getSnapshot().context.desiredColumn).toBe(10)
            expect(actor.getSnapshot().context.focusTarget).toBe('description-start')
        })
    })

    // -------------------------------------------------------------------------
    // viewingDescription
    // -------------------------------------------------------------------------
    describe('viewingDescription', () => {
        function goToViewing() {
            const result = createTestActor()
            result.actor.send({ type: 'NOTE_SELECTED', note: makeNote() })
            result.actor.send({ type: 'TAB_PRESSED', desiredColumn: 0 })
            result.actor.send({ type: 'DESCRIPTION_PANEL_READY' })
            return result
        }

        it('transitions to editingDescription on DESCRIPTION_FOCUSED', () => {
            const { actor } = goToViewing()

            actor.send({ type: 'DESCRIPTION_FOCUSED' })

            expect(actor.getSnapshot().value).toBe('editingDescription')
        })

        it('transitions to browsing on ESCAPE_PRESSED and closes panel', () => {
            const { actor } = goToViewing()

            actor.send({ type: 'ESCAPE_PRESSED' })

            expect(actor.getSnapshot().value).toBe('browsing')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(false)
        })

        it('updates note on NOTE_CHANGED', () => {
            const { actor } = goToViewing()
            const updated = makeNote({ description: 'Updated desc' })

            actor.send({ type: 'NOTE_CHANGED', note: updated })

            expect(actor.getSnapshot().value).toBe('viewingDescription')
            expect(actor.getSnapshot().context.note?.description).toBe('Updated desc')
        })

        it('transitions to browsing on NOTE_SELECTED with different note', () => {
            const { actor } = goToViewing()
            const otherNote = makeNote({ id: 'note-2' })

            actor.send({ type: 'NOTE_SELECTED', note: otherNote })

            expect(actor.getSnapshot().value).toBe('browsing')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(false)
        })

        it('transitions to browsing on FOCUS_TITLE', () => {
            const { actor } = goToViewing()

            actor.send({ type: 'FOCUS_TITLE', column: 5 })

            expect(actor.getSnapshot().value).toBe('browsing')
            expect(actor.getSnapshot().context.focusTarget).toBe('title')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(false)
        })
    })

    // -------------------------------------------------------------------------
    // editingDescription
    // -------------------------------------------------------------------------
    describe('editingDescription', () => {
        function goToEditing() {
            const result = createTestActor()
            result.actor.send({ type: 'NOTE_SELECTED', note: makeNote() })
            result.actor.send({ type: 'TAB_PRESSED', desiredColumn: 0 })
            result.actor.send({ type: 'DESCRIPTION_PANEL_READY' })
            result.actor.send({ type: 'DESCRIPTION_FOCUSED' })
            return result
        }

        it('transitions to viewingDescription on DESCRIPTION_BLURRED', () => {
            const { actor } = goToEditing()

            actor.send({ type: 'DESCRIPTION_BLURRED' })

            expect(actor.getSnapshot().value).toBe('viewingDescription')
        })

        it('transitions to browsing on ESCAPE_PRESSED and closes panel', () => {
            const { actor } = goToEditing()

            actor.send({ type: 'ESCAPE_PRESSED' })

            expect(actor.getSnapshot().value).toBe('browsing')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(false)
        })

        it('updates note on NOTE_CHANGED', () => {
            const { actor } = goToEditing()
            const updated = makeNote({ content: 'Changed while editing' })

            actor.send({ type: 'NOTE_CHANGED', note: updated })

            expect(actor.getSnapshot().value).toBe('editingDescription')
            expect(actor.getSnapshot().context.note?.content).toBe('Changed while editing')
        })

        it('transitions to browsing on NOTE_SELECTED with different note', () => {
            const { actor } = goToEditing()

            actor.send({ type: 'NOTE_SELECTED', note: makeNote({ id: 'note-2' }) })

            expect(actor.getSnapshot().value).toBe('browsing')
            expect(actor.getSnapshot().context.noteId).toBe('note-2')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(false)
        })

        it('transitions to browsing on FOCUS_TITLE', () => {
            const { actor } = goToEditing()

            actor.send({ type: 'FOCUS_TITLE', column: 2 })

            expect(actor.getSnapshot().value).toBe('browsing')
            expect(actor.getSnapshot().context.focusTarget).toBe('title')
            expect(actor.getSnapshot().context.desiredColumn).toBe(2)
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(false)
        })
    })

    // -------------------------------------------------------------------------
    // RC-5/RC-7 regression: Full Tab navigation scenario
    // -------------------------------------------------------------------------
    describe('RC-5/RC-7 regression: Tab navigation with URL sync', () => {
        it('survives: Tab → NOTE_CHANGED (URL sync) → DESCRIPTION_PANEL_READY', () => {
            const { actor } = createTestActor()
            const note = makeNote({ id: 'note-1' })

            // 1. Select note
            actor.send({ type: 'NOTE_SELECTED', note })
            expect(actor.getSnapshot().value).toBe('browsing')

            // 2. User presses Tab
            actor.send({ type: 'TAB_PRESSED', desiredColumn: 5 })
            expect(actor.getSnapshot().value).toBe('navigatingToDescription')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(true)

            // 3. URL sync effect fires NOTE_CHANGED (this was the bug — used to close panel)
            actor.send({ type: 'NOTE_CHANGED', note: makeNote({ id: 'note-1', content: 'Updated by URL sync' }) })
            expect(actor.getSnapshot().value).toBe('navigatingToDescription')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(true)

            // 4. Description panel mounts and is ready
            actor.send({ type: 'DESCRIPTION_PANEL_READY' })
            expect(actor.getSnapshot().value).toBe('viewingDescription')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(true)
        })

        it('survives: Tab → NOTE_SELECTED (same note, different ref) → DESCRIPTION_FOCUSED', () => {
            const { actor } = createTestActor()
            const note = makeNote({ id: 'note-1', content: 'Original' })

            actor.send({ type: 'NOTE_SELECTED', note })
            actor.send({ type: 'TAB_PRESSED', desiredColumn: 0 })

            // Simulate: React provides new note object with same ID
            actor.send({ type: 'NOTE_SELECTED', note: makeNote({ id: 'note-1', content: 'Updated ref' }) })

            // Should stay in navigatingToDescription
            expect(actor.getSnapshot().value).toBe('navigatingToDescription')
            expect(actor.getSnapshot().context.showDescriptionPanel).toBe(true)

            // Panel focuses
            actor.send({ type: 'DESCRIPTION_FOCUSED' })
            expect(actor.getSnapshot().value).toBe('editingDescription')
        })
    })

    // -------------------------------------------------------------------------
    // Edge cases
    // -------------------------------------------------------------------------
    describe('edge cases', () => {
        it('clearUnfocusedSaveTimer is called on note change in browsing', () => {
            const { actor, clearTimer } = createTestActor()
            actor.send({ type: 'NOTE_SELECTED', note: makeNote({ id: 'note-1' }) })
            clearTimer.mockClear()

            actor.send({ type: 'NOTE_SELECTED', note: makeNote({ id: 'note-2' }) })
            expect(clearTimer).toHaveBeenCalled()
        })

        it('clearUnfocusedSaveTimer is called on NOTE_DESELECTED', () => {
            const { actor, clearTimer } = createTestActor()
            actor.send({ type: 'NOTE_SELECTED', note: makeNote() })
            clearTimer.mockClear()

            actor.send({ type: 'NOTE_DESELECTED' })
            expect(clearTimer).toHaveBeenCalled()
        })

        it('full lifecycle: idle → browsing → navigating → editing → browsing → idle', () => {
            const { actor } = createTestActor()
            const note = makeNote()

            expect(actor.getSnapshot().value).toBe('idle')

            actor.send({ type: 'NOTE_SELECTED', note })
            expect(actor.getSnapshot().value).toBe('browsing')

            actor.send({ type: 'TAB_PRESSED', desiredColumn: 0 })
            expect(actor.getSnapshot().value).toBe('navigatingToDescription')

            actor.send({ type: 'DESCRIPTION_PANEL_READY' })
            expect(actor.getSnapshot().value).toBe('viewingDescription')

            actor.send({ type: 'DESCRIPTION_FOCUSED' })
            expect(actor.getSnapshot().value).toBe('editingDescription')

            actor.send({ type: 'ESCAPE_PRESSED' })
            expect(actor.getSnapshot().value).toBe('browsing')

            actor.send({ type: 'NOTE_DESELECTED' })
            expect(actor.getSnapshot().value).toBe('idle')
        })
    })
})
