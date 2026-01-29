import { describe, it, expect } from 'vitest';
import {
  formatNotesList,
  formatNote,
  formatSearchResults,
  formatLabelsList,
  formatProjectsList,
  formatContactsList,
  formatSuccess,
  formatError,
} from '../../skills/lib/formatters.js';

describe('formatters', () => {
  describe('formatNotesList', () => {
    it('returns empty message for null', () => {
      expect(formatNotesList(null)).toBe('📭 No notes found');
    });

    it('returns empty message for empty array', () => {
      expect(formatNotesList([])).toBe('📭 No notes found');
    });

    it('formats single note', () => {
      const notes = [
        {
          id: 'note-1',
          content: 'Test note',
          date: '2024-01-15',
          category: 'todo',
          completed: false,
          pinned: false,
        },
      ];

      const result = formatNotesList(notes);

      expect(result).toContain('Found 1 note(s)');
      expect(result).toContain('Test note');
      expect(result).toContain('ID: note-1');
      expect(result).toContain('Date: 2024-01-15');
      expect(result).toContain('Category: todo');
      expect(result).toContain('⬜'); // Not completed
    });

    it('shows checkmark for completed notes', () => {
      const notes = [
        {
          id: 'note-1',
          content: 'Completed task',
          date: '2024-01-15',
          category: 'todo',
          completed: true,
          pinned: false,
        },
      ];

      const result = formatNotesList(notes);
      expect(result).toContain('✅');
    });

    it('shows pin icon for pinned notes', () => {
      const notes = [
        {
          id: 'note-1',
          content: 'Pinned note',
          date: '2024-01-15',
          category: 'todo',
          completed: false,
          pinned: true,
        },
      ];

      const result = formatNotesList(notes);
      expect(result).toContain('📌');
    });

    it('truncates long content', () => {
      const notes = [
        {
          id: 'note-1',
          content: 'A'.repeat(100),
          date: '2024-01-15',
          category: 'todo',
          completed: false,
          pinned: false,
        },
      ];

      const result = formatNotesList(notes);
      expect(result).toContain('...');
      expect(result).not.toContain('A'.repeat(100));
    });

    it('shows description when present', () => {
      const notes = [
        {
          id: 'note-1',
          content: 'Test',
          description: 'This is a description',
          date: '2024-01-15',
          category: 'todo',
          completed: false,
          pinned: false,
        },
      ];

      const result = formatNotesList(notes);
      expect(result).toContain('Description: This is a description');
    });

    it('shows labels count when present', () => {
      const notes = [
        {
          id: 'note-1',
          content: 'Test',
          date: '2024-01-15',
          category: 'todo',
          completed: false,
          pinned: false,
          labels: ['label1', 'label2'],
        },
      ];

      const result = formatNotesList(notes);
      expect(result).toContain('Labels: 2 label(s)');
    });

    it('shows project when present', () => {
      const notes = [
        {
          id: 'note-1',
          content: 'Test',
          date: '2024-01-15',
          category: 'todo',
          completed: false,
          pinned: false,
          project_id: 'project-123',
        },
      ];

      const result = formatNotesList(notes);
      expect(result).toContain('Project: project-123');
    });

    it('shows assignee when present', () => {
      const notes = [
        {
          id: 'note-1',
          content: 'Test',
          date: '2024-01-15',
          category: 'todo',
          completed: false,
          pinned: false,
          assignee_id: 'user-456',
        },
      ];

      const result = formatNotesList(notes);
      expect(result).toContain('Assigned to: user-456');
    });

    it('shows deadline when present', () => {
      const notes = [
        {
          id: 'note-1',
          content: 'Test',
          date: '2024-01-15',
          category: 'todo',
          completed: false,
          pinned: false,
          deadline: '2024-01-20',
        },
      ];

      const result = formatNotesList(notes);
      expect(result).toContain('Deadline: 2024-01-20');
    });

    it('formats multiple notes', () => {
      const notes = [
        {
          id: 'note-1',
          content: 'First note',
          date: '2024-01-15',
          category: 'todo',
          completed: false,
          pinned: false,
        },
        {
          id: 'note-2',
          content: 'Second note',
          date: '2024-01-16',
          category: 'notes',
          completed: true,
          pinned: false,
        },
      ];

      const result = formatNotesList(notes);
      expect(result).toContain('Found 2 note(s)');
      expect(result).toContain('First note');
      expect(result).toContain('Second note');
    });
  });

  describe('formatNote', () => {
    it('returns not found for null', () => {
      expect(formatNote(null)).toBe('❌ Note not found');
    });

    it('formats complete note', () => {
      const note = {
        id: 'note-1',
        content: 'Test content',
        description: 'Test description',
        date: '2024-01-15',
        category: 'todo',
        completed: true,
        pinned: true,
        completed_at: '2024-01-15T10:00:00Z',
        deadline: '2024-01-20',
        assignee_id: 'user-123',
        project_id: 'project-456',
        labels: ['work', 'urgent'],
        created_at: '2024-01-14T08:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };

      const result = formatNote(note);

      expect(result).toContain('Note Details');
      expect(result).toContain('ID: note-1');
      expect(result).toContain('Content: Test content');
      expect(result).toContain('Description: Test description');
      expect(result).toContain('Date: 2024-01-15');
      expect(result).toContain('Category: todo');
      expect(result).toContain('✅ Completed');
      expect(result).toContain('📌 Pinned');
      expect(result).toContain('Completed at: 2024-01-15T10:00:00Z');
      expect(result).toContain('Deadline: 2024-01-20');
      expect(result).toContain('Assigned to: user-123');
      expect(result).toContain('Project: project-456');
      expect(result).toContain('Labels: work, urgent');
      expect(result).toContain('Created: 2024-01-14T08:00:00Z');
      expect(result).toContain('Updated: 2024-01-15T10:00:00Z');
    });

    it('formats incomplete note', () => {
      const note = {
        id: 'note-1',
        content: 'Test',
        date: '2024-01-15',
        category: 'todo',
        completed: false,
        pinned: false,
        created_at: '2024-01-14T08:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      };

      const result = formatNote(note);
      expect(result).toContain('⬜ Not completed');
    });

    it('shows deleted info when note is deleted', () => {
      const note = {
        id: 'note-1',
        content: 'Test',
        date: '2024-01-15',
        category: 'todo',
        completed: false,
        pinned: false,
        created_at: '2024-01-14T08:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
        deleted_at: '2024-01-16T12:00:00Z',
        deleted_reason: 'No longer needed',
      };

      const result = formatNote(note);
      expect(result).toContain('❌ Deleted: 2024-01-16T12:00:00Z');
      expect(result).toContain('Reason: No longer needed');
    });
  });

  describe('formatSearchResults', () => {
    it('returns no results message for null', () => {
      expect(formatSearchResults(null, 'test')).toBe('🔍 No results found for "test"');
    });

    it('returns no results message for empty array', () => {
      expect(formatSearchResults([], 'query')).toBe('🔍 No results found for "query"');
    });

    it('formats search results', () => {
      const results = [
        {
          id: 'note-1',
          content: 'Meeting notes',
          description: 'Notes from the weekly meeting',
          date: '2024-01-15',
          category: 'notes',
          completed: false,
        },
      ];

      const result = formatSearchResults(results, 'meeting');

      expect(result).toContain('Search results for "meeting"');
      expect(result).toContain('1 found');
      expect(result).toContain('Meeting notes');
      expect(result).toContain('2024-01-15');
      expect(result).toContain('notes');
      expect(result).toContain('note-1');
    });

    it('truncates long content in search results', () => {
      const results = [
        {
          id: 'note-1',
          content: 'B'.repeat(100),
          date: '2024-01-15',
          category: 'todo',
          completed: false,
        },
      ];

      const result = formatSearchResults(results, 'test');
      expect(result).toContain('...');
    });
  });

  describe('formatLabelsList', () => {
    it('returns empty message for null', () => {
      expect(formatLabelsList(null)).toBe('🏷️  No labels found');
    });

    it('returns empty message for empty array', () => {
      expect(formatLabelsList([])).toBe('🏷️  No labels found');
    });

    it('formats labels list', () => {
      const labels = [
        { id: 'l1', name: 'Work', color: '#ff0000' },
        { id: 'l2', name: 'Personal' },
      ];

      const result = formatLabelsList(labels);

      expect(result).toContain('Found 2 label(s)');
      expect(result).toContain('Work');
      expect(result).toContain('ID: l1');
      expect(result).toContain('Color: #ff0000');
      expect(result).toContain('Personal');
      expect(result).toContain('ID: l2');
    });
  });

  describe('formatProjectsList', () => {
    it('returns empty message for null', () => {
      expect(formatProjectsList(null)).toBe('📂 No projects found');
    });

    it('returns empty message for empty array', () => {
      expect(formatProjectsList([])).toBe('📂 No projects found');
    });

    it('formats projects list', () => {
      const projects = [
        { id: 'p1', name: 'Project Alpha', description: 'First project' },
        { id: 'p2', name: 'Project Beta' },
      ];

      const result = formatProjectsList(projects);

      expect(result).toContain('Found 2 project(s)');
      expect(result).toContain('Project Alpha');
      expect(result).toContain('ID: p1');
      expect(result).toContain('First project');
      expect(result).toContain('Project Beta');
    });

    it('truncates long descriptions', () => {
      const projects = [
        { id: 'p1', name: 'Project', description: 'X'.repeat(100) },
      ];

      const result = formatProjectsList(projects);
      expect(result).toContain('...');
    });
  });

  describe('formatContactsList', () => {
    it('returns empty message for null', () => {
      expect(formatContactsList(null)).toBe('👤 No contacts found');
    });

    it('returns empty message for empty array', () => {
      expect(formatContactsList([])).toBe('👤 No contacts found');
    });

    it('formats contacts list', () => {
      const contacts = [
        { id: 'c1', name: 'John Doe', email: 'john@example.com' },
        { id: 'c2', name: 'Jane Smith' },
      ];

      const result = formatContactsList(contacts);

      expect(result).toContain('Found 2 contact(s)');
      expect(result).toContain('John Doe');
      expect(result).toContain('ID: c1');
      expect(result).toContain('Email: john@example.com');
      expect(result).toContain('Jane Smith');
    });
  });

  describe('formatSuccess', () => {
    it('formats success message', () => {
      const result = formatSuccess('Operation completed');
      expect(result).toBe('\n✅ Operation completed\n');
    });
  });

  describe('formatError', () => {
    it('formats basic error', () => {
      const error = { message: 'Something went wrong' };
      const result = formatError(error);

      expect(result).toContain('❌ Error:');
      expect(result).toContain('Something went wrong');
    });

    it('formats error with code', () => {
      const error = { message: 'Not found', code: 'NOT_FOUND' };
      const result = formatError(error);

      expect(result).toContain('Code: NOT_FOUND');
    });

    it('formats error with details', () => {
      const error = {
        message: 'Validation failed',
        details: { field: 'email', reason: 'invalid format' },
      };
      const result = formatError(error);

      expect(result).toContain('Details:');
      expect(result).toContain('email');
      expect(result).toContain('invalid format');
    });
  });
});
