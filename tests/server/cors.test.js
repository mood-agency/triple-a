import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { corsMiddleware } from '../../middleware/cors.js';

describe('corsMiddleware', () => {
  let mockContext;
  let mockNext;
  let headers;

  beforeEach(() => {
    headers = {};
    mockContext = {
      req: {
        method: 'GET',
      },
      header: vi.fn((name, value) => {
        headers[name] = value;
      }),
      text: vi.fn((body, status) => ({ body, status })),
    };
    mockNext = vi.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sets CORS headers for non-OPTIONS requests', async () => {
    await corsMiddleware(mockContext, mockNext);

    expect(mockContext.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');
    expect(mockContext.header).toHaveBeenCalledWith(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    expect(mockContext.header).toHaveBeenCalledWith(
      'Access-Control-Allow-Headers',
      'authorization, x-api-key, content-type'
    );
    expect(mockContext.header).toHaveBeenCalledWith('Access-Control-Max-Age', '86400');
    expect(mockNext).toHaveBeenCalled();
  });

  it('handles OPTIONS preflight requests', async () => {
    mockContext.req.method = 'OPTIONS';

    const result = await corsMiddleware(mockContext, mockNext);

    expect(result).toEqual({ body: 'ok', status: 200 });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('continues to next middleware for GET requests', async () => {
    mockContext.req.method = 'GET';

    await corsMiddleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('continues to next middleware for POST requests', async () => {
    mockContext.req.method = 'POST';

    await corsMiddleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('continues to next middleware for PUT requests', async () => {
    mockContext.req.method = 'PUT';

    await corsMiddleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('continues to next middleware for PATCH requests', async () => {
    mockContext.req.method = 'PATCH';

    await corsMiddleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('continues to next middleware for DELETE requests', async () => {
    mockContext.req.method = 'DELETE';

    await corsMiddleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalled();
  });

  it('uses ALLOWED_ORIGINS environment variable when set', async () => {
    const originalEnv = process.env.ALLOWED_ORIGINS;
    process.env.ALLOWED_ORIGINS = 'https://example.com';

    await corsMiddleware(mockContext, mockNext);

    expect(mockContext.header).toHaveBeenCalledWith(
      'Access-Control-Allow-Origin',
      'https://example.com'
    );

    process.env.ALLOWED_ORIGINS = originalEnv;
  });

  it('uses wildcard origin when ALLOWED_ORIGINS not set', async () => {
    const originalEnv = process.env.ALLOWED_ORIGINS;
    delete process.env.ALLOWED_ORIGINS;

    await corsMiddleware(mockContext, mockNext);

    expect(mockContext.header).toHaveBeenCalledWith('Access-Control-Allow-Origin', '*');

    if (originalEnv) {
      process.env.ALLOWED_ORIGINS = originalEnv;
    }
  });
});
