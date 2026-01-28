/**
 * Triple-A API Client
 *
 * HTTP client with:
 * - Automatic authentication headers
 * - Error handling for API-specific error codes
 * - Retry logic for transient errors
 * - Request/response logging (if DEBUG=1)
 */

import { config } from './config.js';

class TripleAClient {
  constructor() {
    this.baseURL = config.baseURL;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout;
    this.retries = config.retries;
  }

  /**
   * Make an HTTP request to the Triple-A API
   *
   * @param {string} method - HTTP method (GET, POST, PUT, PATCH, DELETE)
   * @param {string} path - API path (e.g., '/api/v1/notes')
   * @param {object|null} body - Request body for POST/PUT/PATCH
   * @param {number} attempt - Current retry attempt (internal)
   * @returns {Promise<object>} Response data
   */
  async request(method, path, body = null, attempt = 1) {
    const url = `${this.baseURL}${path}`;

    const options = {
      method,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(this.timeout),
    };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = JSON.stringify(body);
    }

    if (process.env.DEBUG) {
      console.log(`[${method}] ${path}`);
      if (body) {
        console.log('Body:', JSON.stringify(body, null, 2));
      }
    }

    try {
      const response = await fetch(url, options);

      if (process.env.DEBUG) {
        console.log(`Response: ${response.status} ${response.statusText}`);
      }

      // Handle successful responses
      if (response.ok) {
        const data = await response.json();
        return data;
      }

      // Handle error responses
      const errorData = await response.json().catch(() => ({
        error: response.statusText,
        code: 'UNKNOWN_ERROR',
      }));

      // Retry on rate limiting (429)
      if (response.status === 429 && attempt < this.retries) {
        const retryAfter = parseInt(response.headers.get('retry-after') || '60', 10);
        console.error(
          `⚠️  Rate limit exceeded. Retrying in ${retryAfter} seconds (attempt ${attempt}/${this.retries})...`
        );
        await this.sleep(retryAfter * 1000);
        return this.request(method, path, body, attempt + 1);
      }

      // Retry on server errors (500)
      if (response.status >= 500 && attempt < this.retries) {
        console.error(
          `⚠️  Server error (${response.status}). Retrying (attempt ${attempt}/${this.retries})...`
        );
        await this.sleep(2000 * attempt); // Exponential backoff: 2s, 4s, 6s
        return this.request(method, path, body, attempt + 1);
      }

      // Throw error for non-retryable errors
      const error = new Error(errorData.error || 'API request failed');
      error.code = errorData.code;
      error.status = response.status;
      error.details = errorData.details;
      throw error;
    } catch (err) {
      // Handle network errors and timeouts
      if (err.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }

      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error(
          `Network error: Unable to reach ${this.baseURL}. Is the server running?`
        );
      }

      throw err;
    }
  }

  /**
   * Sleep for a specified number of milliseconds
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * GET request
   */
  async get(path) {
    return this.request('GET', path);
  }

  /**
   * POST request
   */
  async post(path, body) {
    return this.request('POST', path, body);
  }

  /**
   * PUT request (full update)
   */
  async put(path, body) {
    return this.request('PUT', path, body);
  }

  /**
   * PATCH request (partial update)
   */
  async patch(path, body) {
    return this.request('PATCH', path, body);
  }

  /**
   * DELETE request
   */
  async delete(path) {
    return this.request('DELETE', path);
  }

  /**
   * Format and display error messages
   */
  formatError(error) {
    console.error('\n❌ Error:', error.message);

    if (error.code) {
      console.error(`Code: ${error.code}`);
    }

    if (error.status) {
      console.error(`Status: ${error.status}`);
    }

    if (error.details) {
      console.error('Details:', JSON.stringify(error.details, null, 2));
    }

    // Provide helpful hints based on error code
    switch (error.code) {
      case 'INVALID_API_KEY':
        console.error('\n💡 Hint: Check your TRIPLE_A_API_KEY environment variable');
        console.error('   - Ensure it starts with "sk_live_"');
        console.error('   - Generate a new key from Settings → API Keys');
        break;

      case 'API_KEY_REVOKED':
        console.error('\n💡 Hint: This API key has been revoked');
        console.error('   - Generate a new key from the Triple-A web UI');
        break;

      case 'API_KEY_EXPIRED':
        console.error('\n💡 Hint: This API key has expired');
        console.error('   - Generate a new key or extend the expiration date');
        break;

      case 'INSUFFICIENT_SCOPE':
        console.error('\n💡 Hint: This API key lacks required permissions');
        console.error('   - Create a new key with the necessary scopes (read/write/delete)');
        break;

      case 'RATE_LIMIT_EXCEEDED':
        console.error('\n💡 Hint: You have exceeded the rate limit');
        console.error('   - Wait 60 seconds before retrying');
        console.error('   - Increase the rate limit for your API key');
        break;

      case 'VALIDATION_ERROR':
        console.error('\n💡 Hint: Check that all required fields are provided');
        break;

      case 'NOT_FOUND':
        console.error('\n💡 Hint: The requested resource does not exist');
        console.error('   - Verify the ID is correct');
        console.error('   - Check if the resource was deleted');
        break;
    }

    console.error('');
  }
}

// Export singleton instance
export const client = new TripleAClient();
