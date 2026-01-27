import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { AppSettings } from './useSettings';
import type { Database } from '@/types/supabase';

// Global state to prevent multiple hook instances from causing loops
let globalHasLoaded = false;
let globalIsLoading = false;
let globalIsSaving = false;
let globalLoadedUserId: string | null = null;
// Track last saved values to prevent duplicate saves
let lastSavedSettings: string | null = null;

/**
 * Hook to sync user preferences with Supabase
 * Handles loading from remote and saving changes
 */
export function useUserPreferences(
  settings: AppSettings,
  updateSettings: (partial: Partial<AppSettings>) => void
) {
  const { user } = useAuth();
  // Use refs for local component tracking, but check global state too
  const hasLoadedRef = useRef(false);
  const isSavingRef = useRef(false);
  const isLoadingRef = useRef(false);

  // Load preferences when user logs in
  useEffect(() => {
    // Skip if already loaded for this user (globally)
    if (!user || !supabase) return;
    if (globalHasLoaded && globalLoadedUserId === user.id) return;
    if (globalIsLoading) return;

    const loadPreferences = async () => {
      globalIsLoading = true;
      isLoadingRef.current = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any)
          .from('user_preferences')
          .select('show_sidebar, auto_sync, fixed_note_id, beeper_token')
          .eq('user_id', user.id)
          .single();

        if (error) {
          // If no preferences exist yet, create them with current local settings
          if (error.code === 'PGRST116') {
            console.log('[UserPreferences] No preferences found, creating initial...');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('user_preferences')
              .insert({
                user_id: user.id,
                show_sidebar: settings.showSidebar,
                auto_sync: settings.autoSync,
                fixed_note_id: settings.fixedNoteId,
                beeper_token: settings.beeperToken,
              });
          } else {
            console.error('[UserPreferences] Error loading preferences:', error);
          }
          return;
        }

        if (data) {
          console.log('[UserPreferences] Loaded from Supabase:', data);
          // Mark as loaded BEFORE updating settings to prevent save loop
          globalHasLoaded = true;
          globalLoadedUserId = user.id;
          hasLoadedRef.current = true;
          // Track what we loaded so we don't immediately save it back
          lastSavedSettings = JSON.stringify({
            showSidebar: data.show_sidebar,
            autoSync: data.auto_sync,
            fixedNoteId: data.fixed_note_id,
            beeperToken: data.beeper_token,
          });
          // Update local settings with remote data
          updateSettings({
            showSidebar: data.show_sidebar,
            autoSync: data.auto_sync,
            fixedNoteId: data.fixed_note_id,
            beeperToken: data.beeper_token,
          });
        }
      } catch (error) {
        console.error('[UserPreferences] Failed to load preferences:', error);
      } finally {
        globalIsLoading = false;
        isLoadingRef.current = false;
      }
    };

    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only run when user changes, not when settings change

  // Reset loaded flag when user logs out
  useEffect(() => {
    if (!user) {
      hasLoadedRef.current = false;
      globalHasLoaded = false;
      globalLoadedUserId = null;
      lastSavedSettings = null;
    }
  }, [user]);

  // Save preferences when settings change (debounced)
  useEffect(() => {
    // Skip if not loaded or currently loading/saving
    if (!user || !supabase) return;
    if (!globalHasLoaded || globalIsLoading || globalIsSaving) return;

    // Create a serialized version of the settings we care about syncing
    const settingsToSync = {
      showSidebar: settings.showSidebar,
      autoSync: settings.autoSync,
      fixedNoteId: settings.fixedNoteId,
      beeperToken: settings.beeperToken,
    };
    const settingsKey = JSON.stringify(settingsToSync);

    // Skip if settings haven't actually changed
    if (settingsKey === lastSavedSettings) return;

    const timeoutId = setTimeout(async () => {
      // Double-check we haven't already saved these settings
      if (settingsKey === lastSavedSettings) return;

      globalIsSaving = true;
      isSavingRef.current = true;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any)
          .from('user_preferences')
          .upsert(
            {
              user_id: user.id,
              show_sidebar: settings.showSidebar,
              auto_sync: settings.autoSync,
              fixed_note_id: settings.fixedNoteId,
              beeper_token: settings.beeperToken,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: 'user_id',
            }
          );

        if (error) {
          console.error('[UserPreferences] Error saving preferences:', error);
        } else {
          console.log('[UserPreferences] Saved to Supabase:', settingsToSync);
          lastSavedSettings = settingsKey;
        }
      } catch (error) {
        console.error('[UserPreferences] Failed to save preferences:', error);
      } finally {
        globalIsSaving = false;
        isSavingRef.current = false;
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [settings.showSidebar, settings.autoSync, settings.fixedNoteId, settings.beeperToken, user]);

  // Subscribe to realtime changes from other devices
  useEffect(() => {
    if (!user || !supabase) return;

    const channel = supabase
      .channel('user_preferences_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_preferences',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[UserPreferences] Realtime update received:', payload);
          if (payload.new && !isSavingRef.current) {
            // Update local settings with remote changes (only if we're not the ones saving)
            type UserPreferenceRow = Database['public']['Tables']['user_preferences']['Row'];
            const newData = payload.new as UserPreferenceRow;
            // Update lastSavedSettings so we don't save these values back
            lastSavedSettings = JSON.stringify({
              showSidebar: newData.show_sidebar,
              autoSync: newData.auto_sync,
              fixedNoteId: newData.fixed_note_id,
              beeperToken: newData.beeper_token,
            });
            updateSettings({
              showSidebar: newData.show_sidebar ?? undefined,
              autoSync: newData.auto_sync ?? undefined,
              fixedNoteId: newData.fixed_note_id,
              beeperToken: newData.beeper_token,
            });
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, [user, updateSettings]);
}
