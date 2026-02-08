import { describe, it, expect, vi } from 'vitest';
import { createActor } from 'xstate';
import { editorSyncMachine, shallowArrayEqual } from './editorSyncMachine';

function createTestActor() {
  const actor = createActor(editorSyncMachine);
  actor.start();
  return actor;
}

describe('editorSyncMachine', () => {
  // ---------------------------------------------------------------------------
  // Initial state
  // ---------------------------------------------------------------------------
  describe('initial state', () => {
    it('starts in active state with empty context', () => {
      const actor = createTestActor();
      const snapshot = actor.getSnapshot();

      expect(snapshot.value).toBe('active');
      expect(snapshot.context.pendingSaves).toEqual({});
      expect(snapshot.context.pendingCreations).toEqual([]);
      expect(snapshot.context.pendingCompletions).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // SAVE_STARTED
  // ---------------------------------------------------------------------------
  describe('SAVE_STARTED', () => {
    it('adds entry to pendingSaves', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'hello' });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-1']).toBeDefined();
      expect(ctx.pendingSaves['note-1'].content).toBe('hello');
      expect(ctx.pendingSaves['note-1'].timestamp).toBeGreaterThan(0);
    });

    it('overwrites previous pending save for the same noteId', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'first' });
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'second' });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-1'].content).toBe('second');
    });

    it('tracks multiple notes independently', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'aaa' });
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-2', content: 'bbb' });

      const ctx = actor.getSnapshot().context;
      expect(Object.keys(ctx.pendingSaves)).toHaveLength(2);
      expect(ctx.pendingSaves['note-1'].content).toBe('aaa');
      expect(ctx.pendingSaves['note-2'].content).toBe('bbb');
    });
  });

  // ---------------------------------------------------------------------------
  // NOTES_RECEIVED — echo detection
  // ---------------------------------------------------------------------------
  describe('NOTES_RECEIVED', () => {
    it('clears pending save when echo content matches', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'hello' });

      actor.send({
        type: 'NOTES_RECEIVED',
        noteContents: { 'note-1': 'hello' }, // content matches
      });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-1']).toBeUndefined();
    });

    it('keeps pending save when echo content does NOT match', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'hello' });

      actor.send({
        type: 'NOTES_RECEIVED',
        noteContents: { 'note-1': 'different' }, // content doesn't match
      });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-1']).toBeDefined();
      expect(ctx.pendingSaves['note-1'].content).toBe('hello');
    });

    it('keeps pending save when note is not in NOTES_RECEIVED', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'hello' });

      actor.send({
        type: 'NOTES_RECEIVED',
        noteContents: { 'note-2': 'world' }, // different note
      });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-1']).toBeDefined();
    });

    it('clears only the matching saves in a batch', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'aaa' });
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-2', content: 'bbb' });
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-3', content: 'ccc' });

      actor.send({
        type: 'NOTES_RECEIVED',
        noteContents: {
          'note-1': 'aaa', // matches
          'note-2': 'xxx', // doesn't match
          'note-3': 'ccc', // matches
        },
      });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-1']).toBeUndefined();
      expect(ctx.pendingSaves['note-2']).toBeDefined();
      expect(ctx.pendingSaves['note-3']).toBeUndefined();
    });

    it('clears pending creations when note appears in NOTES_RECEIVED', () => {
      const actor = createTestActor();
      actor.send({ type: 'NOTE_CREATED', noteId: 'new-1' });
      actor.send({ type: 'NOTE_CREATED', noteId: 'new-2' });

      actor.send({
        type: 'NOTES_RECEIVED',
        noteContents: { 'new-1': 'first note' },
      });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingCreations).toEqual(['new-2']);
    });
  });

  // ---------------------------------------------------------------------------
  // RC-1 regression: pending save persists until echo, not timeout
  // ---------------------------------------------------------------------------
  describe('RC-1 regression: no arbitrary timeout', () => {
    it('pending save persists across multiple NOTES_RECEIVED with wrong content', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'saved content' });

      // Simulate multiple notes[] updates with old content (echo hasn't arrived)
      actor.send({ type: 'NOTES_RECEIVED', noteContents: { 'note-1': 'old content' } });
      actor.send({ type: 'NOTES_RECEIVED', noteContents: { 'note-1': 'old content' } });
      actor.send({ type: 'NOTES_RECEIVED', noteContents: { 'note-1': 'old content' } });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-1']).toBeDefined();
      expect(ctx.pendingSaves['note-1'].content).toBe('saved content');
    });

    it('pending save clears when echo finally arrives', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'saved content' });

      // Several updates with old content
      actor.send({ type: 'NOTES_RECEIVED', noteContents: { 'note-1': 'old content' } });
      actor.send({ type: 'NOTES_RECEIVED', noteContents: { 'note-1': 'old content' } });

      // Echo finally arrives
      actor.send({ type: 'NOTES_RECEIVED', noteContents: { 'note-1': 'saved content' } });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-1']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // RC-3 regression: per-note tracking (not global boolean)
  // ---------------------------------------------------------------------------
  describe('RC-3 regression: per-note tracking', () => {
    it('saving note A does not block tracking for note B', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-a', content: 'aaa' });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-a']).toBeDefined();
      expect(ctx.pendingSaves['note-b']).toBeUndefined();
      // note-b has no pending save → it can be reordered freely
    });

    it('multiple independent saves tracked separately', () => {
      const actor = createTestActor();
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-a', content: 'aaa' });
      actor.send({ type: 'SAVE_STARTED', noteId: 'note-b', content: 'bbb' });

      // Echo for note-a arrives
      actor.send({ type: 'NOTES_RECEIVED', noteContents: { 'note-a': 'aaa', 'note-b': 'old' } });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-a']).toBeUndefined(); // cleared
      expect(ctx.pendingSaves['note-b']).toBeDefined(); // still pending
    });
  });

  // ---------------------------------------------------------------------------
  // NOTE_CREATED / NOTE_CONFIRMED lifecycle
  // ---------------------------------------------------------------------------
  describe('note creation lifecycle', () => {
    it('tracks created note', () => {
      const actor = createTestActor();
      actor.send({ type: 'NOTE_CREATED', noteId: 'new-1' });

      expect(actor.getSnapshot().context.pendingCreations).toContain('new-1');
    });

    it('clears on NOTE_CONFIRMED', () => {
      const actor = createTestActor();
      actor.send({ type: 'NOTE_CREATED', noteId: 'new-1' });
      actor.send({ type: 'NOTE_CONFIRMED', noteId: 'new-1' });

      expect(actor.getSnapshot().context.pendingCreations).not.toContain('new-1');
    });

    it('also clears via NOTES_RECEIVED', () => {
      const actor = createTestActor();
      actor.send({ type: 'NOTE_CREATED', noteId: 'new-1' });
      actor.send({ type: 'NOTES_RECEIVED', noteContents: { 'new-1': 'content' } });

      expect(actor.getSnapshot().context.pendingCreations).not.toContain('new-1');
    });

    it('handles multiple concurrent creations', () => {
      const actor = createTestActor();
      actor.send({ type: 'NOTE_CREATED', noteId: 'new-1' });
      actor.send({ type: 'NOTE_CREATED', noteId: 'new-2' });
      actor.send({ type: 'NOTE_CREATED', noteId: 'new-3' });

      expect(actor.getSnapshot().context.pendingCreations).toEqual(['new-1', 'new-2', 'new-3']);

      actor.send({ type: 'NOTE_CONFIRMED', noteId: 'new-2' });
      expect(actor.getSnapshot().context.pendingCreations).toEqual(['new-1', 'new-3']);
    });
  });

  // ---------------------------------------------------------------------------
  // COMPLETION_STARTED / COMPLETION_DONE lifecycle
  // ---------------------------------------------------------------------------
  describe('completion lifecycle', () => {
    it('tracks completing note', () => {
      const actor = createTestActor();
      actor.send({ type: 'COMPLETION_STARTED', noteId: 'note-1' });

      expect(actor.getSnapshot().context.pendingCompletions).toContain('note-1');
    });

    it('clears on COMPLETION_DONE', () => {
      const actor = createTestActor();
      actor.send({ type: 'COMPLETION_STARTED', noteId: 'note-1' });
      actor.send({ type: 'COMPLETION_DONE', noteId: 'note-1' });

      expect(actor.getSnapshot().context.pendingCompletions).not.toContain('note-1');
    });

    it('handles multiple concurrent completions', () => {
      const actor = createTestActor();
      actor.send({ type: 'COMPLETION_STARTED', noteId: 'note-1' });
      actor.send({ type: 'COMPLETION_STARTED', noteId: 'note-2' });

      expect(actor.getSnapshot().context.pendingCompletions).toEqual(['note-1', 'note-2']);

      actor.send({ type: 'COMPLETION_DONE', noteId: 'note-1' });
      expect(actor.getSnapshot().context.pendingCompletions).toEqual(['note-2']);
    });
  });

  // ---------------------------------------------------------------------------
  // CLEAR_STALE safety cleanup
  // ---------------------------------------------------------------------------
  describe('CLEAR_STALE', () => {
    it('removes saves older than 5s', () => {
      const actor = createTestActor();

      // Manually set a stale entry by using SAVE_STARTED, then manipulating time
      const realNow = Date.now;
      let fakeTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

      actor.send({ type: 'SAVE_STARTED', noteId: 'old-note', content: 'old' });

      // Advance time by 6 seconds
      fakeTime = 1006000;
      actor.send({ type: 'SAVE_STARTED', noteId: 'new-note', content: 'new' });

      // Now clear stale (old-note is 6s old, new-note is 0s old)
      actor.send({ type: 'CLEAR_STALE' });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['old-note']).toBeUndefined();
      expect(ctx.pendingSaves['new-note']).toBeDefined();

      vi.restoreAllMocks();
    });

    it('keeps entries under 5s threshold', () => {
      const actor = createTestActor();

      let fakeTime = 1000000;
      vi.spyOn(Date, 'now').mockImplementation(() => fakeTime);

      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'aaa' });

      // Only 3s later
      fakeTime = 1003000;
      actor.send({ type: 'CLEAR_STALE' });

      expect(actor.getSnapshot().context.pendingSaves['note-1']).toBeDefined();

      vi.restoreAllMocks();
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple concurrent operations
  // ---------------------------------------------------------------------------
  describe('concurrent operations', () => {
    it('tracks saves, creations, and completions simultaneously', () => {
      const actor = createTestActor();

      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'saved' });
      actor.send({ type: 'NOTE_CREATED', noteId: 'new-1' });
      actor.send({ type: 'COMPLETION_STARTED', noteId: 'note-2' });

      const ctx = actor.getSnapshot().context;
      expect(Object.keys(ctx.pendingSaves)).toEqual(['note-1']);
      expect(ctx.pendingCreations).toEqual(['new-1']);
      expect(ctx.pendingCompletions).toEqual(['note-2']);
    });

    it('NOTES_RECEIVED clears both saves and creations in one event', () => {
      const actor = createTestActor();

      actor.send({ type: 'SAVE_STARTED', noteId: 'note-1', content: 'content-1' });
      actor.send({ type: 'NOTE_CREATED', noteId: 'new-1' });

      actor.send({
        type: 'NOTES_RECEIVED',
        noteContents: {
          'note-1': 'content-1', // echo matches
          'new-1': 'new content', // creation confirmed
        },
      });

      const ctx = actor.getSnapshot().context;
      expect(ctx.pendingSaves['note-1']).toBeUndefined();
      expect(ctx.pendingCreations).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // shallowArrayEqual comparator
  // ---------------------------------------------------------------------------
  describe('shallowArrayEqual', () => {
    it('returns true for same reference', () => {
      const arr = ['a', 'b'];
      expect(shallowArrayEqual(arr, arr)).toBe(true);
    });

    it('returns true for equal contents', () => {
      expect(shallowArrayEqual(['a', 'b'], ['a', 'b'])).toBe(true);
    });

    it('returns false for different lengths', () => {
      expect(shallowArrayEqual(['a'], ['a', 'b'])).toBe(false);
    });

    it('returns false for different contents', () => {
      expect(shallowArrayEqual(['a', 'b'], ['a', 'c'])).toBe(false);
    });

    it('returns true for empty arrays', () => {
      expect(shallowArrayEqual([], [])).toBe(true);
    });
  });
});
