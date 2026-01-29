/**
 * Hono Server for Triple-A Application
 *
 * Migrated from Express.js (server.js)
 * 44 total endpoints:
 * - 1 Health check
 * - 2 YouTube API
 * - 1 AI Summarization
 * - 6 Google Calendar
 * - 1 Email webhook
 * - 3 API Keys management
 * - 31 REST API v1 (Notes, Labels, Projects, Contacts, History)
 */

import 'dotenv/config';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');

// Import middlewares
import { corsMiddleware } from './middleware/cors.js';
import { authenticateApiKey } from './middleware/auth.js';
import { logApiRequest } from './middleware/audit.js';
import { rateLimitKeyExtractor, apiLimiter } from './middleware/rateLimit.js';

// Import shared helpers
import { decodeHtmlEntities, parseJsonResponse, extractEmail } from './lib/server-helpers.js';

// Environment variables
const PORT = process.env.PORT || 3000;
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing required Supabase environment variables');
}

// Create Supabase admin client
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Initialize Hono app
const app = new Hono();

// ============================================================================
// GLOBAL MIDDLEWARE
// ============================================================================

// CORS - Applied to all routes
app.use('*', corsMiddleware);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitize error details for API responses.
 * In production, internal error messages are hidden to prevent information leakage.
 */
function sanitizeErrorDetails(error) {
  if (process.env.NODE_ENV === 'production') {
    return undefined;
  }
  return error?.message || String(error);
}

// decodeHtmlEntities, parseJsonResponse, extractEmail are imported from lib/server-helpers.js

/**
 * Verify user from Authorization header
 */
async function verifyUser(authHeader, supabase) {
  if (!authHeader) return null;

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

// ============================================================================
// PUBLIC ENDPOINTS
// ============================================================================

/**
 * Health Check Endpoint
 * GET /api/health
 */
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    server: 'hono',
    version: '1.0.0',
  });
});

// ============================================
// YouTube API Endpoints
// ============================================

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

/**
 * Get YouTube video metadata
 * POST /api/youtube-metadata
 * Body: { videoId: string }
 */
app.post('/api/youtube-metadata', async (c) => {
  try {
    const { videoId } = await c.req.json();

    if (!videoId) {
      return c.json({ error: 'videoId is required', code: 'INVALID_REQUEST' }, 400);
    }

    if (!YOUTUBE_API_KEY) {
      return c.json({ error: 'YouTube API not configured', code: 'NOT_CONFIGURED' }, 500);
    }

    const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet,contentDetails,statistics`;
    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      console.error('YouTube API error:', data);
      return c.json({
        error: 'YouTube API error',
        code: 'API_ERROR',
        details: data.error?.message,
      }, response.status);
    }

    if (!data.items || data.items.length === 0) {
      return c.json({ error: 'Video not found', code: 'VIDEO_NOT_FOUND' }, 404);
    }

    const video = data.items[0];
    const metadata = {
      videoId: video.id,
      title: video.snippet.title,
      channelName: video.snippet.channelTitle,
      channelId: video.snippet.channelId,
      thumbnailUrl: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
      duration: video.contentDetails.duration,
      publishedAt: video.snippet.publishedAt,
      viewCount: video.statistics?.viewCount,
      description: video.snippet.description,
    };

    return c.json(metadata, 200);
  } catch (error) {
    console.error('Error fetching YouTube metadata:', error);
    return c.json({
      error: 'Failed to fetch video metadata',
      code: 'NETWORK_ERROR',
      details: sanitizeErrorDetails(error),
    }, 500);
  }
});

/**
 * Get YouTube captions
 * POST /api/youtube-captions
 * Body: { videoId: string, action: 'list' | 'get', languageCode?: string }
 */
app.post('/api/youtube-captions', async (c) => {
  try {
    const { videoId, action, languageCode } = await c.req.json();

    if (!videoId) {
      return c.json({ error: 'videoId is required', code: 'INVALID_REQUEST' }, 400);
    }

    if (action === 'list') {
      if (!YOUTUBE_API_KEY) {
        return c.json({ error: 'YouTube API not configured', code: 'NOT_CONFIGURED' }, 500);
      }

      const url = `https://www.googleapis.com/youtube/v3/captions?videoId=${videoId}&key=${YOUTUBE_API_KEY}&part=snippet`;
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok) {
        console.log('Captions API returned error, checking for auto-captions');
        return c.json({ tracks: [] }, 200);
      }

      const tracks = (data.items || []).map((item) => ({
        id: item.id,
        language: item.snippet.language,
        languageName: item.snippet.name || item.snippet.language,
        kind: item.snippet.trackKind === 'ASR' ? 'asr' : 'standard',
        isDefault: item.snippet.isDefault || false,
      }));

      return c.json({ tracks }, 200);
    } else if (action === 'get') {
      try {
        const apiUrl = `https://youtubetranscript.com/?server_vid2=${videoId}`;
        const response = await fetch(apiUrl);
        const xml = await response.text();

        if (!response.ok || !xml.includes('<transcript>')) {
          return c.json({ error: 'No captions available', code: 'NO_CAPTIONS' }, 404);
        }

        const textMatches = xml.match(/<text[^>]*>([^<]*)<\/text>/g) || [];
        const segments = textMatches.map((match) => {
          const startMatch = match.match(/start="([^"]*)"/);
          const durMatch = match.match(/dur="([^"]*)"/);
          const textMatch = match.match(/>([^<]*)</);
          return {
            start: startMatch ? parseFloat(startMatch[1]) : 0,
            duration: durMatch ? parseFloat(durMatch[1]) : 0,
            text: textMatch ? decodeHtmlEntities(textMatch[1]) : '',
          };
        });

        const fullText = segments.map((s) => s.text).join(' ');

        return c.json({
          text: fullText,
          segments,
          language: languageCode || 'en',
          languageName: languageCode === 'es' ? 'Spanish' : 'English',
          isAutoGenerated: true,
        }, 200);
      } catch (transcriptError) {
        console.error('Error fetching transcript:', transcriptError);
        return c.json({ error: 'Failed to fetch captions', code: 'CAPTION_FETCH_FAILED' }, 404);
      }
    } else {
      return c.json({ error: 'action must be "list" or "get"', code: 'INVALID_REQUEST' }, 400);
    }
  } catch (error) {
    console.error('Error in youtube-captions:', error);
    return c.json({
      error: 'Failed to process captions request',
      code: 'PROCESSING_FAILED',
      details: sanitizeErrorDetails(error),
    }, 500);
  }
});

// ============================================
// Summarization API Endpoint
// ============================================

/**
 * Summarize text using AI
 * POST /api/summarize
 * Body: { text: string, videoTitle?: string, language?: string }
 */
