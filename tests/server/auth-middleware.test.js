import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

/**
 * Tests for API key authentication middleware logic
 *
 * Since the actual middleware depends on Supabase + bcrypt,
 * these tests verify the middleware's validation logic patterns
 * as implemented in the Hono handlers.
 */

describe('API key format validation', () => {
  function createAppWithAuthCheck() {
    const app = new Hono()
    app.use('/api/v1/*', async (c, next) => {
      const apiKey = c.req.header('x-api-key')
      if (!apiKey || !apiKey.startsWith('sk_live_')) {
        return c.json({ error: 'Invalid API key format', code: 'INVALID_API_KEY' }, 401)
      }
      // Simulate successful auth
      c.set('user', { id: 'user-1' })
      c.set('supabase', {})
      await next()
    })
    app.get('/api/v1/test', (c) => c.json({ ok: true }))
    app.post('/api/v1/test', (c) => c.json({ ok: true }))
    app.delete('/api/v1/test', (c) => c.json({ ok: true }))
    return app
  }

  it('rejects request without API key', async () => {
    const app = createAppWithAuthCheck()
    const res = await app.request('/api/v1/test')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('INVALID_API_KEY')
  })

  it('rejects API key with wrong prefix', async () => {
    const app = createAppWithAuthCheck()
    const res = await app.request('/api/v1/test', {
      headers: { 'x-api-key': 'wrong_prefix_key' },
    })
    expect(res.status).toBe(401)
  })

  it('accepts API key with correct prefix', async () => {
    const app = createAppWithAuthCheck()
    const res = await app.request('/api/v1/test', {
      headers: { 'x-api-key': 'sk_live_abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890' },
    })
    expect(res.status).toBe(200)
  })
})

describe('API key scope enforcement', () => {
  function createAppWithScopeCheck(keyScopes) {
    const app = new Hono()
    app.use('/api/v1/*', async (c, next) => {
      const method = c.req.method
      let requiredScope = 'read'
      if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
        requiredScope = 'write'
      } else if (method === 'DELETE') {
        requiredScope = 'delete'
      }

      if (!keyScopes.includes(requiredScope)) {
        return c.json({
          error: `Insufficient scope. This endpoint requires '${requiredScope}' scope.`,
          code: 'INSUFFICIENT_SCOPE',
          details: { required: requiredScope, provided: keyScopes },
        }, 403)
      }
      await next()
    })
    app.get('/api/v1/test', (c) => c.json({ ok: true }))
    app.post('/api/v1/test', (c) => c.json({ ok: true }))
    app.put('/api/v1/test', (c) => c.json({ ok: true }))
    app.patch('/api/v1/test', (c) => c.json({ ok: true }))
    app.delete('/api/v1/test', (c) => c.json({ ok: true }))
    return app
  }

  it('allows GET with read scope', async () => {
    const app = createAppWithScopeCheck(['read'])
    const res = await app.request('/api/v1/test')
    expect(res.status).toBe(200)
  })

  it('denies POST with read-only scope', async () => {
    const app = createAppWithScopeCheck(['read'])
    const res = await app.request('/api/v1/test', { method: 'POST' })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.code).toBe('INSUFFICIENT_SCOPE')
    expect(body.details.required).toBe('write')
  })

  it('allows POST with write scope', async () => {
    const app = createAppWithScopeCheck(['read', 'write'])
    const res = await app.request('/api/v1/test', { method: 'POST' })
    expect(res.status).toBe(200)
  })

  it('denies DELETE without delete scope', async () => {
    const app = createAppWithScopeCheck(['read', 'write'])
    const res = await app.request('/api/v1/test', { method: 'DELETE' })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.details.required).toBe('delete')
  })

  it('allows DELETE with delete scope', async () => {
    const app = createAppWithScopeCheck(['read', 'write', 'delete'])
    const res = await app.request('/api/v1/test', { method: 'DELETE' })
    expect(res.status).toBe(200)
  })

  it('PUT requires write scope', async () => {
    const app = createAppWithScopeCheck(['read'])
    const res = await app.request('/api/v1/test', { method: 'PUT' })
    expect(res.status).toBe(403)
  })

  it('PATCH requires write scope', async () => {
    const app = createAppWithScopeCheck(['read'])
    const res = await app.request('/api/v1/test', { method: 'PATCH' })
    expect(res.status).toBe(403)
  })
})

describe('API key expiration', () => {
  function createAppWithExpiryCheck(expiresAt) {
    const app = new Hono()
    app.use('/api/v1/*', async (c, next) => {
      if (expiresAt && new Date(expiresAt) < new Date()) {
        return c.json({ error: 'API key has expired', code: 'API_KEY_EXPIRED' }, 401)
      }
      await next()
    })
    app.get('/api/v1/test', (c) => c.json({ ok: true }))
    return app
  }

  it('rejects expired key', async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString() // yesterday
    const app = createAppWithExpiryCheck(pastDate)
    const res = await app.request('/api/v1/test')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('API_KEY_EXPIRED')
  })

  it('accepts non-expired key', async () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString() // tomorrow
    const app = createAppWithExpiryCheck(futureDate)
    const res = await app.request('/api/v1/test')
    expect(res.status).toBe(200)
  })

  it('accepts key with no expiration', async () => {
    const app = createAppWithExpiryCheck(null)
    const res = await app.request('/api/v1/test')
    expect(res.status).toBe(200)
  })
})

describe('API key revocation', () => {
  function createAppWithRevocationCheck(revokedAt) {
    const app = new Hono()
    app.use('/api/v1/*', async (c, next) => {
      if (revokedAt) {
        return c.json({ error: 'API key has been revoked', code: 'API_KEY_REVOKED' }, 401)
      }
      await next()
    })
    app.get('/api/v1/test', (c) => c.json({ ok: true }))
    return app
  }

  it('rejects revoked key', async () => {
    const app = createAppWithRevocationCheck('2026-01-01T00:00:00Z')
    const res = await app.request('/api/v1/test')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('API_KEY_REVOKED')
  })

  it('accepts non-revoked key', async () => {
    const app = createAppWithRevocationCheck(null)
    const res = await app.request('/api/v1/test')
    expect(res.status).toBe(200)
  })
})

describe('CORS middleware', () => {
  it('responds to OPTIONS preflight with 200', async () => {
    const app = new Hono()
    app.use('*', async (c, next) => {
      c.header('Access-Control-Allow-Origin', '*')
      c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
      c.header('Access-Control-Allow-Headers', 'authorization, x-api-key, content-type')
      c.header('Access-Control-Max-Age', '86400')
      if (c.req.method === 'OPTIONS') {
        return c.text('ok', 200)
      }
      await next()
    })
    app.get('/test', (c) => c.json({ ok: true }))

    const res = await app.request('/test', { method: 'OPTIONS' })
    expect(res.status).toBe(200)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('x-api-key')
  })
})
