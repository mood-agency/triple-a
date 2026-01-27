/**
 * CORS Middleware for Hono
 *
 * Handles Cross-Origin Resource Sharing (CORS) headers
 * and preflight OPTIONS requests
 */

export const corsMiddleware = async (c, next) => {
  // Get allowed origins from environment or use wildcard
  const allowedOrigins = process.env.ALLOWED_ORIGINS || '*';

  // Set CORS headers
  c.header('Access-Control-Allow-Origin', allowedOrigins);
  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'authorization, x-api-key, content-type');
  c.header('Access-Control-Max-Age', '86400'); // 24 hours

  // Handle preflight OPTIONS requests
  if (c.req.method === 'OPTIONS') {
    return c.text('ok', 200);
  }

  // Continue to next middleware
  await next();
};
