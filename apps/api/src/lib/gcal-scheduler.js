/**
 * Google Calendar Background Sync Scheduler
 *
 * Uses node-cron to periodically check which users need calendar sync
 * and runs syncUserCalendar for each eligible user.
 */

import cron from 'node-cron';
import { syncUserCalendar } from './gcal-sync.js';

/**
 * Start the background Google Calendar sync scheduler.
 * Runs every minute, checks for users whose sync interval has elapsed,
 * and syncs their calendars.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin - Supabase admin client
 */
export function startGCalSyncScheduler(supabaseAdmin) {
  console.log('[gcal-scheduler] Starting background sync scheduler (every 1 minute)');

  cron.schedule('* * * * *', async () => {
    try {
      // Find users with sync enabled whose interval has elapsed
      const { data: configs, error } = await supabaseAdmin
        .from('google_calendar_config')
        .select('user_id, sync_interval_minutes, last_sync_at')
        .eq('enabled', true)
        .gt('sync_interval_minutes', 0);

      if (error) {
        console.error('[gcal-scheduler] Error querying configs:', error);
        return;
      }

      if (!configs || configs.length === 0) return;

      const now = new Date();

      for (const config of configs) {
        const lastSync = config.last_sync_at ? new Date(config.last_sync_at) : null;
        const intervalMs = config.sync_interval_minutes * 60 * 1000;

        // Skip if not enough time has passed since last sync
        if (lastSync && (now.getTime() - lastSync.getTime()) < intervalMs) {
          continue;
        }

        // Sync this user (wrapped in try/catch so one failure doesn't block others)
        try {
          console.log(`[gcal-scheduler] Syncing user ${config.user_id}`);
          await syncUserCalendar(supabaseAdmin, config.user_id);
        } catch (err) {
          console.error(`[gcal-scheduler] Error syncing user ${config.user_id}:`, err);
        }
      }
    } catch (err) {
      console.error('[gcal-scheduler] Scheduler error:', err);
    }
  });
}
