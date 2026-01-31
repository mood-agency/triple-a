# Testing Infrastructure

This directory contains the testing infrastructure for the Triple-A web application.

## Structure

```
tests/
├── setup/
│   └── setupTests.ts          # Global test setup (runs before all tests)
├── helpers/
│   └── render.tsx             # Custom render with providers
├── mocks/
│   ├── supabase.ts           # Mock Supabase client
│   └── data/
│       └── notes.ts          # Mock data factories
├── integration/              # Integration tests (coming soon)
└── README.md                 # This file
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run tests once
pnpm test:run

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## Writing Tests

### Basic Component Test

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { MyComponent } from './MyComponent'
import { createMockNote } from '@tests/mocks/data/notes'

describe('MyComponent', () => {
  it('should render', () => {
    const note = createMockNote({ content: 'Test' })
    render(<MyComponent note={note} />)

    expect(screen.getByText('Test')).toBeInTheDocument()
  })

  it('should handle user interaction', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(<MyComponent onClick={onClick} />)

    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })
})
```

### Testing Hooks

```tsx
import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMyHook } from './useMyHook'

describe('useMyHook', () => {
  it('should return expected value', () => {
    const { result } = renderHook(() => useMyHook())

    expect(result.current.value).toBe('expected')
  })
})
```

### Using Mock Data

```tsx
import {
  createMockNote,
  createMockTodo,
  createMockCompletedTodo,
  createMockMeeting,
  mockNotes,
} from '@tests/mocks/data/notes'

// Create a single mock note
const note = createMockNote({ content: 'Custom content' })

// Create a todo
const todo = createMockTodo({ deadline: '2026-02-01' })

// Use pre-defined mock notes
const notes = mockNotes

// Create multiple notes
const manyNotes = createMockNotes(10, { category: 'todo' })
```

### Mocking Supabase

```tsx
import { vi } from 'vitest'
import { mockSupabaseClient, mockQueryResponse } from '@tests/mocks/supabase'
import { createMockNote } from '@tests/mocks/data/notes'

// Mock the Supabase module
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient),
}))

// Mock a query response
const notes = [createMockNote(), createMockNote()]
mockQueryResponse('notes', notes)
```

## Test Organization

### Co-located Tests

Place tests next to the code they test:

```
src/
├── components/
│   ├── NoteCard.tsx
│   └── NoteCard.test.tsx      ← Co-located test
├── hooks/
│   ├── useNotes.ts
│   └── useNotes.test.ts        ← Co-located test
└── utils/
    ├── dateUtils.ts
    └── dateUtils.test.ts        ← Co-located test
```

### Integration Tests

Place integration tests in `tests/integration/`:

```tsx
// tests/integration/note-workflow.test.tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@tests/helpers/render'
import userEvent from '@testing-library/user-event'
import { Home } from '@/pages/Home'

describe('Note workflow', () => {
  it('should create, edit, and delete a note', async () => {
    const user = userEvent.setup()
    render(<Home />)

    // Create note
    await user.type(screen.getByRole('textbox'), 'New note')
    await user.click(screen.getByRole('button', { name: /add/i }))

    // Verify note appears
    expect(screen.getByText('New note')).toBeInTheDocument()

    // Edit note
    await user.click(screen.getByText('New note'))
    // ... continue workflow
  })
})
```

## What to Test

### ✅ Do Test

- **User interactions** - clicks, typing, form submissions
- **Component rendering** - conditional rendering, props
- **Business logic** - utilities, calculations, transformations
- **Hooks** - state management, side effects
- **Integration workflows** - multi-step user flows

### ❌ Don't Test

- **Third-party libraries** - they have their own tests
- **shadcn/ui components** - pre-tested by Radix UI
- **Implementation details** - internal state, CSS classes (unless critical)

## Coverage

Run coverage report:

```bash
pnpm test:coverage
```

Coverage thresholds (configured in `vitest.config.ts`):

- Statements: 70%
- Branches: 65%
- Functions: 70%
- Lines: 70%

Excluded from coverage:

- `src/components/ui/**` (shadcn components)
- Test files
- `tests/**` directory

## Path Aliases

The following path aliases are configured:

- `@/*` - Maps to `src/*`
- `@tests/*` - Maps to `tests/*`

Example:

```tsx
import { render } from '@tests/helpers/render'
import { createMockNote } from '@tests/mocks/data/notes'
import { MyComponent } from '@/components/MyComponent'
```

## Debugging Tests

### Use the Vitest UI

```bash
pnpm test:ui
```

Opens a web interface to run and debug tests.

### Use console.log

```tsx
import { screen } from '@testing-library/react'

// Print the entire DOM
screen.debug()

// Print a specific element
screen.debug(screen.getByText('Hello'))
```

### Use screen.logTestingPlaygroundURL()

```tsx
import { screen } from '@testing-library/react'

screen.logTestingPlaygroundURL()
// Opens Testing Playground with your current DOM
```

## Common Patterns

### Waiting for async operations

```tsx
import { waitFor } from '@testing-library/react'

await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})
```

### Testing forms

```tsx
import userEvent from '@testing-library/user-event'

const user = userEvent.setup()

await user.type(screen.getByLabelText('Name'), 'John')
await user.click(screen.getByRole('button', { name: /submit/i }))

expect(onSubmit).toHaveBeenCalledWith({ name: 'John' })
```

### Testing error states

```tsx
// Mock a failed query
mockQueryResponse('notes', [], { message: 'Failed to fetch' })

render(<NoteList />)

await waitFor(() => {
  expect(screen.getByText(/error/i)).toBeInTheDocument()
})
```

## Next Steps

1. Add more component tests as you develop features
2. Create integration tests for critical user workflows
3. Set up MSW handlers for API mocking (when needed)
4. Add E2E tests with Playwright (future Phase 3)

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Library Queries](https://testing-library.com/docs/queries/about)
- [Common Testing Mistakes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