app.post('/api/summarize', async (c) => {
  try {
    const { text, videoTitle, language = 'es' } = await c.req.json();

    if (!text) {
      return c.json({ error: 'text is required', code: 'INVALID_REQUEST' }, 400);
    }

    const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

    const maxLength = 100000;
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) + '...' : text;

    const systemPrompt =
      language === 'es'
        ? `Eres un asistente que resume contenido de videos. Responde siempre en español.`
        : `You are an assistant that summarizes video content. Always respond in English.`;

    const userPrompt =
      language === 'es'
        ? `Resume el siguiente texto${videoTitle ? ` del video "${videoTitle}"` : ''}. Proporciona:
1. Un resumen conciso (2-3 párrafos)
2. Una lista de 3-5 puntos clave
3. Los temas principales (como tags)

Texto:
${truncatedText}

Responde en formato JSON:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "topics": ["...", "..."]
}`
        : `Summarize the following text${videoTitle ? ` from the video "${videoTitle}"` : ''}. Provide:
1. A concise summary (2-3 paragraphs)
2. A list of 3-5 key points
3. Main topics (as tags)

Text:
${truncatedText}

Respond in JSON format:
{
  "summary": "...",
  "keyPoints": ["...", "..."],
  "topics": ["...", "..."]
}`;

    let result;

    if (ANTHROPIC_API_KEY) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Anthropic API error:', data);
        return c.json({
          error: 'AI summarization failed',
          code: 'SUMMARY_FAILED',
          details: data.error?.message,
        }, 500);
      }

      const content = data.content[0]?.text || '';
      result = parseJsonResponse(content);
    } else if (OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 2000,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('OpenAI API error:', data);
        return c.json({
          error: 'AI summarization failed',
          code: 'SUMMARY_FAILED',
          details: data.error?.message,
        }, 500);
      }

      const content = data.choices[0]?.message?.content || '';
      result = parseJsonResponse(content);
    } else {
      return c.json({ error: 'No AI API configured', code: 'NOT_CONFIGURED' }, 500);
    }

    return c.json(result, 200);
  } catch (error) {
    console.error('Error in summarize:', error);
    return c.json({
      error: 'Failed to summarize text',
      code: 'PROCESSING_FAILED',
      details: sanitizeErrorDetails(error),
    }, 500);
  }
});

// ============================================
// Email Webhook Endpoint
// ============================================

/**
 * Email webhook endpoint
 * POST /api/email-webhook
 * Receives emails from Cloudflare Email Routing and creates notes
 */
