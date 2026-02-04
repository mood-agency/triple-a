/**
 * Google Calendar Authentication Helpers
 *
 * Extracted from index.js to be shared between endpoints and sync logic.
 * Supports both legacy single-account (google_calendar_tokens) and
 * multi-account (google_calendar_accounts) token storage.
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Refresh a Google OAuth token using a refresh token.
 * Updates the google_calendar_tokens table (legacy single-account).
 */
export async function refreshGoogleToken(refreshToken, supabase, userId) {
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
 * Get a valid Google access token for a user (legacy single-account).
 * Reads from google_calendar_tokens table.
 */
export async function getGoogleAccessToken(supabase, userId) {
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
 * Refresh a Google OAuth token for a specific account.
 * Updates the google_calendar_accounts table (multi-account).
 */
export async function refreshAccountToken(supabase, accountId, refreshToken) {
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
      .from('google_calendar_accounts')
      .update({
        access_token: tokens.access_token,
        token_expires_at: expiryDate.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', accountId);

    return { success: true, accessToken: tokens.access_token };
  } catch (error) {
    console.warn('[refreshAccountToken] Failed to refresh account token:', error);
    return { success: false };
  }
}

/**
 * Get a valid Google access token for a specific account (multi-account).
 * Reads from google_calendar_accounts table.
 */
export async function getAccessTokenForAccount(supabase, accountId, userId) {
  const { data: account, error } = await supabase
    .from('google_calendar_accounts')
    .select('access_token, token_expires_at, refresh_token')
    .eq('id', accountId)
    .eq('user_id', userId)
    .single();

  if (error || !account) {
    return { error: 'Google Calendar account not found' };
  }

  if (new Date(account.token_expires_at) < new Date()) {
    const refreshResult = await refreshAccountToken(supabase, accountId, account.refresh_token);
    if (!refreshResult.success) {
      return { error: 'Failed to refresh account token' };
    }
    return { accessToken: refreshResult.accessToken };
  }

  return { accessToken: account.access_token };
}
