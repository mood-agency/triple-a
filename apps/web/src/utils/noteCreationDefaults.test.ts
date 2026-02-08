import { describe, it, expect } from 'vitest';
import { getNoteCreationDefaults, type NoteCreationFilters } from './noteCreationDefaults';

const emptyFilters: NoteCreationFilters = {
  categoryFilter: 'all',
  labelFilter: [],
  assigneeFilter: [],
  dateRangeFilter: { from: undefined, to: undefined },
};

describe('getNoteCreationDefaults', () => {
  it('returns clean defaults when no filters are active', () => {
    const result = getNoteCreationDefaults(emptyFilters);
    expect(result).toEqual({
      category: 'todo',
      labelIds: [],
      assigneeId: null,
      deadline: null,
    });
  });

  describe('category', () => {
    it('uses category filter when set to a specific category', () => {
      const result = getNoteCreationDefaults({ ...emptyFilters, categoryFilter: 'meeting' });
      expect(result.category).toBe('meeting');
    });

    it('defaults to todo when category filter is all', () => {
      const result = getNoteCreationDefaults({ ...emptyFilters, categoryFilter: 'all' });
      expect(result.category).toBe('todo');
    });

    it('uses followup category', () => {
      const result = getNoteCreationDefaults({ ...emptyFilters, categoryFilter: 'followup' });
      expect(result.category).toBe('followup');
    });

    it('uses notes category', () => {
      const result = getNoteCreationDefaults({ ...emptyFilters, categoryFilter: 'notes' });
      expect(result.category).toBe('notes');
    });
  });

  describe('labels', () => {
    it('inherits single label from filter', () => {
      const result = getNoteCreationDefaults({ ...emptyFilters, labelFilter: ['label-1'] });
      expect(result.labelIds).toEqual(['label-1']);
    });

    it('inherits multiple labels from filter', () => {
      const result = getNoteCreationDefaults({ ...emptyFilters, labelFilter: ['label-1', 'label-2', 'label-3'] });
      expect(result.labelIds).toEqual(['label-1', 'label-2', 'label-3']);
    });

    it('returns empty array when no label filter', () => {
      const result = getNoteCreationDefaults(emptyFilters);
      expect(result.labelIds).toEqual([]);
    });

    it('does not mutate the original filter array', () => {
      const labelFilter = ['label-1'];
      const result = getNoteCreationDefaults({ ...emptyFilters, labelFilter });
      result.labelIds.push('extra');
      expect(labelFilter).toEqual(['label-1']);
    });
  });

  describe('assignee', () => {
    it('uses single assignee from filter', () => {
      const result = getNoteCreationDefaults({ ...emptyFilters, assigneeFilter: ['contact-1'] });
      expect(result.assigneeId).toBe('contact-1');
    });

    it('returns null when multiple assignees in filter (ambiguous)', () => {
      const result = getNoteCreationDefaults({ ...emptyFilters, assigneeFilter: ['contact-1', 'contact-2'] });
      expect(result.assigneeId).toBeNull();
    });

    it('returns null when no assignee filter', () => {
      const result = getNoteCreationDefaults(emptyFilters);
      expect(result.assigneeId).toBeNull();
    });
  });

  describe('deadline', () => {
    it('uses from date when date range has from', () => {
      const from = new Date(2025, 5, 15); // June 15, 2025
      const result = getNoteCreationDefaults({
        ...emptyFilters,
        dateRangeFilter: { from, to: undefined },
      });
      expect(result.deadline).toBe('2025-06-15');
    });

    it('uses from date when both from and to are set', () => {
      const from = new Date(2025, 5, 10);
      const to = new Date(2025, 5, 20);
      const result = getNoteCreationDefaults({
        ...emptyFilters,
        dateRangeFilter: { from, to },
      });
      expect(result.deadline).toBe('2025-06-10');
    });

    it('returns null when no date range filter', () => {
      const result = getNoteCreationDefaults(emptyFilters);
      expect(result.deadline).toBeNull();
    });

    it('uses to date when only to is set and today is after to', () => {
      // Set "to" to a date in the past
      const to = new Date(2020, 0, 1); // Jan 1, 2020
      const result = getNoteCreationDefaults({
        ...emptyFilters,
        dateRangeFilter: { from: undefined, to },
      });
      expect(result.deadline).toBe('2020-01-01');
    });
  });

  describe('combined filters', () => {
    it('applies all filters together', () => {
      const result = getNoteCreationDefaults({
        categoryFilter: 'followup',
        labelFilter: ['label-a', 'label-b'],
        assigneeFilter: ['contact-x'],
        dateRangeFilter: { from: new Date(2025, 2, 1), to: new Date(2025, 2, 31) },
      });
      expect(result).toEqual({
        category: 'followup',
        labelIds: ['label-a', 'label-b'],
        assigneeId: 'contact-x',
        deadline: '2025-03-01',
      });
    });
  });
});
