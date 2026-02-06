/**
 * Pure function that decides whether the BlockNote editor needs a full
 * document replacement (replaceBlocks) based on changes to the notes array.
 *
 * Extracted from BlockNoteNoteList's sync useEffect for testability.
 *
 * @see docs/TASK_LIST_ARCHITECTURE.md — Section 3: Sync Effects
 */

export interface SyncDecisionInput {
  /** IDs of notes currently passed as props, in display order */
  currentNoteIds: string[];
  /** IDs of notes from the previous render, in display order */
  previousNoteIds: string[];
  /** IDs of blocks currently in the BlockNote editor document */
  editorBlockIds: string[];
  /** Whether an internal save is in progress (isSavingInternallyRef) */
  isSavingInternally: boolean;
  /** Whether the ProseMirror editor currently has DOM focus */
  editorHasFocus: boolean;
}

export interface SyncDecision {
  /** Whether a full document replacement (replaceBlocks) is needed */
  shouldSync: boolean;
  /** Whether to hide content during sync (opacity:0) to prevent flash.
   *  True for filter/add/reorder, false for initial load. */
  shouldHideContent: boolean;
  /** Notes removed from props but still in editor → filter operation */
  notesWereFiltered: boolean;
  /** Notes added to props that don't exist in editor → need to add */
  notesWereAdded: boolean;
  /** First render with notes (empty → populated) */
  isInitialLoad: boolean;
  /** Same set of notes but different order (sort change) */
  orderChanged: boolean;
}

const NO_SYNC: SyncDecision = {
  shouldSync: false,
  shouldHideContent: false,
  notesWereFiltered: false,
  notesWereAdded: false,
  isInitialLoad: false,
  orderChanged: false,
};

export function computeSyncDecision(input: SyncDecisionInput): SyncDecision {
  const {
    currentNoteIds,
    previousNoteIds,
    editorBlockIds,
    isSavingInternally,
    editorHasFocus,
  } = input;

  // Quick exit: if IDs are identical in the same order, nothing changed
  if (
    currentNoteIds.length === previousNoteIds.length &&
    currentNoteIds.every((id, i) => id === previousNoteIds[i])
  ) {
    return NO_SYNC;
  }

  const previousIdSet = new Set(previousNoteIds);
  const currentIdSet = new Set(currentNoteIds);
  const editorIdSet = new Set(editorBlockIds);

  // ── Removed notes ──────────────────────────────────────────────────
  const removedIds = previousNoteIds.filter(id => !currentIdSet.has(id));

  // Distinguish delete vs filter:
  // - Still in editor → FILTER (user changed filter, we need to sync)
  // - Not in editor  → DELETE (already handled by editor.removeBlocks)
  const removedIdsStillInDocument = removedIds.filter(id => editorIdSet.has(id));
  const notesWereFiltered = removedIdsStillInDocument.length > 0;

  // ── Added notes ────────────────────────────────────────────────────
  // Notes in current props that weren't in previous AND aren't in the editor.
  // Notes created via Enter key are already in the editor → excluded.
  const notesWereAdded = currentNoteIds.some(
    id => !previousIdSet.has(id) && !editorIdSet.has(id)
  );

  // ── Initial load ───────────────────────────────────────────────────
  const isInitialLoad = previousNoteIds.length === 0 && currentNoteIds.length > 0;

  // ── Order changed ──────────────────────────────────────────────────
  // Same set of notes, different order (user applied sort).
  // Guarded by isSavingInternally (prevents echo from our own save changing updated_at)
  // and editorHasFocus (prevents realtime updated_at echoes during editing).
  const orderChanged =
    removedIds.length === 0 &&
    previousIdSet.size === currentIdSet.size &&
    previousIdSet.size > 0 &&
    !isSavingInternally &&
    !editorHasFocus;

  const shouldSync = notesWereFiltered || notesWereAdded || isInitialLoad || orderChanged;
  const shouldHideContent = notesWereFiltered || notesWereAdded || orderChanged;

  return {
    shouldSync,
    shouldHideContent,
    notesWereFiltered,
    notesWereAdded,
    isInitialLoad,
    orderChanged,
  };
}
