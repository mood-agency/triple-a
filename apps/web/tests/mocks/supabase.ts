import { vi } from 'vitest'

/**
 * Mock Supabase client for testing
 *
 * This provides a minimal mock of the Supabase client that's sufficient
 * for most component and hook tests. For more complex scenarios,
 * you can extend this mock or create test-specific mocks.
 *
 * @example
 * ```tsx
 * import { mockSupabaseClient } from '@tests/mocks/supabase'
 *
 * vi.mock('@supabase/supabase-js', () => ({
 *   createClient: vi.fn(() => mockSupabaseClient)
 * }))
 * ```
 */

// Mock auth user
export const mockAuthUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
}

// Mock auth session
export const mockAuthSession = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: mockAuthUser,
}

// Create a mock query builder that can be chained
function createMockQueryBuilder(initialData: any[] = []) {
  let data = initialData
  let error = null
  let single = false

  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn(() => {
      single = true
      return builder
    }),
    maybeSingle: vi.fn(() => {
      single = true
      return builder
    }),
    then: vi.fn((resolve) => {
      // Simulate async behavior
      return Promise.resolve().then(() => {
        const result = single && data.length > 0 ? data[0] : data
        resolve({ data: result, error })
      })
    }),
  }

  return builder
}

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: mockAuthSession },
      error: null,
    }),
    getUser: vi.fn().mockResolvedValue({
      data: { user: mockAuthUser },
      error: null,
    }),
    signInWithPassword: vi.fn().mockResolvedValue({
      data: { user: mockAuthUser, session: mockAuthSession },
      error: null,
    }),
    signInWithOAuth: vi.fn().mockResolvedValue({
      data: { url: 'https://mock-oauth-url.com', provider: 'google' },
      error: null,
    }),
    signUp: vi.fn().mockResolvedValue({
      data: { user: mockAuthUser, session: mockAuthSession },
      error: null,
    }),
    signOut: vi.fn().mockResolvedValue({
      error: null,
    }),
    resetPasswordForEmail: vi.fn().mockResolvedValue({
      error: null,
    }),
    updateUser: vi.fn().mockResolvedValue({
      data: { user: mockAuthUser },
      error: null,
    }),
    onAuthStateChange: vi.fn((callback) => {
      // Immediately call the callback with SIGNED_IN event
      callback('SIGNED_IN', mockAuthSession)
      // Return unsubscribe function
      return {
        data: { subscription: { unsubscribe: vi.fn() } },
      }
    }),
  },
  from: vi.fn((table: string) => createMockQueryBuilder([])),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn().mockResolvedValue({ data: { path: 'mock-path' }, error: null }),
      download: vi.fn().mockResolvedValue({ data: new Blob(), error: null }),
      remove: vi.fn().mockResolvedValue({ data: null, error: null }),
      list: vi.fn().mockResolvedValue({ data: [], error: null }),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://mock-url.com' } })),
    })),
  },
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  channel: vi.fn(() => ({
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((callback) => {
      callback?.('SUBSCRIBED')
      return {
        unsubscribe: vi.fn(),
      }
    }),
  })),
}

/**
 * Helper to mock a successful auth state
 */
export function mockAuthenticatedUser(user = mockAuthUser) {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user },
    error: null,
  })
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: { ...mockAuthSession, user } },
    error: null,
  })
}

/**
 * Helper to mock an unauthenticated state
 */
export function mockUnauthenticatedUser() {
  mockSupabaseClient.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  })
  mockSupabaseClient.auth.getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  })
}

/**
 * Helper to mock a query response
 */
export function mockQueryResponse(table: string, data: any[], error: any = null) {
  const builder = createMockQueryBuilder(data)
  builder.error = error
  mockSupabaseClient.from.mockImplementation((t: string) => {
    if (t === table) {
      return builder
    }
    return createMockQueryBuilder([])
  })
}

/**
 * Reset all mocks to their default state
 */
export function resetSupabaseMocks() {
  vi.clearAllMocks()
  mockAuthenticatedUser()
}
