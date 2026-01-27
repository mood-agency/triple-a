/**
 * API Key Authentication Middleware for Hono
 *
 * Validates API keys using bcrypt hashing and checks:
 * - Key format (sk_live_*)
 * - Key validity (not revoked, not expired)
 * - Required scope for the endpoint
 *
 * Converted from Express middleware in server.js:417-514
 */

import bcrypt from 'bcrypt';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables for API key authentication');
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Authenticates requests using API keys
 *
 * Sets the following context variables:
 * - c.set('apiKey', keyRecord) - The API key record from database
 * - c.set('user', user) - The user object
 * - c.set('supabase', supabase) - Supabase client for the user
 */
export const authenticateApiKey = async (c, next) => {
  const apiKey = c.req.header('x-api-key');

  // Check for API key presence and format
  if (!apiKey || !apiKey.startsWith('sk_live_')) {
    return c.json(
      {
        error: 'Invalid API key format',
        code: 'INVALID_API_KEY',
      },
      401
    );
  }

  try {
    // Extract key prefix for initial lookup
    const keyPrefix = apiKey.substring(0, 16) + '...';

    // Get all non-revoked keys for this prefix
    // NOTE: This is O(n) lookup through all keys with matching prefix.
    // For production with many keys, consider adding a key_hash_prefix column
    // or using a faster hashing scheme with prefix lookup capability.
    const { data: allKeys, error: fetchError } = await supabaseAdmin
      .from('api_keys')
      .select('*')
      .eq('key_prefix', keyPrefix)
      .is('revoked_at', null);

    if (fetchError) {
      console.error('[Auth] Error fetching API keys:', fetchError);
      return c.json(
        {
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
        },
        500
      );
    }

    if (!allKeys || allKeys.length === 0) {
      return c.json(
        {
          error: 'Invalid API key',
          code: 'INVALID_API_KEY',
        },
        401
      );
    }

    // Find matching key using bcrypt compare
    let keyRecord = null;
    for (const key of allKeys) {
      const isMatch = await bcrypt.compare(apiKey, key.key_hash);
      if (isMatch) {
        keyRecord = key;
        break;
      }
    }

    if (!keyRecord) {
      return c.json(
        {
          error: 'Invalid API key',
          code: 'INVALID_API_KEY',
        },
        401
      );
    }

    // Check if key is revoked
    if (keyRecord.revoked_at) {
      return c.json(
        {
          error: 'API key has been revoked',
          code: 'API_KEY_REVOKED',
        },
        401
      );
    }

    // Check if key is expired
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
      return c.json(
        {
          error: 'API key has expired',
          code: 'API_KEY_EXPIRED',
        },
        401
      );
    }

    // Determine required scope based on HTTP method
    const method = c.req.method;
    let requiredScope = 'read';

    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      requiredScope = 'write';
    } else if (method === 'DELETE') {
      requiredScope = 'delete';
    }

    // Check if key has required scope
    if (!keyRecord.scopes.includes(requiredScope)) {
      return c.json(
        {
          error: `Insufficient scope. This endpoint requires '${requiredScope}' scope.`,
          code: 'INSUFFICIENT_SCOPE',
          details: {
            required: requiredScope,
            provided: keyRecord.scopes,
          },
        },
        403
      );
    }

    // Get user data
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      keyRecord.user_id
    );

    if (userError || !userData?.user) {
      console.error('[Auth] Error fetching user:', userError);
      return c.json(
        {
          error: 'Invalid API key: User not found',
          code: 'INVALID_API_KEY',
        },
        401
      );
    }

    // Update last_used_at timestamp (non-blocking)
    supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)
      .then(() => {})
      .catch((err) => console.error('[Auth] Error updating last_used_at:', err));

    // Create Supabase client for the user
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
      },
    });

    // Attach to context
    c.set('apiKey', keyRecord);
    c.set('user', userData.user);
    c.set('supabase', supabase);

    await next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return c.json(
      {
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
      },
      500
    );
  }
};
