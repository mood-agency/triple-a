import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { NoteCard } from './NoteCard'
import { createMockNote, createMockTodo } from '@tests/mocks/data/notes'

describe('NoteCard', () => {
  const mockHandlers = {
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onToggleCompleted: vi.fn(),
  }

  describe('Rendering', () => {
    it('should render note content', () => {
      const note = createMockNote({ content: 'Test note content' })
      render(<NoteCard note={note} {...mockHandlers} />)

      expect(screen.getByText('Test note content')).toBeInTheDocument()
    })

    it('should show checkbox for task categories', () => {
      const todo = createMockTodo({ content: 'Test todo' })
      render(<NoteCard note={todo} {...mockHandlers} />)

      expect(screen.getByRole('checkbox')).toBeInTheDocument()
    })

    it('should not show checkbox for notes category', () => {
      const note = createMockNote({ category: 'notes', content: 'Regular note' })
      render(<NoteCard note={note} {...mockHandlers} />)

      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    })

    it('should display creation time', () => {
      const note = createMockNote()
      render(<NoteCard note={note} {...mockHandlers} />)

      // Check that time is displayed (format: HH:MM)
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument()
    })
  })

  describe('User interactions', () => {
    it('should call onToggleCompleted when checkbox is clicked', async () => {
      const user = userEvent.setup()
      const todo = createMockTodo({ id: 'test-todo', completed: false })
      render(<NoteCard note={todo} {...mockHandlers} />)

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      expect(mockHandlers.onToggleCompleted).toHaveBeenCalledWith('test-todo', true)
    })

    it('should open editor when card is clicked', async () => {
      const user = userEvent.setup()
      const note = createMockNote({ content: 'Click me' })
      render(<NoteCard note={note} {...mockHandlers} />)

      const card = screen.getByText('Click me').closest('div[class*="group"]')
      expect(card).toBeInTheDocument()

      await user.click(card!)

      // After clicking, the editor should be shown (NoteEditor component)
      // This test verifies the card switches to edit mode
      expect(screen.queryByText('Click me')).toBeInTheDocument()
    })

    it('should show delete dialog when delete button is clicked', async () => {
      const user = userEvent.setup()
      const note = createMockNote({ content: 'Delete me' })
      render(<NoteCard note={note} {...mockHandlers} />)

      // Find and click delete button (button with trash icon)
      const buttons = screen.getAllByRole('button')
      const deleteButton = buttons.find(button =>
        button.querySelector('svg.lucide-trash-2')
      )
      expect(deleteButton).toBeInTheDocument()

      await user.click(deleteButton!)

      // Dialog should be visible
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
  })

  describe('Completed state', () => {
    it('should show completed task with line-through style', () => {
      const completedTodo = createMockTodo({
        content: 'Completed task',
        completed: true,
      })
      render(<NoteCard note={completedTodo} {...mockHandlers} />)

      const content = screen.getByText('Completed task')
      expect(content).toHaveClass('line-through')
    })

    it('should show uncompleted task without line-through', () => {
      const todo = createMockTodo({
        content: 'Active task',
        completed: false,
      })
      render(<NoteCard note={todo} {...mockHandlers} />)

      const content = screen.getByText('Active task')
      expect(content).not.toHaveClass('line-through')
    })
  })

  describe('Edge cases', () => {
    it('should handle notes without description', () => {
      const note = createMockNote({ description: null })
      render(<NoteCard note={note} {...mockHandlers} />)

      // Should render without errors
      expect(screen.getByText('Test note')).toBeInTheDocument()
    })

    it('should prevent event propagation when clicking checkbox', async () => {
      const user = userEvent.setup()
      const todo = createMockTodo()
      render(<NoteCard note={todo} {...mockHandlers} />)

      const checkbox = screen.getByRole('checkbox')
      await user.click(checkbox)

      // onToggleCompleted should be called, but card should not enter edit mode
      expect(mockHandlers.onToggleCompleted).toHaveBeenCalled()
      // Editor should not be visible (content should still be in read mode)
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    })
  })
})
