import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Create mock supabase before importing the service
const mockGetSession = vi.fn()
const mockGetUser = vi.fn()
const mockFrom = vi.fn()

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      getUser: () => mockGetUser(),
    },
    from: (table: string) => mockFrom(table),
  },
}))

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// Import after mocking
import { googleCalendarService } from '../googleCalendarService'

describe('googleCalendarService', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockGetSession.mockReset()
    mockGetUser.mockReset()
    mockFrom.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getOAuthUrl', () => {
    const originalEnv = import.meta.env.VITE_GOOGLE_CLIENT_ID

    afterEach(() => {
      import.meta.env.VITE_GOOGLE_CLIENT_ID = originalEnv
    })

    it('throws error when VITE_GOOGLE_CLIENT_ID is not configured', () => {
      import.meta.env.VITE_GOOGLE_CLIENT_ID = ''
      expect(() => googleCalendarService.getOAuthUrl('http://localhost/callback')).toThrow(
        'VITE_GOOGLE_CLIENT_ID is not configured'
      )
    })

    it('returns properly formatted OAuth URL', () => {
      import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id'
      const url = googleCalendarService.getOAuthUrl('http://localhost/callback')

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth')
      expect(url).toContain('client_id=test-client-id')
      expect(url).toContain('redirect_uri=http%3A%2F%2Flocalhost%2Fcallback')
      expect(url).toContain('response_type=code')
      expect(url).toContain('access_type=offline')
      expect(url).toContain('prompt=consent')
      expect(url).toContain('scope=')
    })

    it('includes calendar scopes', () => {
      import.meta.env.VITE_GOOGLE_CLIENT_ID = 'test-client-id'
      const url = googleCalendarService.getOAuthUrl('http://localhost/callback')

      expect(url).toContain('calendar.readonly')
      expect(url).toContain('calendar.events')
    })
  })

  describe('exchangeCodeForTokens', () => {
    it('returns error when no session', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })

      const result = await googleCalendarService.exchangeCodeForTokens('code', 'http://localhost')
      expect(result).toEqual({ success: false, error: 'Not authenticated' })
    })

    it('calls API with correct parameters on success', async () => {
      // Method calls getSession twice: once for auth check, once in callApi
      mockGetSession
        .mockResolvedValueOnce({ data: { session: { access_token: 'token123' } }, error: null })
        .mockResolvedValueOnce({ data: { session: { access_token: 'token123' } }, error: null })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      })

      const result = await googleCalendarService.exchangeCodeForTokens('auth-code', 'http://localhost/cb')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gcal-auth'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            action: 'exchange',
            code: 'auth-code',
            redirectUri: 'http://localhost/cb',
          }),
        })
      )
      expect(result).toEqual({ success: true })
    })

    it('returns error on API failure', async () => {
      mockGetSession
        .mockResolvedValueOnce({ data: { session: { access_token: 'token123' } }, error: null })
        .mockResolvedValueOnce({ data: { session: { access_token: 'token123' } }, error: null })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ error: 'Invalid code' }),
      })

      const result = await googleCalendarService.exchangeCodeForTokens('bad-code', 'http://localhost')
      expect(result).toEqual({ success: false, error: 'Invalid code' })
    })
  })

  describe('getConnectionStatus', () => {
    it('returns not connected when no session', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: null },
        error: null,
      })

      const result = await googleCalendarService.getConnectionStatus()
      expect(result).toEqual({ isConnected: false, isExpired: false })
    })

    it('returns status from API', async () => {
      mockGetSession
        .mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null })
        .mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ isConnected: true, isExpired: false }),
      })

      const result = await googleCalendarService.getConnectionStatus()
      expect(result).toEqual({ isConnected: true, isExpired: false })
    })

    it('returns not connected on error', async () => {
      mockGetSession
        .mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null })
        .mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null })
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await googleCalendarService.getConnectionStatus()
      expect(result).toEqual({ isConnected: false, isExpired: false })
    })
  })

  describe('disconnect', () => {
    it('calls API with disconnect action', async () => {
      mockGetSession
        .mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null })
        .mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      })

      const result = await googleCalendarService.disconnect()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ action: 'disconnect' }),
        })
      )
      expect(result).toEqual({ success: true })
    })
  })

  describe('getCalendars', () => {
    it('returns calendars from API', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null,
      })
      const calendars = [
        { id: 'cal1', summary: 'Calendar 1' },
        { id: 'cal2', summary: 'Calendar 2' },
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ calendars }),
      })

      const result = await googleCalendarService.getCalendars()
      expect(result.calendars).toEqual(calendars)
    })

    it('returns empty array when API returns no calendars', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null,
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({}),
      })

      const result = await googleCalendarService.getCalendars()
      expect(result.calendars).toEqual([])
    })
  })

  describe('getEvents', () => {
    it('returns events from API', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null,
      })
      const events = [{ id: 'evt1', summary: 'Event 1' }]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ events }),
      })

      const result = await googleCalendarService.getEvents({
        calendarIds: ['cal1'],
        timeMin: '2026-01-01',
        timeMax: '2026-01-31',
      })

      expect(result.events).toEqual(events)
    })

    it('returns error on API failure', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null,
      })
      mockFetch.mockResolvedValueOnce({
        ok: false,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ error: 'Unauthorized' }),
      })

      const result = await googleCalendarService.getEvents({
        calendarIds: ['cal1'],
        timeMin: '2026-01-01',
        timeMax: '2026-01-31',
      })

      expect(result.error).toBe('Unauthorized')
      expect(result.events).toEqual([])
    })
  })

  describe('getConfig', () => {
    it('returns null when no user', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const result = await googleCalendarService.getConfig()
      expect(result).toBeNull()
    })

    it('returns null on PGRST116 error (no config found)', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user1' } },
        error: null,
      })
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      })

      const result = await googleCalendarService.getConfig()
      expect(result).toBeNull()
    })

    it('returns config with default calendars_to_sync', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user1' } },
        error: null,
      })
      const configData = {
        user_id: 'user1',
        sync_enabled: true,
      }
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: configData,
              error: null,
            }),
          }),
        }),
      })

      const result = await googleCalendarService.getConfig()
      expect(result).toMatchObject({
        user_id: 'user1',
        sync_enabled: true,
        calendars_to_sync: [],
      })
    })
  })

  describe('updateConfig', () => {
    it('returns error when no user', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const result = await googleCalendarService.updateConfig({ sync_enabled: true })
      expect(result).toEqual({ success: false, error: 'Not authenticated' })
    })

    it('upserts config successfully', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user1' } },
        error: null,
      })
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })

      const result = await googleCalendarService.updateConfig({ sync_enabled: true })

      expect(mockFrom).toHaveBeenCalledWith('google_calendar_config')
      expect(result).toEqual({ success: true })
    })
  })

  describe('getEventMappings', () => {
    it('returns empty array when no user', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const result = await googleCalendarService.getEventMappings()
      expect(result).toEqual([])
    })

    it('returns mappings from database', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user1' } },
        error: null,
      })
      const mappings = [
        { gcal_event_id: 'gcal1', note_id: 'note1' },
        { gcal_event_id: 'gcal2', note_id: 'note2' },
      ]
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: mappings,
            error: null,
          }),
        }),
      })

      const result = await googleCalendarService.getEventMappings()
      expect(result).toEqual(mappings)
    })
  })

  describe('saveEventMapping', () => {
    it('upserts mapping successfully', async () => {
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      })

      const result = await googleCalendarService.saveEventMapping({
        user_id: 'user1',
        gcal_event_id: 'gcal1',
        note_id: 'note1',
        calendar_id: 'cal1',
      })

      expect(mockFrom).toHaveBeenCalledWith('google_calendar_events')
      expect(result).toEqual({ success: true })
    })
  })

  describe('deleteEventMapping', () => {
    it('returns error when no user', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const result = await googleCalendarService.deleteEventMapping('gcal1')
      expect(result).toEqual({ success: false, error: 'Not authenticated' })
    })

    it('deletes mapping successfully', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user1' } },
        error: null,
      })
      mockFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      })

      const result = await googleCalendarService.deleteEventMapping('gcal1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('createEvent', () => {
    it('calls API and returns created event', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null,
      })
      const event = { id: 'evt1', summary: 'New Event' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ event }),
      })

      const result = await googleCalendarService.createEvent({
        calendarId: 'cal1',
        summary: 'New Event',
        start: '2026-01-15T10:00:00Z',
        end: '2026-01-15T11:00:00Z',
      })

      expect(result.event).toEqual(event)
    })
  })

  describe('updateEvent', () => {
    it('calls API and returns updated event', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null,
      })
      const event = { id: 'evt1', summary: 'Updated Event' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ event }),
      })

      const result = await googleCalendarService.updateEvent('cal1', 'evt1', {
        summary: 'Updated Event',
      })

      expect(result.event).toEqual(event)
    })
  })

  describe('deleteEvent', () => {
    it('calls API and returns success', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null,
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true }),
      })

      const result = await googleCalendarService.deleteEvent('cal1', 'evt1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('getAccounts', () => {
    it('returns empty array when no user', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const result = await googleCalendarService.getAccounts()
      expect(result).toEqual([])
    })

    it('returns accounts from database', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user1' } },
        error: null,
      })
      const accounts = [
        { id: 'acc1', email: 'user@gmail.com' },
        { id: 'acc2', email: 'user@work.com' },
      ]
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: accounts,
              error: null,
            }),
          }),
        }),
      })

      const result = await googleCalendarService.getAccounts()
      expect(result).toEqual(accounts)
    })
  })

  describe('addAccount', () => {
    it('calls API with add_account action', async () => {
      mockGetSession
        .mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null })
        .mockResolvedValueOnce({ data: { session: { access_token: 'token' } }, error: null })
      const account = { id: 'acc1', email: 'new@gmail.com' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ account }),
      })

      const result = await googleCalendarService.addAccount('code', 'http://localhost/cb')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({
            action: 'add_account',
            code: 'code',
            redirectUri: 'http://localhost/cb',
          }),
        })
      )
      expect(result).toEqual({ success: true, account })
    })
  })

  describe('removeAccount', () => {
    it('returns error when no user', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      })

      const result = await googleCalendarService.removeAccount('acc1')
      expect(result).toEqual({ success: false, error: 'Not authenticated' })
    })

    it('deletes account successfully', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user1' } },
        error: null,
      })
      mockFrom.mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      })

      const result = await googleCalendarService.removeAccount('acc1')
      expect(result).toEqual({ success: true })
    })
  })

  describe('getCalendarsForAccount', () => {
    it('calls API with accountId', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null,
      })
      const calendars = [{ id: 'cal1', summary: 'Calendar 1' }]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ calendars }),
      })

      const result = await googleCalendarService.getCalendarsForAccount('acc1')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify({ accountId: 'acc1' }),
        })
      )
      expect(result.calendars).toEqual(calendars)
    })
  })

  describe('API error handling', () => {
    it('throws error for non-JSON response', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'token' } },
        error: null,
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 404,
        headers: { get: () => 'text/html' },
      })

      const result = await googleCalendarService.getCalendars()
      expect(result.error).toContain('API endpoint not available')
    })

    it('includes authorization header when token exists', async () => {
      mockGetSession.mockResolvedValueOnce({
        data: { session: { access_token: 'my-token' } },
        error: null,
      })
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ calendars: [] }),
      })

      await googleCalendarService.getCalendars()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        })
      )
    })
  })
})
