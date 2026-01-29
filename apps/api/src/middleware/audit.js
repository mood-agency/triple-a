/**
 * API Audit Logging Middleware for Hono
 *
 * Logs all API requests to the api_audit_log table in Supabase
 * Includes: method, path, status code, response time, user info, IP, user-agent
 *
 * Converted from Express middleware in server.js:520-551
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for audit logging');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Logs API requests to Supabase
 *
 * Reads from context:
 * - c.get('apiKey') - API key record (if authenticated)
 * - c.get('user') - User object (if authenticated)
 */
export const logApiRequest = async (c, next) => {
  const start = Date.now();

  // Execute the request
  await next();

  // Calculate response time
  const duration = Date.now() - start;

  // Get request details
  const method = c.req.method;
  const path = new URL(c.req.url).pathname;
  const statusCode = c.res.status;

  // Get auth details from context (set by authenticateApiKey middleware)
  const apiKey = c.get('apiKey');
  const user = c.get('user');

  // Get IP and user agent
  const ipAddress = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null;
  const userAgent = c.req.header('user-agent') || null;

  // Log to Supabase (non-blocking)
  supabaseAdmin
    .from('api_audit_log')
    .insert({
      api_key_id: apiKey?.id || null,
      user_id: user?.id || null,
      method,
      path,
      status_code: statusCode,
      ip_address: ipAddress,
      user_agent: userAgent,
      response_time_ms: duration,
    })
    .then(({ error }) => {
      if (error) {
        console.error('[Audit] Error logging request:', error);
      }
    })
    .catch((err) => {
      console.error('[Audit] Error logging request:', err);
    });
};