app.post('/api/email-webhook', async (c) => {
  try {
    const webhookSecret = process.env.EMAIL_WEBHOOK_SECRET;
    const providedSecret = c.req.header('x-webhook-secret');

    if (webhookSecret && providedSecret !== webhookSecret) {
      console.error('Invalid webhook secret');
      return c.json({ error: 'Unauthorized', code: 'INVALID_SECRET' }, 401);
    }

    const email = await c.req.json();

    console.log('Received email:', {
      from: email.from,
      to: email.to,
      subject: email.subject,
      hasText: !!email.text,
      hasHtml: !!email.html,
    });

    if (!email.from) {
      return c.json({ error: 'Email must have a sender (from)', code: 'INVALID_EMAIL' }, 400);
    }

    if (!email.subject && !email.text) {
      return c.json({ error: 'Email must have subject or body', code: 'INVALID_EMAIL' }, 400);
    }

    const fromEmail = extractEmail(email.from);
    if (!fromEmail) {
      return c.json({ error: 'Invalid sender email format', code: 'INVALID_EMAIL' }, 400);
    }

    const { data: userData, error: userError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', fromEmail)
      .single();

    if (userError || !userData) {
      console.error('User not found for email:', fromEmail);
      return c.json({
        error: 'User not found',
        code: 'USER_NOT_FOUND',
        message: 'No registered user with this email address',
      }, 404);
    }

    const userId = userData.id;
    const noteContent = email.subject || email.text?.substring(0, 500) || 'Email received';
    const noteDescription = email.text || email.html || null;

    const { data: note, error: insertError } = await supabaseAdmin
      .from('notes')
      .insert({
        user_id: userId,
        content: noteContent,
        description: noteDescription,
        category: 'todo',
        date: new Date().toISOString().split('T')[0],
        completed: false,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating note:', insertError);
      return c.json({
        error: 'Failed to create note',
        code: 'INSERT_FAILED',
        details: sanitizeErrorDetails(insertError),
      }, 500);
    }

    console.log('Note created successfully:', note.id);

    return c.json({
      success: true,
      noteId: note.id,
      message: `Task created: ${noteContent}`,
    }, 200);
  } catch (error) {
    console.error('Error in email-webhook:', error);
    return c.json({
      error: 'Failed to process email',
      code: 'PROCESSING_FAILED',
      details: sanitizeErrorDetails(error),
    }, 500);
  }
});

// ============================================
// API Keys Management Endpoints
// ============================================

/**
 * GET /api/keys
 * List all API keys for the authenticated user
 */
app.get('/api/keys', async (c) => {
  try {
    console.log('[/api/keys] Request received');
    const authHeader = c.req.header('Authorization');
    console.log('[/api/keys] Auth header present:', !!authHeader);

    const user = await verifyUser(authHeader, supabaseAdmin);
    console.log('[/api/keys] User verified:', user?.id || 'null');

    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    console.log('[/api/keys] Querying api_keys for user:', user.id);
    const { data: apiKeys, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, name, key_prefix, scopes, rate_limit, last_used_at, expires_at, created_at, updated_at')
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[/api/keys] Database error:', error);
      return c.json({ error: 'Failed to fetch API keys', details: error.message }, 500);
    }

    console.log('[/api/keys] Success, found', apiKeys?.length || 0, 'keys');
    return c.json({ data: apiKeys }, 200);
  } catch (error) {
    console.error('[/api/keys] Unexpected error:', error);
    return c.json({ error: 'Internal server error', details: error.message }, 500);
  }
});

/**
 * POST /api/keys
 * Create a new API key
 */
app.post('/api/keys', async (c) => {
  try {
    const user = await verifyUser(c.req.header('Authorization'), supabaseAdmin);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { name, scopes = ['read'], rate_limit = 100, expires_at } = await c.req.json();

    if (!name || name.trim() === '') {
      return c.json({ error: 'Name is required', code: 'VALIDATION_ERROR' }, 400);
    }

    if (!Array.isArray(scopes) || scopes.length === 0) {
      return c.json({ error: 'At least one scope is required', code: 'VALIDATION_ERROR' }, 400);
    }

    const validScopes = ['read', 'write', 'delete'];
    const invalidScopes = scopes.filter((s) => !validScopes.includes(s));
    if (invalidScopes.length > 0) {
      return c.json(
        { error: `Invalid scopes: ${invalidScopes.join(', ')}`, code: 'VALIDATION_ERROR' },
        400
      );
    }

    const randomBytes = crypto.randomBytes(32);
    const fullKey = `sk_live_${randomBytes.toString('hex')}`;
    const keyPrefix = fullKey.substring(0, 16) + '...';

    const saltRounds = 12;
    const keyHash = await bcrypt.hash(fullKey, saltRounds);

    const now = new Date().toISOString();

    const { data: apiKey, error: insertError } = await supabaseAdmin
      .from('api_keys')
      .insert({
        user_id: user.id,
        name: name.trim(),
        key_hash: keyHash,
        key_prefix: keyPrefix,
        scopes,
        rate_limit: parseInt(rate_limit, 10),
        expires_at: expires_at || null,
        created_at: now,
        updated_at: now,
      })
      .select('id, name, key_prefix, scopes, rate_limit, last_used_at, expires_at, created_at, updated_at')
      .single();

    if (insertError) {
      console.error('Error creating API key:', insertError);
      return c.json({ error: 'Failed to create API key' }, 500);
    }

    return c.json(
      {
        api_key: apiKey,
        full_key: fullKey,
        warning: 'Save this key securely. You will not be able to see it again.',
      },
      201
    );
  } catch (error) {
    console.error('Error in POST /api/keys:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/keys/:id
 * Revoke an API key (soft delete by setting revoked_at)
 */
app.delete('/api/keys/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const user = await verifyUser(c.req.header('Authorization'), supabaseAdmin);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const now = new Date().toISOString();

    const { data: revokedKey, error } = await supabaseAdmin
      .from('api_keys')
      .update({
        revoked_at: now,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .is('revoked_at', null)
      .select()
      .single();

    if (error || !revokedKey) {
      return c.json({ error: 'API key not found', code: 'NOT_FOUND' }, 404);
    }

    return c.json(
      {
        data: {
          success: true,
          id: revokedKey.id,
          revoked_at: revokedKey.revoked_at,
        },
      },
      200
    );
  } catch (error) {
    console.error('Error in DELETE /api/keys/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// Google Calendar API Endpoints
// ============================================

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

/**
 * Refresh Google OAuth token
 */
async function refreshGoogleToken(refreshToken, supabase, userId) {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      return { success: false };
    }

    const tokens = await response.json();
    const expiryDate = new Date(Date.now() + tokens.expires_in * 1000);

    await supabase
      .from('google_calendar_tokens')
      .update({
        access_token: tokens.access_token,
        token_expiry: expiryDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);

    return { success: true, accessToken: tokens.access_token };
  } catch (error) {
    console.warn('[refreshGoogleToken] Failed to refresh token:', error);
    return { success: false };
  }
}

/**
 * Get valid Google access token for user
 */
async function getGoogleAccessToken(supabase, userId) {
  const { data: tokenData, error } = await supabase
    .from('google_calendar_tokens')
    .select('access_token, token_expiry, refresh_token')
    .eq('user_id', userId)
    .single();

  if (error || !tokenData) {
    return { error: 'Google Calendar not connected' };
  }

  if (new Date(tokenData.token_expiry) < new Date()) {
    const refreshResult = await refreshGoogleToken(tokenData.refresh_token, supabase, userId);
    if (!refreshResult.success) {
      return { error: 'Failed to refresh token' };
    }
    return { accessToken: refreshResult.accessToken };
  }

  return { accessToken: tokenData.access_token };
}

/**
 * Google Calendar Auth endpoint
 * POST /api/gcal-auth
 * Body: { action: 'exchange' | 'status' | 'disconnect' | 'add_account', code?, redirectUri? }
 */
app.post('/api/gcal-auth', async (c) => {
  try {
    const user = await verifyUser(c.req.header('Authorization'), supabaseAdmin);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { action, code, redirectUri } = await c.req.json();

    switch (action) {
      case 'exchange': {
        if (!code || !redirectUri) {
          return c.json({ error: 'Missing code or redirectUri' }, 400);
        }

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
          return c.json({ error: 'Google Calendar not configured on server' }, 500);
        }

        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.json();
          console.error('Token exchange failed:', errorData);
          return c.json({ error: 'Failed to exchange code for tokens' }, 400);
        }

        const tokens = await tokenResponse.json();
        const expiryDate = new Date(Date.now() + tokens.expires_in * 1000);

        const { error: upsertError } = await supabaseAdmin
          .from('google_calendar_tokens')
          .upsert(
            {
              user_id: user.id,
              access_token: tokens.access_token,
              refresh_token: tokens.refresh_token || '',
              token_expiry: expiryDate.toISOString(),
              scope: tokens.scope,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          );

        if (upsertError) {
          console.error('Failed to store tokens:', upsertError);
          return c.json({ error: 'Failed to store tokens' }, 500);
        }

        await supabaseAdmin
          .from('google_calendar_config')
          .upsert(
            {
              user_id: user.id,
              enabled: true,
              calendars_to_sync: [],
              default_category: 'meeting',
              sync_interval_minutes: 15,
            },
            { onConflict: 'user_id' }
          );

        return c.json({ success: true }, 200);
      }

      case 'status': {
        const { data: tokenData } = await supabaseAdmin
          .from('google_calendar_tokens')
          .select('token_expiry')
          .eq('user_id', user.id)
          .single();

        const isConnected = !!tokenData;
        const isExpired = tokenData ? new Date(tokenData.token_expiry) < new Date() : false;

        return c.json({ isConnected, isExpired }, 200);
      }

      case 'disconnect': {
        await supabaseAdmin.from('google_calendar_tokens').delete().eq('user_id', user.id);
        await supabaseAdmin.from('google_calendar_config').delete().eq('user_id', user.id);
        await supabaseAdmin.from('google_calendar_events').delete().eq('user_id', user.id);

        return c.json({ success: true }, 200);
      }

      default:
        return c.json({ error: 'Invalid action' }, 400);
    }
  } catch (error) {
    console.error('Error in gcal-auth:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Google Calendar Calendars endpoint
 * POST /api/gcal-calendars
 */
app.post('/api/gcal-calendars', async (c) => {
  try {
    const user = await verifyUser(c.req.header('Authorization'), supabaseAdmin);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { accessToken, error: tokenError } = await getGoogleAccessToken(supabaseAdmin, user.id);
    if (tokenError) {
      return c.json({ error: tokenError }, 400);
    }

    const calendars = [];
    let pageToken;

    do {
      const params = new URLSearchParams({
        minAccessRole: 'reader',
        showDeleted: 'false',
        showHidden: 'false',
      });
      if (pageToken) params.set('pageToken', pageToken);

      const response = await fetch(`${GOOGLE_CALENDAR_API}/users/me/calendarList?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Google Calendar API error:', errorData);
        return c.json({ error: 'Failed to fetch calendars' }, response.status);
      }

      const data = await response.json();
      calendars.push(...data.items);
      pageToken = data.nextPageToken;
    } while (pageToken);

    const { data: configData } = await supabaseAdmin
      .from('google_calendar_config')
      .select('calendars_to_sync')
      .eq('user_id', user.id)
      .single();

    const selectedIds = configData?.calendars_to_sync || [];

    const formattedCalendars = calendars.map((cal) => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor,
      accessRole: cal.accessRole,
      selected: selectedIds.includes(cal.id),
    }));

    formattedCalendars.sort((a, b) => {
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return a.summary.localeCompare(b.summary);
    });

    return c.json({ calendars: formattedCalendars }, 200);
  } catch (error) {
    console.error('Error in gcal-calendars:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Google Calendar Events endpoint
 * POST /api/gcal-events
 * Body: { calendarIds: string[], timeMin?: string, timeMax?: string }
 */
app.post('/api/gcal-events', async (c) => {
  try {
    const user = await verifyUser(c.req.header('Authorization'), supabaseAdmin);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { accessToken, error: tokenError } = await getGoogleAccessToken(supabaseAdmin, user.id);
    if (tokenError) {
      return c.json({ error: tokenError }, 400);
    }

    const { calendarIds, timeMin, timeMax, maxResults = 100 } = await c.req.json();

    if (!calendarIds || !Array.isArray(calendarIds) || calendarIds.length === 0) {
      return c.json({ error: 'calendarIds is required' }, 400);
    }

    const defaultTimeMin = new Date();
    defaultTimeMin.setDate(defaultTimeMin.getDate() - 7);

    const defaultTimeMax = new Date();
    defaultTimeMax.setDate(defaultTimeMax.getDate() + 30);

    const allEvents = [];

    for (const calendarId of calendarIds) {
      try {
        const events = [];
        let pageToken;

        do {
          const params = new URLSearchParams({
            singleEvents: 'true',
            orderBy: 'startTime',
            maxResults: String(Math.min(maxResults, 250)),
            timeMin: timeMin || defaultTimeMin.toISOString(),
            timeMax: timeMax || defaultTimeMax.toISOString(),
          });
          if (pageToken) params.set('pageToken', pageToken);

          const response = await fetch(
            `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );

          if (!response.ok) {
            console.error(`Error fetching events from ${calendarId}`);
            break;
          }

          const data = await response.json();
          events.push(...(data.items || []));
          pageToken = data.nextPageToken;

          if (events.length >= maxResults) break;
        } while (pageToken);

        allEvents.push(...events);
      } catch (error) {
        console.error(`Error fetching events from calendar ${calendarId}:`, error);
      }
    }

    allEvents.sort((a, b) => {
      const aStart = a.start?.dateTime || a.start?.date || '';
      const bStart = b.start?.dateTime || b.start?.date || '';
      return aStart.localeCompare(bStart);
    });

    const filteredEvents = allEvents.filter((event) => event.status !== 'cancelled' && event.summary);

    return c.json({ events: filteredEvents }, 200);
  } catch (error) {
    console.error('Error in gcal-events:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Create Google Calendar Event endpoint
 * POST /api/gcal-create-event
 * Body: { calendarId: string, summary: string, description?: string, start: {...}, end: {...} }
 */
app.post('/api/gcal-create-event', async (c) => {
  try {
    const user = await verifyUser(c.req.header('Authorization'), supabaseAdmin);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { accessToken, error: tokenError } = await getGoogleAccessToken(supabaseAdmin, user.id);
    if (tokenError) {
      return c.json({ error: tokenError }, 400);
    }

    const { calendarId, summary, description, start, end } = await c.req.json();

    if (!calendarId || !summary || !start || !end) {
      return c.json({ error: 'calendarId, summary, start, and end are required' }, 400);
    }

    const eventBody = {
      summary,
      description: description || '',
      start,
      end,
    };

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Calendar API error creating event:', errorData);
      return c.json(
        { error: 'Failed to create event', details: errorData.error?.message },
        response.status
      );
    }

    const createdEvent = await response.json();
    return c.json({ event: createdEvent }, 200);
  } catch (error) {
    console.error('Error in gcal-create-event:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Update Google Calendar Event endpoint
 * POST /api/gcal-update-event
 * Body: { calendarId: string, eventId: string, summary?: string, description?: string, start?: {...}, end?: {...} }
 */
app.post('/api/gcal-update-event', async (c) => {
  try {
    const user = await verifyUser(c.req.header('Authorization'), supabaseAdmin);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { accessToken, error: tokenError } = await getGoogleAccessToken(supabaseAdmin, user.id);
    if (tokenError) {
      return c.json({ error: tokenError }, 400);
    }

    const { calendarId, eventId, summary, description, start, end } = await c.req.json();

    if (!calendarId || !eventId) {
      return c.json({ error: 'calendarId and eventId are required' }, 400);
    }

    const eventBody = {};
    if (summary !== undefined) eventBody.summary = summary;
    if (description !== undefined) eventBody.description = description;
    if (start !== undefined) eventBody.start = start;
    if (end !== undefined) eventBody.end = end;

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(eventBody),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Google Calendar API error updating event:', errorData);
      return c.json(
        { error: 'Failed to update event', details: errorData.error?.message },
        response.status
      );
    }

    const updatedEvent = await response.json();
    return c.json({ event: updatedEvent }, 200);
  } catch (error) {
    console.error('Error in gcal-update-event:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * Delete Google Calendar Event endpoint
 * POST /api/gcal-delete-event
 * Body: { calendarId: string, eventId: string }
 */
app.post('/api/gcal-delete-event', async (c) => {
  try {
    const user = await verifyUser(c.req.header('Authorization'), supabaseAdmin);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { accessToken, error: tokenError } = await getGoogleAccessToken(supabaseAdmin, user.id);
    if (tokenError) {
      return c.json({ error: tokenError }, 400);
    }

    const { calendarId, eventId } = await c.req.json();

    if (!calendarId || !eventId) {
      return c.json({ error: 'calendarId and eventId are required' }, 400);
    }

    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Google Calendar API error deleting event:', errorData);
      return c.json(
        { error: 'Failed to delete event', details: errorData.error?.message },
        response.status
      );
    }

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error('Error in gcal-delete-event:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// REST API v1 - Notes Endpoints
// ============================================

/**
 * Broadcast API mutation to connected clients via Supabase Realtime
 */
async function broadcastApiMutation(supabase, userId, table, operation, recordId) {
  try {
    const channel = supabase.channel(`sync-broadcast-${userId}`);
    await channel.send({
      type: 'broadcast',
      event: 'api-mutation',
      payload: {
        table,
        operation,
        record_id: recordId,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error broadcasting API mutation:', error);
  }
}

// ============================================
// PUBLIC ENDPOINTS (No authentication required)
// ============================================

/**
 * GET /api/public/notes/:slug
 * Fetch a publicly shared note by its slug (no authentication required)
 * Returns only safe fields: public_slug, content, description, category, deadline, created_at, labels, assignees
 */
app.get('/api/public/notes/:slug', async (c) => {
  try {
    const slug = c.req.param('slug');

    // Validate slug format
    if (!slug || slug.length < 8 || slug.length > 24) {
      return c.json({ error: 'Invalid slug', code: 'INVALID_SLUG' }, 400);
    }

    // Fetch the note by public_slug using admin client
    const { data: note, error: noteError } = await supabaseAdmin
      .from('notes')
      .select('id, public_slug, content, description, category, deadline, created_at')
      .eq('public_slug', slug)
      .eq('is_public', true)
      .is('deleted_at', null)
      .single();

    if (noteError || !note) {
      return c.json({ error: 'Note not found', code: 'NOT_FOUND' }, 404);
    }

    // Fetch labels associated with this note
    const { data: noteLabels } = await supabaseAdmin
      .from('note_labels')
      .select('labels(name, color)')
      .eq('note_id', note.id);

    const labels = (noteLabels || [])
      .map((nl) => nl.labels)
      .filter(Boolean);

    // Fetch assignees associated with this note
    const { data: noteAssignees } = await supabaseAdmin
      .from('note_assignees')
      .select('contacts(name)')
      .eq('note_id', note.id);

    const assignees = (noteAssignees || [])
      .map((na) => na.contacts?.name)
      .filter(Boolean);

    // Return only safe fields (no user_id, assignee_id, project_id, internal id)
    return c.json({
      data: {
        public_slug: note.public_slug,
        content: note.content,
        description: note.description,
        category: note.category,
        deadline: note.deadline,
        created_at: note.created_at,
        labels,
        assignees,
      },
    }, 200);
  } catch (error) {
    console.error('Error in GET /api/public/notes/:slug:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Apply middleware to all /api/v1/* routes
app.use('/api/v1/*', rateLimitKeyExtractor, apiLimiter, authenticateApiKey, logApiRequest);

/**
 * GET /api/v1/notes
 * List notes with filters and pagination
 */
app.get('/api/v1/notes', async (c) => {
  try {
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const date = c.req.query('date');
    const project_id = c.req.query('project_id');
    const completed = c.req.query('completed');
    const category = c.req.query('category');
    const pinned = c.req.query('pinned');
    const assignee_ids = c.req.queries('assignee_ids'); // New: multiple assignees filter
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);
    const sort = c.req.query('sort') || 'created_at';
    const order = c.req.query('order') || 'desc';

    let query = supabase
      .from('notes')
      .select('*, note_labels(label_id), note_assignees(contact_id)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (date) query = query.eq('date', date);
    if (project_id !== undefined) query = query.eq('project_id', project_id);
    if (completed !== undefined) query = query.eq('completed', completed === 'true');
    if (category) query = query.eq('category', category);
    if (pinned !== undefined) query = query.eq('pinned', pinned === 'true');

    // Filter by assignees via note_assignees junction table
    if (assignee_ids && assignee_ids.length > 0) {
      // Filter notes that have any of the specified assignees
      const { data: noteIdsWithAssignees } = await supabase
        .from('note_assignees')
        .select('note_id')
        .in('contact_id', assignee_ids);

      if (noteIdsWithAssignees && noteIdsWithAssignees.length > 0) {
        const noteIds = noteIdsWithAssignees.map(n => n.note_id);
        query = query.in('id', noteIds);
      } else {
        // No notes match, return empty result
        return c.json({
          data: [],
          pagination: { total: 0, limit, offset, has_more: false },
        }, 200);
      }
    } else if (assignee_id) {
      // Legacy: single assignee filter via note_assignees
      const { data: noteIdsWithAssignee } = await supabase
        .from('note_assignees')
        .select('note_id')
        .eq('contact_id', assignee_id);

      if (noteIdsWithAssignee && noteIdsWithAssignee.length > 0) {
        const noteIds = noteIdsWithAssignee.map(n => n.note_id);
        query = query.in('id', noteIds);
      } else {
        return c.json({
          data: [],
          pagination: { total: 0, limit, offset, has_more: false },
        }, 200);
      }
    }

    const { count, error: countError } = await supabase
      .from('notes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (countError) {
      return c.json({ error: 'Failed to count notes' }, 500);
    }

    query = query.order(sort, { ascending: order === 'asc' }).range(offset, offset + limit - 1);

    const { data: notes, error } = await query;

    if (error) {
      console.error('Error fetching notes:', error);
      return c.json({ error: 'Failed to fetch notes' }, 500);
    }

    const notesWithRelations = notes.map((note) => {
      const labels = note.note_labels ? note.note_labels.map((nl) => nl.label_id) : [];
      const assignee_ids = note.note_assignees ? note.note_assignees.map((na) => na.contact_id) : [];
      const { note_labels, note_assignees, ...noteData } = note;
      return { ...noteData, labels, assignee_ids };
    });

    return c.json({
      data: notesWithRelations,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: offset + limit < (count || 0),
      },
    }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/notes:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/v1/notes/:id
 * Get a specific note by ID
 */
app.get('/api/v1/notes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const { data: note, error } = await supabase
      .from('notes')
      .select('*, note_labels(label_id), note_assignees(contact_id)')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error || !note) {
      return c.json({ error: 'Note not found', code: 'NOT_FOUND' }, 404);
    }

    const labels = note.note_labels ? note.note_labels.map((nl) => nl.label_id) : [];
    const assignee_ids = note.note_assignees ? note.note_assignees.map((na) => na.contact_id) : [];
    const { note_labels, note_assignees, ...noteData } = note;

    return c.json({ data: { ...noteData, labels, assignee_ids } }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/notes/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/v1/notes
 * Create a new note
 */
app.post('/api/v1/notes', async (c) => {
  try {
    const { content, description, category, date, deadline, project_id, assignee_ids, labels } =
      await c.req.json();

    if (!content || !category || !date) {
      return c.json(
        { error: 'Missing required fields: content, category, date', code: 'VALIDATION_ERROR' },
        400
      );
    }

    const userId = c.get('user').id;
    const supabase = c.get('supabase');
    const now = new Date().toISOString();

    const { data: existingNotes } = await supabase
      .from('notes')
      .select('sort_order')
      .eq('user_id', userId)
      .eq('date', date)
      .order('sort_order', { ascending: false })
      .limit(1);

    const sortOrder = existingNotes && existingNotes.length > 0 ? existingNotes[0].sort_order + 1 : 0;

    const { data: note, error: insertError } = await supabase
      .from('notes')
      .insert({
        user_id: userId,
        date,
        content,
        description: description || null,
        category,
        completed: false,
        deadline: deadline || null,
        pinned: false,
        sort_order: sortOrder,
        project_id: project_id || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating note:', insertError);
      return c.json({ error: 'Failed to create note' }, 500);
    }

    // Insert labels into note_labels junction table
    if (labels && labels.length > 0) {
      const labelInserts = labels.map((labelId) => ({
        note_id: note.id,
        label_id: labelId,
        created_at: now,
      }));

      await supabase.from('note_labels').insert(labelInserts);
    }

    // Insert assignees into note_assignees junction table
    if (assignee_ids && assignee_ids.length > 0) {
      const assigneeInserts = assignee_ids.map((contactId) => ({
        note_id: note.id,
        contact_id: contactId,
        created_at: now,
      }));

      await supabase.from('note_assignees').insert(assigneeInserts);
    }

    await broadcastApiMutation(supabase, userId, 'notes', 'insert', note.id);

    return c.json({ data: { ...note, labels: labels || [], assignee_ids: assignee_ids || [] } }, 201);
  } catch (error) {
    console.error('Error in POST /api/v1/notes:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/v1/notes/:id
 * Update entire note
 */
app.put('/api/v1/notes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { content, description, category, date, deadline, completed, pinned, project_id, assignee_ids, labels } =
      await c.req.json();

    const userId = c.get('user').id;
    const supabase = c.get('supabase');
    const now = new Date().toISOString();

    const { data: existingNote, error: fetchError } = await supabase
      .from('notes')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingNote) {
      return c.json({ error: 'Note not found', code: 'NOT_FOUND' }, 404);
    }

    const { data: note, error: updateError } = await supabase
      .from('notes')
      .update({
        content,
        description: description !== undefined ? description : null,
        category,
        date,
        deadline: deadline !== undefined ? deadline : null,
        completed: completed !== undefined ? completed : false,
        pinned: pinned !== undefined ? pinned : false,
        project_id: project_id !== undefined ? project_id : null,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating note:', updateError);
      return c.json({ error: 'Failed to update note' }, 500);
    }

    // Update labels in note_labels junction table
    if (labels !== undefined) {
      await supabase.from('note_labels').delete().eq('note_id', id);

      if (labels.length > 0) {
        const labelInserts = labels.map((labelId) => ({
          note_id: id,
          label_id: labelId,
          created_at: now,
        }));

        await supabase.from('note_labels').insert(labelInserts);
      }
    }

    // Update assignees in note_assignees junction table
    if (assignee_ids !== undefined) {
      await supabase.from('note_assignees').delete().eq('note_id', id);

      if (assignee_ids.length > 0) {
        const assigneeInserts = assignee_ids.map((contactId) => ({
          note_id: id,
          contact_id: contactId,
          created_at: now,
        }));

        await supabase.from('note_assignees').insert(assigneeInserts);
      }
    }

    await broadcastApiMutation(supabase, userId, 'notes', 'update', id);

    return c.json({ data: { ...note, labels: labels || [], assignee_ids: assignee_ids || [] } }, 200);
  } catch (error) {
    console.error('Error in PUT /api/v1/notes/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PATCH /api/v1/notes/:id
 * Partially update a note
 */
app.patch('/api/v1/notes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const updateFields = await c.req.json();

    const userId = c.get('user').id;
    const supabase = c.get('supabase');
    const now = new Date().toISOString();

    const { data: existingNote, error: fetchError } = await supabase
      .from('notes')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existingNote) {
      return c.json({ error: 'Note not found', code: 'NOT_FOUND' }, 404);
    }

    const { labels, assignee_ids, ...noteFields } = updateFields;

    if (Object.keys(noteFields).length > 0) {
      const { error: updateError } = await supabase
        .from('notes')
        .update({ ...noteFields, updated_at: now })
        .eq('id', id);

      if (updateError) {
        console.error('Error updating note:', updateError);
        return c.json({ error: 'Failed to update note' }, 500);
      }
    }

    // Update labels in note_labels junction table
    if (labels !== undefined) {
      await supabase.from('note_labels').delete().eq('note_id', id);

      if (labels.length > 0) {
        const labelInserts = labels.map((labelId) => ({
          note_id: id,
          label_id: labelId,
          created_at: now,
        }));

        await supabase.from('note_labels').insert(labelInserts);
      }
    }

    // Update assignees in note_assignees junction table
    if (assignee_ids !== undefined) {
      await supabase.from('note_assignees').delete().eq('note_id', id);

      if (assignee_ids.length > 0) {
        const assigneeInserts = assignee_ids.map((contactId) => ({
          note_id: id,
          contact_id: contactId,
          created_at: now,
        }));

        await supabase.from('note_assignees').insert(assigneeInserts);
      }
    }

    const { data: note } = await supabase
      .from('notes')
      .select('*, note_labels(label_id), note_assignees(contact_id)')
      .eq('id', id)
      .single();

    const noteLabels = note.note_labels ? note.note_labels.map((nl) => nl.label_id) : [];
    const noteAssignees = note.note_assignees ? note.note_assignees.map((na) => na.contact_id) : [];
    const { note_labels: _, note_assignees: __, ...noteData } = note;

    await broadcastApiMutation(supabase, userId, 'notes', 'update', id);

    return c.json({ data: { ...noteData, labels: noteLabels, assignee_ids: noteAssignees } }, 200);
  } catch (error) {
    console.error('Error in PATCH /api/v1/notes/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/v1/notes/:id
 * Soft delete a note
 */
app.delete('/api/v1/notes/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');
    const now = new Date().toISOString();

    const { data: note, error } = await supabase
      .from('notes')
      .update({
        deleted_at: now,
        deleted_reason: 'Deleted via API',
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error || !note) {
      return c.json({ error: 'Note not found', code: 'NOT_FOUND' }, 404);
    }

    await broadcastApiMutation(supabase, userId, 'notes', 'delete', id);

    return c.json({ data: { success: true, id } }, 200);
  } catch (error) {
    console.error('Error in DELETE /api/v1/notes/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/v1/notes/search
 * Search notes with text query and filters
 */
app.post('/api/v1/notes/search', async (c) => {
  try {
    const { query, filters = {}, limit = 50, offset = 0 } = await c.req.json();

    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    let dbQuery = supabase
      .from('notes')
      .select('*, note_labels(label_id), note_assignees(contact_id)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (query && query.trim()) {
      dbQuery = dbQuery.or(`content.ilike.%${query}%,description.ilike.%${query}%`);
    }

    if (filters.category) dbQuery = dbQuery.eq('category', filters.category);
    if (filters.completed !== undefined) dbQuery = dbQuery.eq('completed', filters.completed);
    if (filters.date_from) dbQuery = dbQuery.gte('date', filters.date_from);
    if (filters.date_to) dbQuery = dbQuery.lte('date', filters.date_to);
    if (filters.project_id) dbQuery = dbQuery.eq('project_id', filters.project_id);

    dbQuery = dbQuery.order('updated_at', { ascending: false }).range(offset, offset + limit - 1);

    const { data: notes, error } = await dbQuery;

    if (error) {
      console.error('Error searching notes:', error);
      return c.json({ error: 'Failed to search notes' }, 500);
    }

    const notesWithRelations = notes.map((note) => {
      const labels = note.note_labels ? note.note_labels.map((nl) => nl.label_id) : [];
      const assignee_ids = note.note_assignees ? note.note_assignees.map((na) => na.contact_id) : [];
      const { note_labels, note_assignees, ...noteData } = note;
      return { ...noteData, labels, assignee_ids };
    });

    return c.json({
      data: notesWithRelations,
      pagination: {
        limit,
        offset,
        has_more: notesWithRelations.length === limit,
      },
    }, 200);
  } catch (error) {
    console.error('Error in POST /api/v1/notes/search:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/v1/notes/:id/history
 * Get history for a specific note (combines note_versions and note_actions)
 */
app.get('/api/v1/notes/:id/history', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const { data: note } = await supabase
      .from('notes')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (!note) {
      return c.json({ error: 'Note not found', code: 'NOT_FOUND' }, 404);
    }

    // Fetch from note_versions (content snapshots)
    const { data: versions, error: versionsError } = await supabase
      .from('note_versions')
      .select('*')
      .eq('note_id', id);

    if (versionsError) {
      console.error('Error fetching note versions:', versionsError);
    }

    // Fetch from note_actions (postponed actions)
    const { data: actions, error: actionsError } = await supabase
      .from('note_actions')
      .select('*')
      .eq('note_id', id);

    if (actionsError) {
      console.error('Error fetching note actions:', actionsError);
    }

    // Transform versions to unified history format
    const versionsHistory = (versions || []).map((v) => ({
      id: v.id,
      note_id: v.note_id,
      user_id: v.user_id,
      content: v.content,
      description: v.description,
      category: v.category,
      completed: v.completed,
      changed_at: v.created_at,
      action_type: v.version_number === 1 ? 'created' : 'edit',
      reason: null,
      previous_date: null,
    }));

    // Transform actions to unified history format
    const actionsHistory = (actions || []).map((a) => ({
      id: a.id,
      note_id: a.note_id,
      user_id: a.user_id,
      content: null,
      description: null,
      category: null,
      completed: null,
      changed_at: a.created_at,
      action_type: a.action_type,
      reason: a.reason,
      previous_date: a.previous_date,
    }));

    // Combine and sort by changed_at descending
    const history = [...versionsHistory, ...actionsHistory].sort(
      (a, b) => new Date(b.changed_at) - new Date(a.changed_at)
    );

    return c.json({ data: history }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/notes/:id/history:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// REST API v1 - Labels Endpoints
// ============================================

/**
 * GET /api/v1/labels
 * List all labels for the user
 */
app.get('/api/v1/labels', async (c) => {
  try {
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const { data: labels, error } = await supabase
      .from('labels')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching labels:', error);
      return c.json({ error: 'Failed to fetch labels' }, 500);
    }

    return c.json({ data: labels || [] }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/labels:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/v1/labels/:id
 * Get a specific label
 */
app.get('/api/v1/labels/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const { data: label, error } = await supabase
      .from('labels')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !label) {
      return c.json({ error: 'Label not found', code: 'NOT_FOUND' }, 404);
    }

    return c.json({ data: label }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/labels/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/v1/labels
 * Create a new label
 */
app.post('/api/v1/labels', async (c) => {
  try {
    const { name, color } = await c.req.json();

    if (!name || !name.trim()) {
      return c.json({ error: 'Name is required', code: 'VALIDATION_ERROR' }, 400);
    }

    const userId = c.get('user').id;
    const supabase = c.get('supabase');
    const now = new Date().toISOString();

    const { data: label, error: insertError } = await supabase
      .from('labels')
      .insert({
        user_id: userId,
        name: name.trim(),
        color: color || '#gray',
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating label:', insertError);
      return c.json({ error: 'Failed to create label' }, 500);
    }

    await broadcastApiMutation(supabase, userId, 'labels', 'insert', label.id);

    return c.json({ data: label }, 201);
  } catch (error) {
    console.error('Error in POST /api/v1/labels:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/v1/labels/:id
 * Update a label
 */
app.put('/api/v1/labels/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { name, color } = await c.req.json();

    const userId = c.get('user').id;
    const supabase = c.get('supabase');
    const now = new Date().toISOString();

    const { data: label, error } = await supabase
      .from('labels')
      .update({
        name: name?.trim(),
        color,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !label) {
      return c.json({ error: 'Label not found', code: 'NOT_FOUND' }, 404);
    }

    await broadcastApiMutation(supabase, userId, 'labels', 'update', id);

    return c.json({ data: label }, 200);
  } catch (error) {
    console.error('Error in PUT /api/v1/labels/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/v1/labels/:id
 * Delete a label
 */
app.delete('/api/v1/labels/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    await supabase.from('note_labels').delete().eq('label_id', id);

    const { data: label, error } = await supabase
      .from('labels')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !label) {
      return c.json({ error: 'Label not found', code: 'NOT_FOUND' }, 404);
    }

    await broadcastApiMutation(supabase, userId, 'labels', 'delete', id);

    return c.json({ data: { success: true, id } }, 200);
  } catch (error) {
    console.error('Error in DELETE /api/v1/labels/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/v1/labels/:id/notes
 * Get all notes with a specific label
 */
app.get('/api/v1/labels/:id/notes', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const { data: noteLabels, error } = await supabase
      .from('note_labels')
      .select('note_id, notes!inner(*, note_labels(label_id), note_assignees(contact_id))')
      .eq('label_id', id)
      .eq('notes.user_id', userId)
      .is('notes.deleted_at', null);

    if (error) {
      console.error('Error fetching notes for label:', error);
      return c.json({ error: 'Failed to fetch notes' }, 500);
    }

    const notes = (noteLabels || []).map((nl) => {
      const note = nl.notes;
      const labels = note.note_labels ? note.note_labels.map((l) => l.label_id) : [];
      const assignee_ids = note.note_assignees ? note.note_assignees.map((na) => na.contact_id) : [];
      const { note_labels: _, note_assignees: __, ...noteData } = note;
      return { ...noteData, labels, assignee_ids };
    });

    return c.json({ data: notes }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/labels/:id/notes:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// REST API v1 - Projects Endpoints
// ============================================

/**
 * GET /api/v1/projects
 * List all projects for the user
 */
app.get('/api/v1/projects', async (c) => {
  try {
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching projects:', error);
      return c.json({ error: 'Failed to fetch projects' }, 500);
    }

    return c.json({ data: projects || [] }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/projects:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/v1/projects/:id
 * Get a specific project
 */
app.get('/api/v1/projects/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const { data: project, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !project) {
      return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);
    }

    return c.json({ data: project }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/projects/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/v1/projects
 * Create a new project
 */
app.post('/api/v1/projects', async (c) => {
  try {
    const { name, description, color, emoji } = await c.req.json();

    if (!name || !name.trim()) {
      return c.json({ error: 'Name is required', code: 'VALIDATION_ERROR' }, 400);
    }

    const userId = c.get('user').id;
    const supabase = c.get('supabase');
    const now = new Date().toISOString();

    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: name.trim(),
        description: description || null,
        color: color || null,
        emoji: emoji || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating project:', insertError);
      return c.json({ error: 'Failed to create project' }, 500);
    }

    await broadcastApiMutation(supabase, userId, 'projects', 'insert', project.id);

    return c.json({ data: project }, 201);
  } catch (error) {
    console.error('Error in POST /api/v1/projects:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/v1/projects/:id
 * Update a project
 */
app.put('/api/v1/projects/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { name, description, color, emoji } = await c.req.json();

    const userId = c.get('user').id;
    const supabase = c.get('supabase');
    const now = new Date().toISOString();

    const { data: project, error } = await supabase
      .from('projects')
      .update({
        name: name?.trim(),
        description,
        color,
        emoji,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !project) {
      return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);
    }

    await broadcastApiMutation(supabase, userId, 'projects', 'update', id);

    return c.json({ data: project }, 200);
  } catch (error) {
    console.error('Error in PUT /api/v1/projects/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/v1/projects/:id
 * Delete a project
 */
app.delete('/api/v1/projects/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    await supabase.from('notes').update({ project_id: null }).eq('project_id', id).eq('user_id', userId);

    const { data: project, error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !project) {
      return c.json({ error: 'Project not found', code: 'NOT_FOUND' }, 404);
    }

    await broadcastApiMutation(supabase, userId, 'projects', 'delete', id);

    return c.json({ data: { success: true, id } }, 200);
  } catch (error) {
    console.error('Error in DELETE /api/v1/projects/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/v1/projects/:id/notes
 * Get all notes in a specific project
 */
app.get('/api/v1/projects/:id/notes', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const { data: notes, error } = await supabase
      .from('notes')
      .select('*, note_labels(label_id), note_assignees(contact_id)')
      .eq('user_id', userId)
      .eq('project_id', id)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching notes for project:', error);
      return c.json({ error: 'Failed to fetch notes' }, 500);
    }

    const notesWithRelations = (notes || []).map((note) => {
      const labels = note.note_labels ? note.note_labels.map((nl) => nl.label_id) : [];
      const assignee_ids = note.note_assignees ? note.note_assignees.map((na) => na.contact_id) : [];
      const { note_labels, note_assignees, ...noteData } = note;
      return { ...noteData, labels, assignee_ids };
    });

    return c.json({ data: notesWithRelations }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/projects/:id/notes:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// REST API v1 - Contacts Endpoints
// ============================================

/**
 * GET /api/v1/contacts
 * List all contacts for the user
 */
app.get('/api/v1/contacts', async (c) => {
  try {
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching contacts:', error);
      return c.json({ error: 'Failed to fetch contacts' }, 500);
    }

    return c.json({ data: contacts || [] }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/contacts:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/v1/contacts/:id
 * Get a specific contact
 */
app.get('/api/v1/contacts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error || !contact) {
      return c.json({ error: 'Contact not found', code: 'NOT_FOUND' }, 404);
    }

    return c.json({ data: contact }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/contacts/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * POST /api/v1/contacts
 * Create a new contact
 */
app.post('/api/v1/contacts', async (c) => {
  try {
    const { name, email, phone } = await c.req.json();

    if (!name || !name.trim()) {
      return c.json({ error: 'Name is required', code: 'VALIDATION_ERROR' }, 400);
    }

    const userId = c.get('user').id;
    const supabase = c.get('supabase');
    const now = new Date().toISOString();

    const { data: contact, error: insertError } = await supabase
      .from('contacts')
      .insert({
        user_id: userId,
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating contact:', insertError);
      return c.json({ error: 'Failed to create contact' }, 500);
    }

    await broadcastApiMutation(supabase, userId, 'contacts', 'insert', contact.id);

    return c.json({ data: contact }, 201);
  } catch (error) {
    console.error('Error in POST /api/v1/contacts:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * PUT /api/v1/contacts/:id
 * Update a contact
 */
app.put('/api/v1/contacts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { name, email, phone } = await c.req.json();

    const userId = c.get('user').id;
    const supabase = c.get('supabase');
    const now = new Date().toISOString();

    const { data: contact, error } = await supabase
      .from('contacts')
      .update({
        name: name?.trim(),
        email,
        phone,
        updated_at: now,
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !contact) {
      return c.json({ error: 'Contact not found', code: 'NOT_FOUND' }, 404);
    }

    await broadcastApiMutation(supabase, userId, 'contacts', 'update', id);

    return c.json({ data: contact }, 200);
  } catch (error) {
    console.error('Error in PUT /api/v1/contacts/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * DELETE /api/v1/contacts/:id
 * Delete a contact
 */
app.delete('/api/v1/contacts/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    // Remove all assignee references for this contact from note_assignees
    // The CASCADE on the FK will handle this automatically, but we do it explicitly for clarity
    await supabase.from('note_assignees').delete().eq('contact_id', id);

    const { data: contact, error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !contact) {
      return c.json({ error: 'Contact not found', code: 'NOT_FOUND' }, 404);
    }

    await broadcastApiMutation(supabase, userId, 'contacts', 'delete', id);

    return c.json({ data: { success: true, id } }, 200);
  } catch (error) {
    console.error('Error in DELETE /api/v1/contacts/:id:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

/**
 * GET /api/v1/contacts/:id/notes
 * Get all notes assigned to a specific contact
 */
app.get('/api/v1/contacts/:id/notes', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    // Query notes via note_assignees junction table
    const { data: noteAssignees, error } = await supabase
      .from('note_assignees')
      .select('note_id, notes!inner(*, note_labels(label_id), note_assignees(contact_id))')
      .eq('contact_id', id)
      .eq('notes.user_id', userId)
      .is('notes.deleted_at', null);

    if (error) {
      console.error('Error fetching notes for contact:', error);
      return c.json({ error: 'Failed to fetch notes' }, 500);
    }

    // Transform the result to include labels and assignee_ids
    const notes = (noteAssignees || []).map((na) => {
      const note = na.notes;
      const labels = note.note_labels ? note.note_labels.map((nl) => nl.label_id) : [];
      const assignee_ids = note.note_assignees ? note.note_assignees.map((na) => na.contact_id) : [];
      const { note_labels, note_assignees: _, ...noteData } = note;
      return { ...noteData, labels, assignee_ids };
    });

    // Sort by date descending
    notes.sort((a, b) => new Date(b.date) - new Date(a.date));

    return c.json({ data: notes }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/contacts/:id/notes:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================
// REST API v1 - History Endpoint
// ============================================

/**
 * GET /api/v1/history
 * Get global history with filters (combines note_versions and note_actions)
 */
app.get('/api/v1/history', async (c) => {
  try {
    const note_id = c.req.query('note_id');
    const action_type = c.req.query('action_type');
    const limit = parseInt(c.req.query('limit') || '100', 10);
    const offset = parseInt(c.req.query('offset') || '0', 10);

    const userId = c.get('user').id;
    const supabase = c.get('supabase');

    let versionsData = [];
    let actionsData = [];

    // Determine which tables to query based on action_type filter
    const queryVersions = !action_type || action_type === 'created' || action_type === 'edit';
    const queryActions = !action_type || action_type === 'postponed';

    // Query note_versions if needed
    if (queryVersions) {
      let versionsQuery = supabase
        .from('note_versions')
        .select('*, notes!inner(user_id)')
        .eq('notes.user_id', userId);

      if (note_id) versionsQuery = versionsQuery.eq('note_id', note_id);

      const { data, error } = await versionsQuery;
      if (error) {
        console.error('Error fetching versions:', error);
      } else {
        versionsData = (data || []).map((v) => ({
          id: v.id,
          note_id: v.note_id,
          user_id: v.user_id,
          content: v.content,
          description: v.description,
          category: v.category,
          completed: v.completed,
          changed_at: v.created_at,
          action_type: v.version_number === 1 ? 'created' : 'edit',
          reason: null,
          previous_date: null,
        }));

        // Filter by specific action_type if needed
        if (action_type === 'created') {
          versionsData = versionsData.filter((v) => v.action_type === 'created');
        } else if (action_type === 'edit') {
          versionsData = versionsData.filter((v) => v.action_type === 'edit');
        }
      }
    }

    // Query note_actions if needed
    if (queryActions) {
      let actionsQuery = supabase
        .from('note_actions')
        .select('*, notes!inner(user_id)')
        .eq('notes.user_id', userId);

      if (note_id) actionsQuery = actionsQuery.eq('note_id', note_id);

      const { data, error } = await actionsQuery;
      if (error) {
        console.error('Error fetching actions:', error);
      } else {
        actionsData = (data || []).map((a) => ({
          id: a.id,
          note_id: a.note_id,
          user_id: a.user_id,
          content: null,
          description: null,
          category: null,
          completed: null,
          changed_at: a.created_at,
          action_type: a.action_type,
          reason: a.reason,
          previous_date: a.previous_date,
        }));
      }
    }

    // Combine, sort, and paginate
    const combined = [...versionsData, ...actionsData].sort(
      (a, b) => new Date(b.changed_at) - new Date(a.changed_at)
    );

    const paginated = combined.slice(offset, offset + limit);

    return c.json({
      data: paginated,
      pagination: {
        limit,
        offset,
        has_more: combined.length > offset + limit,
      },
    }, 200);
  } catch (error) {
    console.error('Error in GET /api/v1/history:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// ============================================================================
// STATIC FILE SERVING & SPA FALLBACK
// ============================================================================

// Serve static files from dist directory
app.use('/*', serveStatic({ root: './dist' }));

// SPA fallback - serve index.html for all unmatched routes
app.get('*', (c) => {
  try {
    const indexPath = join(__dirname, 'dist', 'index.html');
    const indexHtml = readFileSync(indexPath, 'utf-8');
    return c.html(indexHtml);
  } catch (error) {
    console.error('Error serving index.html:', error);
    return c.text('Application not found', 404);
  }
});

// ============================================================================
// SERVER STARTUP
// ============================================================================

console.log('Starting Hono server...');

serve(
  {
    fetch: app.fetch,
    port: parseInt(PORT, 10),
  },
  (info) => {
    console.log(`\n🚀 Hono server running on http://localhost:${info.port}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔗 Supabase URL: ${supabaseUrl}`);
    console.log('\nEndpoints:');
    console.log(`  GET  /api/health - Health check`);
    console.log('\nServer is ready to accept connections.\n');
  }
);

export default app;
