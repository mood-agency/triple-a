/**
 * Configuration for Triple-A API Skill
 *
 * Reads configuration from environment variables:
 * - TRIPLE_A_API_KEY (required): API key for authentication
 * - TRIPLE_A_BASE_URL (optional): Base URL for API (default: http://localhost:3000)
 */

export const config = {
  baseURL: process.env.TRIPLE_A_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.TRIPLE_A_API_KEY,
  timeout: 30000, // 30 seconds
  retries: 3,
};

// Validate that the API key is configured
if (!config.apiKey) {
  console.error('❌ ERROR: TRIPLE_A_API_KEY environment variable is required');
  console.error('Please set your API key:');
  console.error('  export TRIPLE_A_API_KEY="sk_live_..."');
  console.error('');
  console.error('Generate an API key from the Triple-A web UI:');
  console.error('  Settings → API Keys → Create New Key');
  process.exit(1);
}

// Validate API key format
if (!config.apiKey.startsWith('sk_live_')) {
  console.error('❌ ERROR: Invalid API key format');
  console.error('API key must start with "sk_live_"');
  console.error(`Current value: ${config.apiKey.substring(0, 10)}...`);
  process.exit(1);
}

// Log configuration (without exposing full API key)
if (process.env.DEBUG) {
  console.log('Configuration:');
  console.log(`  Base URL: ${config.baseURL}`);
  console.log(`  API Key: ${config.apiKey.substring(0, 16)}...`);
  console.log(`  Timeout: ${config.timeout}ms`);
  console.log(`  Retries: ${config.retries}`);
}
