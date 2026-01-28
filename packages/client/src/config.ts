/**
 * Configuration for Triple-A API Client
 */

export interface ClientConfig {
  baseURL: string;
  apiKey: string;
  timeout: number;
  retries: number;
}

/**
 * Create a client configuration from environment variables or explicit options
 */
export function createConfig(options?: Partial<ClientConfig>): ClientConfig {
  const apiKey = options?.apiKey ?? process.env.TRIPLE_A_API_KEY;
  const baseURL = options?.baseURL ?? process.env.TRIPLE_A_BASE_URL ?? 'http://localhost:3000';

  if (!apiKey) {
    throw new Error(
      'TRIPLE_A_API_KEY is required. Set it as an environment variable or pass it in options.'
    );
  }

  if (!apiKey.startsWith('sk_live_')) {
    throw new Error(
      'Invalid API key format. API key must start with "sk_live_"'
    );
  }

  return {
    baseURL,
    apiKey,
    timeout: options?.timeout ?? 30000,
    retries: options?.retries ?? 3,
  };
}

/**
 * Validate that an API key has the correct format
 */
export function validateApiKey(apiKey: string): boolean {
  return apiKey.startsWith('sk_live_') && apiKey.length > 20;
}
