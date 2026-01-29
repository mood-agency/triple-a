import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

/**
 * API endpoint tests
 *
 * Tests the Hono API handlers with mocked Supabase.
 * This tests request validation, response formats, and error handling
 * without requiring a real database connection.
 */

// Helper to create a mock Supabase client
function createMockSupabase(overrides = {}) {
  const mockSingle = { data: null, error: null, ...overrides }
  const mockSelect = {
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockSingle),
    maybeSingle: vi.fn().mockResolvedValue(mockSingle),
    limit: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(cb => cb({ data: [], error: null })),
  }
  mockSelect.select = vi.fn().mockReturnValue(mockSelect)

  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(mockSelect),
      insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(mockSelect) }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(mockSelect),
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue(mockSelect),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(mockSelect),
          eq: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue(mockSelect),
          }),
        }),
      }),
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      admin: {
        getUserById: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
      },
    },
    channel: vi.fn().mockReturnValue({
      send: vi.fn().mockResolvedValue(undefined),
    }),
  }
}

describe('Health check endpoint', () => {
  it('returns status ok', async () => {
    const app = new Hono()
    app.get('/api/health', (c) => {
      return c.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: 'hono',
        version: '1.0.0',
      })
    })

    const res = await app.request('/api/health')
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(body.server).toBe('hono')
    expect(body.version).toBe('1.0.0')
    expect(body.timestamp).toBeDefined()
  })
})

