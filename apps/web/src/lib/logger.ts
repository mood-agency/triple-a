/**
 * Abbacchio Logger Configuration for Web App
 *
 * Provides centralized logging to Abbacchio dashboard
 */

import { createLogger, interceptConsole, stopInterceptConsole } from '@abbacchio/browser-transport';

const ABBACCHIO_URL = import.meta.env.VITE_ABBACCHIO_URL || 'http://localhost:4001/api/logs';
const ABBACCHIO_CHANNEL = import.meta.env.VITE_ABBACCHIO_CHANNEL || 'triple-a-web';
const ABBACCHIO_SECRET_KEY = import.meta.env.VITE_ABBACCHIO_SECRET_KEY;
const ABBACCHIO_ENABLED = import.meta.env.VITE_ABBACCHIO_ENABLED !== 'false';

let isInitialized = false;

/**
 * Initialize Abbacchio logging
 * Intercepts console.log/warn/error and sends to Abbacchio dashboard
 */
export function initLogger(): void {
  if (!ABBACCHIO_ENABLED) {
    console.log('[Logger] Abbacchio disabled via VITE_ABBACCHIO_ENABLED=false');
    return;
  }

  if (isInitialized) {
    return;
  }

  interceptConsole({
    url: ABBACCHIO_URL,
    channel: ABBACCHIO_CHANNEL,
    appName: 'triple-a-web',
    secretKey: ABBACCHIO_SECRET_KEY,
    passthrough: true, // Still log to browser console
    batchSize: 10,
    flushInterval: 1000,
    includeUrl: true, // Include page URL in logs
  });

  isInitialized = true;
  console.log(`[Logger] Abbacchio initialized - channel: ${ABBACCHIO_CHANNEL}`);
}

/**
 * Stop Abbacchio logging
 */
export function stopLogger(): void {
  if (isInitialized) {
    stopInterceptConsole();
    isInitialized = false;
  }
}

/**
 * Create a structured logger instance for more control
 */
export const log = createLogger({
  url: ABBACCHIO_URL,
  channel: ABBACCHIO_CHANNEL,
  name: 'triple-a-web',
  secretKey: ABBACCHIO_SECRET_KEY,
});

/**
 * Check if logger is active
 */
export function isLoggerActive(): boolean {
  return isInitialized;
}
