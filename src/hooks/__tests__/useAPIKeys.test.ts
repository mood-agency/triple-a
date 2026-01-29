import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

// Mock useAuth
const mockSession = {
  access_token: 'test-token-123',
}

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({ session: mockSession })),
}))

// Import after mocking
import { useAPIKeys } from '../useAPIKeys'
import { useAuth } from '@/contexts/AuthContext'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('useAPIKeys', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    vi.mocked(useAuth).mockReturnValue({ session: mockSession } as ReturnType<typeof useAuth>)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('fetchAPIKeys', () => {
    it('fetches API keys on mount', async () => {
      const mockKeys = [
        { id: '1', name: 'Key 1', created_at: '2024-01-01' },
        { id: '2', name: 'Key 2', created_at: '2024-01-02' },
      ]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockKeys }),
      })

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.apiKeys).toEqual(mockKeys)
      expect(result.current.error).toBeNull()
    })

    it('includes authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled()
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/keys'),
        expect.objectContaining({
          headers: {
            Authorization: 'Bearer test-token-123',
            'Content-Type': 'application/json',
          },
        })
      )
    })

    it('handles fetch error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      })

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Failed to fetch API keys')
      expect(result.current.apiKeys).toEqual([])
    })

    it('handles network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe('Network error')
      expect(result.current.apiKeys).toEqual([])
    })

    it('does not fetch when no session', async () => {
      vi.mocked(useAuth).mockReturnValue({ session: null } as ReturnType<typeof useAuth>)

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('handles empty data response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.apiKeys).toEqual([])
    })
  })

  describe('createAPIKey', () => {
    it('creates new API key', async () => {
      const newKey = { id: 'new-key', name: 'New Key', key: 'sk_live_xxx' }
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(newKey),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: 'new-key', name: 'New Key' }] }),
        })

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      let createResult: unknown
      await act(async () => {
        createResult = await result.current.createAPIKey({ name: 'New Key' })
      })

      expect(createResult).toEqual(newKey)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/keys'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'New Key' }),
        })
      )
    })

    it('throws when not authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({ session: null } as ReturnType<typeof useAuth>)

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await expect(result.current.createAPIKey({ name: 'Test' })).rejects.toThrow(
        'Not authenticated'
      )
    })

    it('handles create error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Invalid name' }),
        })

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await expect(result.current.createAPIKey({ name: '' })).rejects.toThrow('Invalid name')

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid name')
      })
    })
  })

  describe('revokeAPIKey', () => {
    it('revokes API key and updates state', async () => {
      const initialKeys = [
        { id: '1', name: 'Key 1' },
        { id: '2', name: 'Key 2' },
      ]
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: initialKeys }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.apiKeys).toHaveLength(2)
      })

      let revokeResult: boolean
      await act(async () => {
        revokeResult = await result.current.revokeAPIKey('1')
      })

      expect(revokeResult!).toBe(true)
      expect(result.current.apiKeys).toHaveLength(1)
      expect(result.current.apiKeys[0].id).toBe('2')
    })

    it('calls DELETE endpoint', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: '1', name: 'Key 1' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await act(async () => {
        await result.current.revokeAPIKey('1')
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/keys/1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })

    it('throws when not authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({ session: null } as ReturnType<typeof useAuth>)

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await expect(result.current.revokeAPIKey('1')).rejects.toThrow('Not authenticated')
    })

    it('handles revoke error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: '1', name: 'Key 1' }] }),
        })
        .mockResolvedValueOnce({
          ok: false,
          json: () => Promise.resolve({ error: 'Key not found' }),
        })

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      await expect(result.current.revokeAPIKey('1')).rejects.toThrow('Key not found')

      await waitFor(() => {
        expect(result.current.error).toBe('Key not found')
      })
    })
  })

  describe('refreshKeys', () => {
    it('refetches API keys', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: [{ id: '1', name: 'Key 1' }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [
                { id: '1', name: 'Key 1' },
                { id: '2', name: 'Key 2' },
              ],
            }),
        })

      const { result } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(result.current.apiKeys).toHaveLength(1)
      })

      await act(async () => {
        await result.current.refreshKeys()
      })

      expect(result.current.apiKeys).toHaveLength(2)
    })
  })

  describe('session changes', () => {
    it('refetches when session changes', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      const { rerender } = renderHook(() => useAPIKeys())

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })

      // Simulate session change
      vi.mocked(useAuth).mockReturnValue({
        session: { access_token: 'new-token' },
      } as ReturnType<typeof useAuth>)

      rerender()

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
      })
    })
  })
})
