import { ReactElement, ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { TooltipProvider } from '@/components/ui/tooltip'

/**
 * Custom render options
 */
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  /**
   * Initial route for the test
   * @default '/'
   */
  initialRoute?: string

  /**
   * Whether to include authenticated providers (SyncProvider, ProjectProvider, etc.)
   * Only enable this for integration tests that need the full provider tree
   * @default false
   */
  includeAuthenticatedProviders?: boolean
}

/**
 * All providers wrapper for tests
 */
function AllTheProviders({
  children,
  initialRoute = '/',
}: {
  children: ReactNode
  initialRoute?: string
}) {
  // Set initial route if provided
  if (initialRoute !== '/') {
    window.history.pushState({}, 'Test page', initialRoute)
  }

  return (
    <BrowserRouter>
      <ThemeProvider defaultTheme="light" storageKey="test-theme">
        <TooltipProvider delayDuration={0} disableHoverableContent>
          <AuthProvider>
            {children}
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

/**
 * Custom render function that wraps components with all necessary providers
 *
 * @example
 * ```tsx
 * import { render, screen } from '@tests/helpers/render'
 *
 * render(<NoteCard note={mockNote} />)
 * expect(screen.getByText('Test note')).toBeInTheDocument()
 * ```
 *
 * @example With initial route
 * ```tsx
 * render(<MyComponent />, { initialRoute: '/projects/123' })
 * ```
 */
function customRender(
  ui: ReactElement,
  options?: CustomRenderOptions
) {
  const { initialRoute = '/', ...renderOptions } = options || {}

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders initialRoute={initialRoute}>
        {children}
      </AllTheProviders>
    ),
    ...renderOptions,
  })
}

// Re-export everything from React Testing Library
export * from '@testing-library/react'

// Override the default render with our custom render
export { customRender as render }
