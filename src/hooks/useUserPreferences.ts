import { useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { AppSettings } from './useSettings';
import type { Database } from '@/types/supabase';

/**
 * Hook to sync user preferences with Supabase
 * Handles loading from remote and saving changes
 */
export function useUserPreferences(
  settings: AppSettings,
  updateSettings: (partial: Partial<AppSettings>) => void
) {
  const { user } = useAuth();
  const hasLoadedRef = useRef(false);
  const isSavingRef = useRef(false);

  // Load preferences when user logs in
  useEffect(() => {
    if (!user || !supabase || hasLoadedRef.current) return;

    const loadPreferences = async () => {
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
          // Update local settings with remote data
          updateSettings({
            showSidebar: data.show_sidebar,
            autoSync: data.auto_sync,
            fixedNoteId: data.fixed_note_id,
            beeperToken: data.beeper_token,
          });
          hasLoadedRef.current = true;
        }
      } catch (error) {
        console.error('[UserPreferences] Failed to load preferences:', error);
      }
    };

    loadPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only run when user changes, not when settings change

  // Reset loaded flag when user logs out
  useEffect(() => {
    if (!user) {
      hasLoadedRef.current = false;
    }
  }, [user]);

  // Save preferences when settings change (debounced)
  useEffect(() => {
    if (!user || !supabase || !hasLoadedRef.current || isSavingRef.current) return;

    const timeoutId = setTimeout(async () => {
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
          console.log('[UserPreferences] Saved to Supabase:', settings);
        }
      } catch (error) {
        console.error('[UserPreferences] Failed to save preferences:', error);
      } finally {
        isSavingRef.current = false;
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [settings, user]);

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
            updateSettings({
              showSidebar: newData.show_sidebar,
              autoSync: newData.auto_sync,
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
