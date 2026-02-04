import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useEventSubscription } from '@/events';

/**
 * Listener hook that handles fire-and-forget persistence side effects
 * triggered by domain events. Mount once at the app level (AuthenticatedProviders).
 *
 * Handles:
 * - note:labelsAttached → inserts into note_labels
 * - assignee:added → inserts into note_assignees
 */
export function useNoteSideEffects() {
  const { user } = useAuth();

  useEventSubscription('note:labelsAttached', async (event) => {
    if (!supabase || !user) return;
    const { noteId, labelIds, userId } = event.payload;
    const { error } = await supabase.from('note_labels').insert(
      labelIds.map((labelId) => ({ note_id: noteId, label_id: labelId, user_id: userId }))
    );
    if (error) console.error('[useNoteSideEffects] Label insert error:', error);
  });

  useEventSubscription('assignee:added', async (event) => {
    if (!supabase || !user) return;
    const { noteId, contactId } = event.payload;
    const { error } = await supabase.from('note_assignees').insert({
      note_id: noteId,
      contact_id: contactId,
      user_id: user.id,
    });
    if (error) console.error('[useNoteSideEffects] Assignee insert error:', error);
  });
}
