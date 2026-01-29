/**
 * Fetch with automatic retry and exponential backoff.
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // Retry on server errors (5xx) or rate limit
      if (response.status >= 500 || response.status === 429) {
        if (attempt < maxRetries) {
          const delay = baseDelay * Math.pow(2, attempt);
          const jitter = delay * 0.2 * Math.random();
          await new Promise((resolve) => setTimeout(resolve, delay + jitter));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        const jitter = delay * 0.2 * Math.random();
        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
      }
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}
