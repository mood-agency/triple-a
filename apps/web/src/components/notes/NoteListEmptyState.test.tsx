import { describe, it, expect } from 'vitest'
import { render, screen } from '@tests/helpers/render'
import { NoteListEmptyState } from './NoteListEmptyState'

describe('NoteListEmptyState', () => {
  describe('No results message', () => {
    it('should show "no results" when no completed tasks', () => {
      render(
        <NoteListEmptyState
          shouldShowOnlyCompletedMessage={false}
        />
      )

      expect(screen.getByText(/no results/i)).toBeInTheDocument()
    })

    it('should show search icon', () => {
      const { container } = render(
        <NoteListEmptyState
          shouldShowOnlyCompletedMessage={false}
        />
      )

      const icon = container.querySelector('svg')
      expect(icon).toBeInTheDocument()
    })
  })

  describe('Completed tasks message', () => {
    it('should show singular message for 1 completed task', () => {
      render(
        <NoteListEmptyState
          completedCount={1}
          shouldShowOnlyCompletedMessage={true}
        />
      )

      // Should show singular form
      expect(screen.getByText(/only.*completed.*task/i)).toBeInTheDocument()
    })

    it('should show plural message for multiple completed tasks', () => {
      render(
        <NoteListEmptyState
          completedCount={5}
          shouldShowOnlyCompletedMessage={true}
        />
      )

      // Should show plural form with count
      expect(screen.getByText(/only.*completed.*tasks/i)).toBeInTheDocument()
    })

    it('should show completed message when completedCount > 0 even if flag is false', () => {
      render(
        <NoteListEmptyState
          completedCount={3}
          shouldShowOnlyCompletedMessage={false}
        />
      )

      // Should still show completed message because count > 0
      expect(screen.getByText(/only.*completed.*tasks/i)).toBeInTheDocument()
    })

    it('should handle 0 completed tasks with flag set', () => {
      render(
        <NoteListEmptyState
          completedCount={0}
          shouldShowOnlyCompletedMessage={true}
        />
      )

      // Should show plural form even with 0
      expect(screen.getByText(/only.*completed.*tasks/i)).toBeInTheDocument()
    })
  })

  describe('Layout and styling', () => {
    it('should apply full height by default', () => {
      const { container } = render(
        <NoteListEmptyState
          shouldShowOnlyCompletedMessage={false}
        />
      )

      const wrapper = container.querySelector('.h-full')
      expect(wrapper).toBeInTheDocument()
    })

    it('should not apply full height when fillHeight is false', () => {
      const { container } = render(
        <NoteListEmptyState
          shouldShowOnlyCompletedMessage={false}
          fillHeight={false}
        />
      )

      const wrapper = container.querySelector('.h-full')
      expect(wrapper).not.toBeInTheDocument()
    })

    it('should center content', () => {
      const { container } = render(
        <NoteListEmptyState
          shouldShowOnlyCompletedMessage={false}
        />
      )

      const flexContainer = container.querySelector('.flex.items-center.justify-center')
      expect(flexContainer).toBeInTheDocument()
    })

    it('should apply muted styling to text', () => {
      render(
        <NoteListEmptyState
          shouldShowOnlyCompletedMessage={false}
        />
      )

      const text = screen.getByText(/no results/i)
      expect(text).toHaveClass('text-sm', 'italic')
    })
  })

  describe('Edge cases', () => {
    it('should handle undefined completedCount', () => {
      render(
        <NoteListEmptyState
          shouldShowOnlyCompletedMessage={false}
        />
      )

      // Should not crash and show default message
      expect(screen.getByText(/no results/i)).toBeInTheDocument()
    })

    it('should handle large completed counts', () => {
      render(
        <NoteListEmptyState
          completedCount={999}
          shouldShowOnlyCompletedMessage={true}
        />
      )

      // Should show message with large number
      expect(screen.getByText(/999/)).toBeInTheDocument()
    })
  })
})