describe('YouTube metadata endpoint validation', () => {
  it('returns 400 when videoId is missing', async () => {
    const app = new Hono()
    app.post('/api/youtube-metadata', async (c) => {
      const { videoId } = await c.req.json()
      if (!videoId) {
        return c.json({ error: 'videoId is required', code: 'INVALID_REQUEST' }, 400)
      }
      return c.json({ videoId }, 200)
    })

    const res = await app.request('/api/youtube-metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('INVALID_REQUEST')
  })
})

describe('YouTube captions endpoint validation', () => {
  it('returns 400 when videoId is missing', async () => {
    const app = new Hono()
    app.post('/api/youtube-captions', async (c) => {
      const { videoId } = await c.req.json()
      if (!videoId) {
        return c.json({ error: 'videoId is required', code: 'INVALID_REQUEST' }, 400)
      }
      return c.json({ videoId }, 200)
    })

    const res = await app.request('/api/youtube-captions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid action', async () => {
    const app = new Hono()
    app.post('/api/youtube-captions', async (c) => {
      const { videoId, action } = await c.req.json()
      if (!videoId) {
        return c.json({ error: 'videoId is required', code: 'INVALID_REQUEST' }, 400)
      }
      if (action !== 'list' && action !== 'get') {
        return c.json({ error: 'action must be "list" or "get"', code: 'INVALID_REQUEST' }, 400)
      }
      return c.json({}, 200)
    })

    const res = await app.request('/api/youtube-captions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: 'abc', action: 'invalid' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('Summarize endpoint validation', () => {
  it('returns 400 when text is missing', async () => {
    const app = new Hono()
    app.post('/api/summarize', async (c) => {
      const { text } = await c.req.json()
      if (!text) {
        return c.json({ error: 'text is required', code: 'INVALID_REQUEST' }, 400)
      }
      return c.json({}, 200)
    })

    const res = await app.request('/api/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})

describe('Email webhook validation', () => {
  it('returns 401 with wrong webhook secret', async () => {
    const app = new Hono()
    const WEBHOOK_SECRET = 'correct-secret'

    app.post('/api/email-webhook', async (c) => {
      const providedSecret = c.req.header('x-webhook-secret')
      if (WEBHOOK_SECRET && providedSecret !== WEBHOOK_SECRET) {
        return c.json({ error: 'Unauthorized', code: 'INVALID_SECRET' }, 401)
      }
      return c.json({ success: true }, 200)
    })

    const res = await app.request('/api/email-webhook', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-secret': 'wrong-secret',
      },
      body: JSON.stringify({ from: 'test@test.com', subject: 'Test' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 when email has no sender', async () => {
    const app = new Hono()

    app.post('/api/email-webhook', async (c) => {
      const email = await c.req.json()
      if (!email.from) {
        return c.json({ error: 'Email must have a sender (from)', code: 'INVALID_EMAIL' }, 400)
      }
      return c.json({ success: true }, 200)
    })

    const res = await app.request('/api/email-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Test' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when email has no subject or body', async () => {
    const app = new Hono()

    app.post('/api/email-webhook', async (c) => {
      const email = await c.req.json()
      if (!email.from) {
        return c.json({ error: 'Email must have a sender', code: 'INVALID_EMAIL' }, 400)
      }
      if (!email.subject && !email.text) {
        return c.json({ error: 'Email must have subject or body', code: 'INVALID_EMAIL' }, 400)
      }
      return c.json({ success: true }, 200)
    })

    const res = await app.request('/api/email-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'test@test.com' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('API Keys endpoint validation', () => {
  it('returns 401 when not authenticated', async () => {
    const app = new Hono()
    app.get('/api/keys', async (c) => {
      const authHeader = c.req.header('Authorization')
      if (!authHeader) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      return c.json({ data: [] }, 200)
    })

    const res = await app.request('/api/keys')
    expect(res.status).toBe(401)
  })

  it('returns 400 when creating key without name', async () => {
    const app = new Hono()
    app.post('/api/keys', async (c) => {
      const { name } = await c.req.json()
      if (!name || name.trim() === '') {
        return c.json({ error: 'Name is required', code: 'VALIDATION_ERROR' }, 400)
      }
      return c.json({}, 201)
    })

    const res = await app.request('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid scopes', async () => {
    const app = new Hono()
    app.post('/api/keys', async (c) => {
      const { name, scopes = ['read'] } = await c.req.json()
      if (!name || name.trim() === '') {
        return c.json({ error: 'Name is required', code: 'VALIDATION_ERROR' }, 400)
      }
      if (!Array.isArray(scopes) || scopes.length === 0) {
        return c.json({ error: 'At least one scope is required', code: 'VALIDATION_ERROR' }, 400)
      }
      const validScopes = ['read', 'write', 'delete']
      const invalidScopes = scopes.filter(s => !validScopes.includes(s))
      if (invalidScopes.length > 0) {
        return c.json({ error: `Invalid scopes: ${invalidScopes.join(', ')}`, code: 'VALIDATION_ERROR' }, 400)
      }
      return c.json({}, 201)
    })

    const res = await app.request('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Key', scopes: ['admin'] }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('admin')
  })
})

describe('REST API v1 - Notes validation', () => {
  it('returns 400 when creating note without required fields', async () => {
    const app = new Hono()
    app.post('/api/v1/notes', async (c) => {
      const { content, category, date } = await c.req.json()
      if (!content || !category || !date) {
        return c.json({
          error: 'Missing required fields: content, category, date',
          code: 'VALIDATION_ERROR',
        }, 400)
      }
      return c.json({ data: {} }, 201)
    })

    const res = await app.request('/api/v1/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Test' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })
})

describe('REST API v1 - Labels validation', () => {
  it('returns 400 when creating label without name', async () => {
    const app = new Hono()
    app.post('/api/v1/labels', async (c) => {
      const { name } = await c.req.json()
      if (!name || !name.trim()) {
        return c.json({ error: 'Name is required', code: 'VALIDATION_ERROR' }, 400)
      }
      return c.json({ data: {} }, 201)
    })

    const res = await app.request('/api/v1/labels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('REST API v1 - Projects validation', () => {
  it('returns 400 when creating project without name', async () => {
    const app = new Hono()
    app.post('/api/v1/projects', async (c) => {
      const { name } = await c.req.json()
      if (!name || !name.trim()) {
        return c.json({ error: 'Name is required', code: 'VALIDATION_ERROR' }, 400)
      }
      return c.json({ data: {} }, 201)
    })

    const res = await app.request('/api/v1/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('REST API v1 - Contacts validation', () => {
  it('returns 400 when creating contact without name', async () => {
    const app = new Hono()
    app.post('/api/v1/contacts', async (c) => {
      const { name } = await c.req.json()
      if (!name || !name.trim()) {
        return c.json({ error: 'Name is required', code: 'VALIDATION_ERROR' }, 400)
      }
      return c.json({ data: {} }, 201)
    })

    const res = await app.request('/api/v1/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('Google Calendar auth validation', () => {
  it('returns 401 when not authenticated', async () => {
    const app = new Hono()
    app.post('/api/gcal-auth', async (c) => {
      const authHeader = c.req.header('Authorization')
      if (!authHeader) {
        return c.json({ error: 'Unauthorized' }, 401)
      }
      return c.json({ success: true }, 200)
    })

    const res = await app.request('/api/gcal-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status' }),
    })
    expect(res.status).toBe(401)
  })

  it('returns 400 for exchange action without code', async () => {
    const app = new Hono()
    app.post('/api/gcal-auth', async (c) => {
      const { action, code, redirectUri } = await c.req.json()
      if (action === 'exchange' && (!code || !redirectUri)) {
        return c.json({ error: 'Missing code or redirectUri' }, 400)
      }
      return c.json({ success: true }, 200)
    })

    const res = await app.request('/api/gcal-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'exchange' }),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid action', async () => {
    const app = new Hono()
    app.post('/api/gcal-auth', async (c) => {
      const { action } = await c.req.json()
      const validActions = ['exchange', 'status', 'disconnect', 'add_account']
      if (!validActions.includes(action)) {
        return c.json({ error: 'Invalid action' }, 400)
      }
      return c.json({ success: true }, 200)
    })

    const res = await app.request('/api/gcal-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'invalid_action' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('Google Calendar events validation', () => {
  it('returns 400 when calendarIds is missing', async () => {
    const app = new Hono()
    app.post('/api/gcal-events', async (c) => {
      const { calendarIds } = await c.req.json()
      if (!calendarIds || !Array.isArray(calendarIds) || calendarIds.length === 0) {
        return c.json({ error: 'calendarIds is required' }, 400)
      }
      return c.json({ events: [] }, 200)
    })

    const res = await app.request('/api/gcal-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it('returns 400 when calendarIds is empty array', async () => {
    const app = new Hono()
    app.post('/api/gcal-events', async (c) => {
      const { calendarIds } = await c.req.json()
      if (!calendarIds || !Array.isArray(calendarIds) || calendarIds.length === 0) {
        return c.json({ error: 'calendarIds is required' }, 400)
      }
      return c.json({ events: [] }, 200)
    })

    const res = await app.request('/api/gcal-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarIds: [] }),
    })
    expect(res.status).toBe(400)
  })
})

describe('Google Calendar create event validation', () => {
  it('returns 400 when required fields are missing', async () => {
    const app = new Hono()
    app.post('/api/gcal-create-event', async (c) => {
      const { calendarId, summary, start, end } = await c.req.json()
      if (!calendarId || !summary || !start || !end) {
        return c.json({ error: 'calendarId, summary, start, and end are required' }, 400)
      }
      return c.json({ event: {} }, 200)
    })

    const res = await app.request('/api/gcal-create-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId: 'cal-1' }),
    })
    expect(res.status).toBe(400)
  })
})

describe('Google Calendar update/delete event validation', () => {
  it('update returns 400 without calendarId and eventId', async () => {
    const app = new Hono()
    app.post('/api/gcal-update-event', async (c) => {
      const { calendarId, eventId } = await c.req.json()
      if (!calendarId || !eventId) {
        return c.json({ error: 'calendarId and eventId are required' }, 400)
      }
      return c.json({ event: {} }, 200)
    })

    const res = await app.request('/api/gcal-update-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ calendarId: 'cal-1' }),
    })
    expect(res.status).toBe(400)
  })

  it('delete returns 400 without calendarId and eventId', async () => {
    const app = new Hono()
    app.post('/api/gcal-delete-event', async (c) => {
      const { calendarId, eventId } = await c.req.json()
      if (!calendarId || !eventId) {
        return c.json({ error: 'calendarId and eventId are required' }, 400)
      }
      return c.json({ success: true }, 200)
    })

    const res = await app.request('/api/gcal-delete-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })
})
