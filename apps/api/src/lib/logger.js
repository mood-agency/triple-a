/**
 * Abbacchio Logger Configuration for API
 *
 * Intercepts console.log/warn/error and sends to Abbacchio dashboard
 */

import { interceptConsole, restoreConsole } from '@abbacchio/transport/transports/console';

const ABBACCHIO_URL = process.env.ABBACCHIO_URL || 'http://localhost:4000/api/logs';
const ABBACCHIO_CHANNEL = process.env.ABBACCHIO_CHANNEL || 'triple-a-api';
const ABBACCHIO_SECRET_KEY = process.env.ABBACCHIO_SECRET_KEY;
const ABBACCHIO_ENABLED = process.env.ABBACCHIO_ENABLED !== 'false';

let isIntercepting = false;

/**
 * Initialize Abbacchio console interception
 */
export function initLogger() {
  if (isIntercepting) {
    return;
  }

  interceptConsole({
    url: ABBACCHIO_URL,
    channel: ABBACCHIO_CHANNEL,
    namespace: 'triple-a-api',
    secretKey: ABBACCHIO_SECRET_KEY,
    enabled: ABBACCHIO_ENABLED,
    passthrough: true, // Still output to terminal
    batchSize: 10,
    interval: 1000,
  });

  isIntercepting = true;
  console.log(`[Logger] Abbacchio initialized - channel: ${ABBACCHIO_CHANNEL}`);
}

/**
 * Stop Abbacchio console interception
 */
export function stopLogger() {
  if (isIntercepting) {
    restoreConsole();
    isIntercepting = false;
  }
}

/**
 * Check if logger is active
 */
export function isLoggerActive() {
  return isIntercepting;
}
