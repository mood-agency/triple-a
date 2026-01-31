import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { ActiveFiltersBar } from './ActiveFiltersBar'
import { createMockLabel } from '@tests/mocks/data/notes'
import type { Contact } from '@/types/contact'

// Mock contact factory
function createMockContact(overrides?: Partial<Contact>): Contact {
  return {
    id: 'contact-1',
    name: 'John',
    lastname: 'Doe',
    email: null,
    phone: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    remote_id: null,
    sync_status: 'local',
    last_synced_at: null,
    ...overrides,
  }
}

describe('ActiveFiltersBar', () => {
  const mockHandlers = {
    onClearCategory: vi.fn(),
    onClearLabel: vi.fn(),
    onClearAssignee: vi.fn(),
    onClearSearch: vi.fn(),
    onClearSort: vi.fn(),
    onClearTaskStatus: vi.fn(),
    onClearOverdue: vi.fn(),
    onClearAll: vi.fn(),
  }

  const defaultProps = {
    categoryFilter: 'all' as const,
    labelFilter: [],
    assigneeFilter: [],
    searchQuery: '',
    labels: [],
    contacts: [],
    sortConfig: { deadline: null, assignee: null, category: null },
    taskStatusFilter: 'active' as const,
    showOverdueOnly: false,
    ...mockHandlers,
  }

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Visibility', () => {
    it('should not render when no filters are active', () => {
      const { container } = render(<ActiveFiltersBar {...defaultProps} />)

      expect(container.firstChild).toBeNull()
    })

    it('should render when category filter is active', () => {
      render(<ActiveFiltersBar {...defaultProps} categoryFilter="todo" />)

      expect(screen.getByText(/active filters/i)).toBeInTheDocument()
    })

    it('should render when search query is active', () => {
      render(<ActiveFiltersBar {...defaultProps} searchQuery="test" />)

      expect(screen.getByText(/active filters/i)).toBeInTheDocument()
    })

    it('should render when label filter is active', () => {
      const label = createMockLabel({ id: 'label-1', name: 'Urgent' })
      render(
        <ActiveFiltersBar
          {...defaultProps}
          labelFilter={['label-1']}
          labels={[label]}
        />
      )

      expect(screen.getByText(/active filters/i)).toBeInTheDocument()
    })

    it('should render when assignee filter is active', () => {
      const contact = createMockContact({ id: 'contact-1', name: 'John' })
      render(
        <ActiveFiltersBar
          {...defaultProps}
          assigneeFilter={['contact-1']}
          contacts={[contact]}
        />
      )

      expect(screen.getByText(/active filters/i)).toBeInTheDocument()
    })

    it('should render when sort is active', () => {
      render(
        <ActiveFiltersBar
          {...defaultProps}
          sortConfig={{ deadline: 'asc', assignee: null, category: null }}
        />
      )

      expect(screen.getByText(/active filters/i)).toBeInTheDocument()
    })

    it('should render when task status filter is active', () => {
      render(<ActiveFiltersBar {...defaultProps} taskStatusFilter="completed" />)

      expect(screen.getByText(/active filters/i)).toBeInTheDocument()
    })

    it('should render when overdue filter is active', () => {
      render(<ActiveFiltersBar {...defaultProps} showOverdueOnly={true} />)

      expect(screen.getByText(/active filters/i)).toBeInTheDocument()
    })
  })

  describe('Search filter display', () => {
    it('should display search query', () => {
      render(<ActiveFiltersBar {...defaultProps} searchQuery="test query" />)

      expect(screen.getByText(/"test query"/)).toBeInTheDocument()
    })

    it('should trim whitespace from search query', () => {
      const { container } = render(
        <ActiveFiltersBar {...defaultProps} searchQuery="   " />
      )

      // Should not render because trimmed query is empty
      expect(container.firstChild).toBeNull()
    })

    it('should call onClearSearch when X is clicked', async () => {
      const user = userEvent.setup()
      render(<ActiveFiltersBar {...defaultProps} searchQuery="test" />)

      const buttons = screen.getAllByRole('button')
      const searchClearButton = buttons.find(btn =>
        btn.closest('span')?.textContent?.includes('"test"')
      )

      await user.click(searchClearButton!)

      expect(mockHandlers.onClearSearch).toHaveBeenCalled()
    })
  })

  describe('Category filter display', () => {
    it('should display todo category', () => {
      render(<ActiveFiltersBar {...defaultProps} categoryFilter="todo" />)

      expect(screen.getByText('To Do')).toBeInTheDocument()
    })

    it('should display follow-up category', () => {
      render(<ActiveFiltersBar {...defaultProps} categoryFilter="followup" />)

      expect(screen.getByText(/follow.*up/i)).toBeInTheDocument()
    })

    it('should display meeting category', () => {
      render(<ActiveFiltersBar {...defaultProps} categoryFilter="meeting" />)

      expect(screen.getByText(/meeting/i)).toBeInTheDocument()
    })

    it('should call onClearCategory when X is clicked', async () => {
      const user = userEvent.setup()
      render(<ActiveFiltersBar {...defaultProps} categoryFilter="todo" />)

      const buttons = screen.getAllByRole('button')
      const categoryClearButton = buttons.find(btn =>
        btn.closest('span')?.textContent?.includes('To Do')
      )

      await user.click(categoryClearButton!)

      expect(mockHandlers.onClearCategory).toHaveBeenCalled()
    })
  })

  describe('Label filter display', () => {
    it('should display selected labels', () => {
      const labels = [
        createMockLabel({ id: 'label-1', name: 'Urgent', color: '#ef4444' }),
        createMockLabel({ id: 'label-2', name: 'Work', color: '#3b82f6' }),
      ]
      render(
        <ActiveFiltersBar
          {...defaultProps}
          labelFilter={['label-1', 'label-2']}
          labels={labels}
        />
      )

      expect(screen.getByText('Urgent')).toBeInTheDocument()
      expect(screen.getByText('Work')).toBeInTheDocument()
    })

    it('should apply label colors as background', () => {
      const label = createMockLabel({ id: 'label-1', name: 'Urgent', color: '#ef4444' })
      render(
        <ActiveFiltersBar
          {...defaultProps}
          labelFilter={['label-1']}
          labels={[label]}
        />
      )

      const labelSpan = screen.getByText('Urgent').closest('span')
      expect(labelSpan).toHaveStyle({ backgroundColor: '#ef4444' })
    })

    it('should call onClearLabel with label ID when X is clicked', async () => {
      const user = userEvent.setup()
      const label = createMockLabel({ id: 'label-1', name: 'Urgent' })
      render(
        <ActiveFiltersBar
          {...defaultProps}
          labelFilter={['label-1']}
          labels={[label]}
        />
      )

      const buttons = screen.getAllByRole('button')
      const labelClearButton = buttons.find(btn =>
        btn.closest('span')?.textContent?.includes('Urgent')
      )

      await user.click(labelClearButton!)

      expect(mockHandlers.onClearLabel).toHaveBeenCalledWith('label-1')
    })
  })

  describe('Assignee filter display', () => {
    it('should display selected assignees', () => {
      const contacts = [
        createMockContact({ id: 'c1', name: 'John', lastname: 'Doe' }),
        createMockContact({ id: 'c2', name: 'Jane', lastname: 'Smith' }),
      ]
      render(
        <ActiveFiltersBar
          {...defaultProps}
          assigneeFilter={['c1', 'c2']}
          contacts={contacts}
        />
      )

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()
    })

    it('should handle names without lastname', () => {
      const contact = createMockContact({ id: 'c1', name: 'John', lastname: '' })
      render(
        <ActiveFiltersBar
          {...defaultProps}
          assigneeFilter={['c1']}
          contacts={[contact]}
        />
      )

      expect(screen.getByText('John')).toBeInTheDocument()
    })

    it('should call onClearAssignee with contact ID when X is clicked', async () => {
      const user = userEvent.setup()
      const contact = createMockContact({ id: 'c1', name: 'John', lastname: 'Doe' })
      render(
        <ActiveFiltersBar
          {...defaultProps}
          assigneeFilter={['c1']}
          contacts={[contact]}
        />
      )

      const buttons = screen.getAllByRole('button')
      const assigneeClearButton = buttons.find(btn =>
        btn.closest('span')?.textContent?.includes('John Doe')
      )

      await user.click(assigneeClearButton!)

      expect(mockHandlers.onClearAssignee).toHaveBeenCalledWith('c1')
    })
  })

  describe('Sort display', () => {
    it('should display deadline sort ascending', () => {
      render(
        <ActiveFiltersBar
          {...defaultProps}
          sortConfig={{ deadline: 'asc', assignee: null, category: null }}
        />
      )

      expect(screen.getByText(/sort.*deadline/i)).toBeInTheDocument()
    })

    it('should display multiple sort criteria', () => {
      render(
        <ActiveFiltersBar
          {...defaultProps}
          sortConfig={{ deadline: 'asc', assignee: 'desc', category: null }}
        />
      )

      const sortText = screen.getByText(/sort/i).closest('span')?.textContent
      expect(sortText).toContain('Deadline')
      expect(sortText).toContain('Assignee')
    })

    it('should call onClearSort when X is clicked', async () => {
      const user = userEvent.setup()
      render(
        <ActiveFiltersBar
          {...defaultProps}
          sortConfig={{ deadline: 'asc', assignee: null, category: null }}
        />
      )

      const buttons = screen.getAllByRole('button')
      const sortClearButton = buttons.find(btn =>
        btn.closest('span')?.textContent?.includes('Sort')
      )

      await user.click(sortClearButton!)

      expect(mockHandlers.onClearSort).toHaveBeenCalled()
    })
  })

  describe('Task status filter display', () => {
    it('should display completed status', () => {
      render(<ActiveFiltersBar {...defaultProps} taskStatusFilter="completed" />)

      expect(screen.getByText(/completed/i)).toBeInTheDocument()
    })

    it('should display deleted status', () => {
      render(<ActiveFiltersBar {...defaultProps} taskStatusFilter="deleted" />)

      expect(screen.getByText(/deleted/i)).toBeInTheDocument()
    })

    it('should call onClearTaskStatus when X is clicked', async () => {
      const user = userEvent.setup()
      render(<ActiveFiltersBar {...defaultProps} taskStatusFilter="completed" />)

      const buttons = screen.getAllByRole('button')
      const statusClearButton = buttons.find(btn =>
        btn.closest('span')?.textContent?.toLowerCase().includes('completed')
      )

      await user.click(statusClearButton!)

      expect(mockHandlers.onClearTaskStatus).toHaveBeenCalled()
    })
  })

  describe('Overdue filter display', () => {
    it('should display overdue filter', () => {
      render(<ActiveFiltersBar {...defaultProps} showOverdueOnly={true} />)

      expect(screen.getByText(/overdue/i)).toBeInTheDocument()
    })

    it('should call onClearOverdue when X is clicked', async () => {
      const user = userEvent.setup()
      render(<ActiveFiltersBar {...defaultProps} showOverdueOnly={true} />)

      const buttons = screen.getAllByRole('button')
      const overdueClearButton = buttons.find(btn =>
        btn.closest('span')?.textContent?.includes('Overdue')
      )

      await user.click(overdueClearButton!)

      expect(mockHandlers.onClearOverdue).toHaveBeenCalled()
    })
  })

  describe('Clear all button', () => {
    it('should display clear all button when filters are active', () => {
      render(<ActiveFiltersBar {...defaultProps} categoryFilter="todo" />)

      expect(screen.getByText(/clear all filters/i)).toBeInTheDocument()
    })

    it('should call onClearAll when clicked', async () => {
      const user = userEvent.setup()
      render(<ActiveFiltersBar {...defaultProps} categoryFilter="todo" />)

      await user.click(screen.getByText(/clear all filters/i))

      expect(mockHandlers.onClearAll).toHaveBeenCalled()
    })
  })

  describe('Multiple filters combined', () => {
    it('should display all active filters together', () => {
      const label = createMockLabel({ id: 'label-1', name: 'Urgent' })
      const contact = createMockContact({ id: 'c1', name: 'John', lastname: 'Doe' })

      render(
        <ActiveFiltersBar
          {...defaultProps}
          categoryFilter="todo"
          searchQuery="test"
          labelFilter={['label-1']}
          assigneeFilter={['c1']}
          labels={[label]}
          contacts={[contact]}
          showOverdueOnly={true}
        />
      )

      expect(screen.getByText(/"test"/)).toBeInTheDocument()
      expect(screen.getByText('To Do')).toBeInTheDocument()
      expect(screen.getByText('Urgent')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Overdue')).toBeInTheDocument()
    })
  })
})
