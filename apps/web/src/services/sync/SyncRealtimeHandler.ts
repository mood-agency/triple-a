import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SyncTable } from './types';

type ChangeHandler = (table: SyncTable, payload: unknown) => void;

/**
 * SyncRealtimeHandler manages Supabase Realtime subscriptions for sync.
 * Notifies when remote changes occur so the app can pull updates.
 */
export class SyncRealtimeHandler {
  private userId: string;
  private channel: RealtimeChannel | null = null;
  private broadcastChannel: RealtimeChannel | null = null;
  private changeHandler: ChangeHandler | null = null;
  private syncTrigger: (() => void) | null = null;

  constructor(userId: string) {
    this.userId = userId;
  }

  /**
   * Subscribe to realtime changes on all sync tables.
   */
  subscribe(onSyncNeeded: () => void): void {
    if (!supabase) return;

    this.syncTrigger = onSyncNeeded;

    // Subscribe to postgres_changes for all sync tables
    this.channel = supabase
      .channel(`sync-${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          console.log('[SyncRealtime] Change detected:', payload);
          this.handleChange(payload);
        }
      )
      .subscribe((status) => {
        console.log('[SyncRealtime] Subscription status:', status);
      });

    // Also subscribe to broadcast channel for cross-tab sync
    this.broadcastChannel = supabase
      .channel(`sync-broadcast-${this.userId}`)
      .on('broadcast', { event: 'sync-needed' }, () => {
        console.log('[SyncRealtime] Broadcast sync-needed received');
        onSyncNeeded();
      })
      .on('broadcast', { event: 'api-mutation' }, (payload) => {
        console.log('[SyncRealtime] API mutation broadcast received:', payload);
        onSyncNeeded();
      })
      .subscribe();
  }

  /**
   * Unsubscribe from all realtime channels.
   */
  unsubscribe(): void {
    if (this.channel) {
      supabase?.removeChannel(this.channel);
      this.channel = null;
    }
    if (this.broadcastChannel) {
      supabase?.removeChannel(this.broadcastChannel);
      this.broadcastChannel = null;
    }
    this.syncTrigger = null;
  }

  /**
   * Broadcast a sync-needed event to other tabs/windows.
   */
  broadcastSyncNeeded(): void {
    if (!this.broadcastChannel) return;

    this.broadcastChannel.send({
      type: 'broadcast',
      event: 'sync-needed',
      payload: { timestamp: new Date().toISOString() },
    });
  }

  /**
   * Set a handler for individual change events (optional, for fine-grained handling).
   */
  setChangeHandler(handler: ChangeHandler): void {
    this.changeHandler = handler;
  }

  /**
   * Handle a realtime change event.
   */
  private handleChange(payload: unknown): void {
    // Extract table name from payload
    const tableName = (payload as { table?: string })?.table as
      | SyncTable
      | undefined;

    if (tableName && this.changeHandler) {
      this.changeHandler(tableName, payload);
    }

    // Trigger sync for any change
    this.syncTrigger?.();
  }
}
