import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Store original env
const originalEnv = { ...process.env };

// Set required env vars before importing
process.env.TRIPLE_A_API_KEY = 'sk_live_test_key_123';
process.env.TRIPLE_A_BASE_URL = 'http://localhost:3000';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after setting env vars
const { client } = await import('../../skills/lib/client.js');

describe('TripleAClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('request', () => {
    it('makes GET request with proper headers', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: 'test' }),
      });

      const result = await client.get('/api/v1/notes');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/v1/notes',
        expect.objectContaining({
          method: 'GET',
          headers: {
            'x-api-key': 'sk_live_test_key_123',
            'Content-Type': 'application/json',
          },
        })
      );
      expect(result).toEqual({ data: 'test' });
    });

    it('makes POST request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-note' }),
      });

      const result = await client.post('/api/v1/notes', { content: 'Test note' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ content: 'Test note' }),
        })
      );
      expect(result).toEqual({ id: 'new-note' });
    });

    it('makes PUT request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ updated: true }),
      });

      await client.put('/api/v1/notes/123', { content: 'Updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notes/123'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ content: 'Updated' }),
        })
      );
    });

    it('makes PATCH request with body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ patched: true }),
      });

      await client.patch('/api/v1/notes/123', { completed: true });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ completed: true }),
        })
      );
    });

    it('makes DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ deleted: true }),
      });

      await client.delete('/api/v1/notes/123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/notes/123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('throws error for non-OK response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'Not found', code: 'NOT_FOUND' }),
      });

      await expect(client.get('/api/v1/notes/999')).rejects.toMatchObject({
        message: 'Not found',
        code: 'NOT_FOUND',
        status: 404,
      });
    });

    it('handles error response with just statusText', async () => {
      // Return the same error for all retries
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400, // Use 400 to avoid retry logic
        statusText: 'Bad Request',
        json: () => Promise.reject(new Error('Not JSON')),
      });

      await expect(client.get('/api/v1/test')).rejects.toMatchObject({
        message: 'Bad Request',
        code: 'UNKNOWN_ERROR',
      });
    });

    it('retries on 429 rate limit', async () => {
      // First call returns 429, second succeeds
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: { get: () => '1' }, // 1 second retry
          json: () => Promise.resolve({ error: 'Rate limited' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: 'success' }),
        });

      // Use a shorter timeout for testing
      const originalSleep = client.sleep;
      client.sleep = vi.fn().mockResolvedValue(undefined);

      const result = await client.get('/api/v1/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'success' });

      client.sleep = originalSleep;
    });

    it('retries on 500 server error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Server error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: 'recovered' }),
        });

      const originalSleep = client.sleep;
      client.sleep = vi.fn().mockResolvedValue(undefined);

      const result = await client.get('/api/v1/test');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: 'recovered' });

      client.sleep = originalSleep;
    });

    it('stops retrying after max retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Persistent error', code: 'SERVER_ERROR' }),
      });

      const originalSleep = client.sleep;
      client.sleep = vi.fn().mockResolvedValue(undefined);

      await expect(client.get('/api/v1/test')).rejects.toMatchObject({
        message: 'Persistent error',
      });

      // Should try 3 times (initial + 2 retries)
      expect(mockFetch).toHaveBeenCalledTimes(3);

      client.sleep = originalSleep;
    });

    it('handles AbortError timeout', async () => {
      const abortError = new Error('Timeout');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(client.get('/api/v1/test')).rejects.toThrow('Request timeout');
    });

    it('handles network errors', async () => {
      const networkError = new TypeError('Failed to fetch');
      mockFetch.mockRejectedValueOnce(networkError);

      await expect(client.get('/api/v1/test')).rejects.toThrow('Network error');
    });
  });

  describe('formatError', () => {
    it('formats basic error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.formatError({ message: 'Test error' });

      expect(consoleSpy).toHaveBeenCalledWith('\n❌ Error:', 'Test error');
    });

    it('shows error code', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.formatError({ message: 'Test', code: 'INVALID_API_KEY' });

      expect(consoleSpy).toHaveBeenCalledWith('Code: INVALID_API_KEY');
    });

    it('shows error status', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.formatError({ message: 'Test', status: 403 });

      expect(consoleSpy).toHaveBeenCalledWith('Status: 403');
    });

    it('shows error details', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.formatError({ message: 'Test', details: { field: 'email' } });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Details:',
        expect.stringContaining('email')
      );
    });

    it('provides hint for INVALID_API_KEY', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.formatError({ message: 'Test', code: 'INVALID_API_KEY' });

      // Hint is logged as a separate call
      const allCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Hint:');
      expect(allCalls).toContain('TRIPLE_A_API_KEY');
    });

    it('provides hint for RATE_LIMIT_EXCEEDED', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.formatError({ message: 'Test', code: 'RATE_LIMIT_EXCEEDED' });

      const allCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Hint:');
      expect(allCalls).toContain('rate limit');
    });

    it('provides hint for NOT_FOUND', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      client.formatError({ message: 'Test', code: 'NOT_FOUND' });

      const allCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(allCalls).toContain('Hint:');
      expect(allCalls).toContain('resource does not exist');
    });
  });

  describe('sleep', () => {
    it('returns a promise that resolves after delay', async () => {
      vi.useFakeTimers();

      const promise = client.sleep(1000);

      vi.advanceTimersByTime(1000);

      await expect(promise).resolves.toBeUndefined();

      vi.useRealTimers();
    });
  });
});
