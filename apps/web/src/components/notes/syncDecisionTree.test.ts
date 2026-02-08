import { describe, it, expect } from 'vitest'
import { computeSyncDecision, findMovedNoteIds, type SyncDecisionInput } from './syncDecisionTree'

/** Helper to build input with defaults */
function input(overrides: Partial<SyncDecisionInput> = {}): SyncDecisionInput {
  return {
    currentNoteIds: [],
    previousNoteIds: [],
    editorBlockIds: [],
    pendingSaveNoteIds: [],
    editorHasFocus: false,
    ...overrides,
  }
}

describe('computeSyncDecision', () => {
  // ---------------------------------------------------------------------------
  // No-op scenarios: nothing should trigger a sync
  // ---------------------------------------------------------------------------
  describe('no-op scenarios', () => {
    it('should not sync when IDs are identical (same order)', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'b', 'c'],
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a', 'b', 'c'],
      }))

      expect(result.shouldSync).toBe(false)
      expect(result.shouldHideContent).toBe(false)
    })

    it('should not sync when both arrays are empty', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: [],
        previousNoteIds: [],
        editorBlockIds: [],
      }))

      expect(result.shouldSync).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Initial load: first render with notes
  // ---------------------------------------------------------------------------
  describe('initial load', () => {
    it('should sync on initial load (empty → notes)', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'b'],
        previousNoteIds: [],
        editorBlockIds: [],
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.isInitialLoad).toBe(true)
    })

    it('should also set notesWereAdded on initial load (notes not in empty sets)', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'b'],
        previousNoteIds: [],
        editorBlockIds: [],
      }))

      // On initial load, notesWereAdded is also true because notes aren't
      // in the empty previousIds or empty editor. This means shouldHideContent
      // is true, which hides the empty editor while blocks are inserted.
      expect(result.notesWereAdded).toBe(true)
      expect(result.isInitialLoad).toBe(true)
      expect(result.shouldHideContent).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Filter operations: notes removed from props, still in editor
  // ---------------------------------------------------------------------------
  describe('filter operations', () => {
    it('should sync when notes are filtered out (still in editor)', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a'],
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a', 'b', 'c'], // b,c still in editor
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.notesWereFiltered).toBe(true)
      expect(result.shouldHideContent).toBe(true)
    })

    it('should sync when notes are added back (unfilter)', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'b', 'c'],
        previousNoteIds: ['a'],
        editorBlockIds: ['a'], // b,c not yet in editor
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.notesWereAdded).toBe(true)
      expect(result.shouldHideContent).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Completion flow: THE critical blink test cases
  // ---------------------------------------------------------------------------
  describe('completion flow', () => {
    it('should NOT sync when completed note is removed from BOTH props and editor (correct flow)', () => {
      // This is the CORRECT completion flow:
      // 1. editor.removeBlocks() removes the block from editor
      // 2. notes prop updates (completed note filtered out)
      // 3. Sync effect runs — the note is gone from both → no sync needed
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'c'],           // 'b' removed (completed)
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a', 'c'],           // 'b' already removed by editor.removeBlocks()
      }))

      expect(result.shouldSync).toBe(false)
      expect(result.shouldHideContent).toBe(false)
      expect(result.notesWereFiltered).toBe(false)
      // This is the key assertion: completion should NOT trigger any sync
    })

    it('should detect blink: completed note removed from props but STILL in editor (race condition)', () => {
      // This is the RACE CONDITION that causes the blink:
      // 1. notes prop updates BEFORE editor.removeBlocks() runs
      // 2. The note is still in the editor → detected as "filter" operation
      // 3. replaceBlocks + opacity:0 triggers → BLINK!
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'c'],           // 'b' removed (completed)
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a', 'b', 'c'],     // 'b' STILL in editor!
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.notesWereFiltered).toBe(true)
      expect(result.shouldHideContent).toBe(true)
      // This test documents the blink scenario.
      // The fix is to ensure editor.removeBlocks() runs BEFORE the notes prop changes.
    })

    it('should NOT sync when multiple tasks completed and all removed from editor', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a'],
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a'], // b,c already removed
      }))

      expect(result.shouldSync).toBe(false)
      expect(result.notesWereFiltered).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Delete flow: note removed from both (similar to completion)
  // ---------------------------------------------------------------------------
  describe('delete flow', () => {
    it('should NOT sync when deleted note is removed from both props and editor', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'c'],
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a', 'c'], // 'b' already removed via editor.removeBlocks
      }))

      expect(result.shouldSync).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // Notes created locally (Enter key)
  // ---------------------------------------------------------------------------
  describe('local note creation (Enter key)', () => {
    it('should NOT sync when new note is already in the editor', () => {
      // When user presses Enter, the block is created in the editor FIRST,
      // then the note appears in props. Since it's already in the editor,
      // no sync is needed.
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'new-1', 'b'],
        previousNoteIds: ['a', 'b'],
        editorBlockIds: ['a', 'new-1', 'b'], // already in editor!
      }))

      expect(result.notesWereAdded).toBe(false)
      // Note: orderChanged might be false here because new note was added (different size)
    })

    it('should sync when new note is NOT in the editor (e.g. from another client)', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'remote-1', 'b'],
        previousNoteIds: ['a', 'b'],
        editorBlockIds: ['a', 'b'], // remote-1 NOT in editor
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.notesWereAdded).toBe(true)
      expect(result.shouldHideContent).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // Order changes (sorting)
  // ---------------------------------------------------------------------------
  describe('order changes', () => {
    it('should sync when notes are reordered (sort applied, no pending saves)', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['c', 'a', 'b'],    // reordered
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a', 'b', 'c'],
        pendingSaveNoteIds: [],
        editorHasFocus: false,
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.orderChanged).toBe(true)
      expect(result.shouldHideContent).toBe(true)
    })

    it('should NOT sync reorder when ALL moved notes have pending saves (echo from own save)', () => {
      // After saving note 'c', Supabase updates updated_at → 'c' moves to front.
      // All notes that changed position (c, a, b) include c which has a pending save.
      // Since ALL moved notes have pending saves, this is our echo.
      const result = computeSyncDecision(input({
        currentNoteIds: ['c', 'a', 'b'],
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a', 'b', 'c'],
        pendingSaveNoteIds: ['c', 'a', 'b'],  // all moved notes have pending saves
        editorHasFocus: false,
      }))

      expect(result.shouldSync).toBe(false)
      expect(result.orderChanged).toBe(false)
    })

    it('should sync reorder when only SOME moved notes have pending saves (RC-3 fix)', () => {
      // Note 'a' was saved (pending), but note 'b' moved without a pending save.
      // This means it's a real reorder (user sorted), not just our echo.
      const result = computeSyncDecision(input({
        currentNoteIds: ['b', 'a'],
        previousNoteIds: ['a', 'b'],
        editorBlockIds: ['a', 'b'],
        pendingSaveNoteIds: ['a'],  // only 'a' has pending save, but 'b' also moved
        editorHasFocus: false,
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.orderChanged).toBe(true)
    })

    it('should NOT sync reorder when editor has focus (realtime echo)', () => {
      // Real-time subscription delivers updated_at changes from Supabase
      // while the user is typing. Reordering would cause caret jump.
      const result = computeSyncDecision(input({
        currentNoteIds: ['c', 'a', 'b'],
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a', 'b', 'c'],
        pendingSaveNoteIds: [],
        editorHasFocus: true,              // ← guard active
      }))

      expect(result.shouldSync).toBe(false)
      expect(result.orderChanged).toBe(false)
    })

    it('should NOT sync reorder when both guards are active', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['b', 'a'],
        previousNoteIds: ['a', 'b'],
        editorBlockIds: ['a', 'b'],
        pendingSaveNoteIds: ['a', 'b'],
        editorHasFocus: true,
      }))

      expect(result.shouldSync).toBe(false)
      expect(result.orderChanged).toBe(false)
    })
  })

  // ---------------------------------------------------------------------------
  // findMovedNoteIds helper
  // ---------------------------------------------------------------------------
  describe('findMovedNoteIds', () => {
    it('returns empty when no notes moved', () => {
      expect(findMovedNoteIds(['a', 'b', 'c'], ['a', 'b', 'c'])).toEqual([])
    })

    it('returns all notes when completely reordered', () => {
      expect(findMovedNoteIds(['c', 'b', 'a'], ['a', 'b', 'c'])).toEqual(['c', 'a'])
    })

    it('returns moved notes when partially reordered', () => {
      expect(findMovedNoteIds(['a', 'c', 'b'], ['a', 'b', 'c'])).toEqual(['c', 'b'])
    })

    it('handles different length arrays', () => {
      // When sizes differ, this shouldn't be called for orderChanged,
      // but test the behavior anyway
      expect(findMovedNoteIds(['a', 'b', 'c'], ['a', 'b'])).toEqual(['c'])
    })
  })

  // ---------------------------------------------------------------------------
  // Combined / edge cases
  // ---------------------------------------------------------------------------
  describe('combined scenarios', () => {
    it('should detect both filter and add simultaneously', () => {
      // Switching from one filter to another: some notes removed, others added
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'd'],          // 'b','c' removed, 'd' added
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a', 'b', 'c'],    // 'd' not in editor, 'b','c' still there
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.notesWereFiltered).toBe(true)
      expect(result.notesWereAdded).toBe(true)
      expect(result.shouldHideContent).toBe(true)
    })

    it('should handle complete list replacement (all different notes)', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['x', 'y', 'z'],
        previousNoteIds: ['a', 'b', 'c'],
        editorBlockIds: ['a', 'b', 'c'],
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.notesWereFiltered).toBe(true)
      expect(result.notesWereAdded).toBe(true)
    })

    it('should handle single note remaining after clearing all others', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a'],
        previousNoteIds: ['a', 'b', 'c', 'd', 'e'],
        editorBlockIds: ['a', 'b', 'c', 'd', 'e'],
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.notesWereFiltered).toBe(true)
    })

    it('should handle going from notes to empty (all filtered out)', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: [],
        previousNoteIds: ['a', 'b'],
        editorBlockIds: ['a', 'b'],
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.notesWereFiltered).toBe(true)
      expect(result.shouldHideContent).toBe(true)
    })
  })

  // ---------------------------------------------------------------------------
  // shouldHideContent specifics
  // ---------------------------------------------------------------------------
  describe('shouldHideContent', () => {
    it('should be true for initial load (notesWereAdded triggers hide)', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a', 'b'],
        previousNoteIds: [],
        editorBlockIds: [],
      }))

      expect(result.shouldSync).toBe(true)
      expect(result.shouldHideContent).toBe(true)
    })

    it('should be true for filter changes', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['a'],
        previousNoteIds: ['a', 'b'],
        editorBlockIds: ['a', 'b'],
      }))

      expect(result.shouldHideContent).toBe(true)
    })

    it('should be true for order changes', () => {
      const result = computeSyncDecision(input({
        currentNoteIds: ['b', 'a'],
        previousNoteIds: ['a', 'b'],
        editorBlockIds: ['a', 'b'],
      }))

      expect(result.shouldHideContent).toBe(true)
    })
  })
})
