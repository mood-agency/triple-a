/**
 * Rate Limiting Middleware for Hono
 *
 * Implements dynamic rate limiting based on API key configuration
 * Uses a two-pass approach:
 * 1. rateLimitKeyExtractor - Quick lookup of API key rate limit
 * 2. apiLimiter - Rate limiting using the extracted limit
 *
 * This runs BEFORE full authentication to prevent expensive bcrypt operations
 * on rate-limited requests.
 *
 * Based on: hono-rate-limiter package
 * Plan reference: middleware/rateLimit.js section
 */

import { rateLimiter } from 'hono-rate-limiter';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for rate limiting');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Extracts API key rate limit configuration
 *
 * Does a lightweight database lookup (no bcrypt) to get the rate limit
 * for the API key. This runs before the full authenticateApiKey middleware.
 *
 * Sets: c.set('rateLimitKey', { id, rate_limit })
 */
export const rateLimitKeyExtractor = async (c, next) => {
  const apiKey = c.req.header('x-api-key');

  // Only lookup if it's an API key format
  if (apiKey && apiKey.startsWith('sk_live_')) {
    try {
      const keyPrefix = apiKey.substring(0, 16) + '...';

      // Quick lookup - only get rate_limit, no bcrypt comparison
      const { data, error } = await supabaseAdmin
        .from('api_keys')
        .select('id, rate_limit')
        .eq('key_prefix', keyPrefix)
        .is('revoked_at', null)
        .single();

      if (!error && data) {
        c.set('rateLimitKey', data);
      }
    } catch (error) {
      // Silently fail - will use default rate limit
      console.error('[RateLimit] Error fetching API key rate limit:', error);
    }
  }

  await next();
};

/**
 * Rate limiter configuration
 *
 * Uses dynamic limits based on API key configuration or defaults to 100 req/min
 */
export const apiLimiter = rateLimiter({
  windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000, // 1 minute
  limit: (c) => {
    const rateLimitKey = c.get('rateLimitKey');
    return rateLimitKey?.rate_limit || 100; // Default to 100 requests/minute
  },
  keyGenerator: (c) => {
    // Use API key as identifier, fallback to IP
    const apiKey = c.req.header('x-api-key');
    if (apiKey) return apiKey;

    // Try various IP headers
    const ip =
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-forwarded-for') ||
      c.req.header('x-real-ip') ||
      'unknown';

    return ip;
  },
  handler: (c) => {
    return c.json(
      {
        error: 'Rate limit exceeded',
        code: 'RATE_LIMIT_EXCEEDED',
        details: {
          retry_after: 60,
        },
      },
      429
    );
  },
  standardHeaders: 'draft-7', // Adds RateLimit-* headers
});
