import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { eventBus } from '@/events';
import type { NoteCategory } from '@/types/note';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type PostgresChangePayload<T> = RealtimePostgresChangesPayload<T>;

interface NoteRow {
  id: string;
  user_id: string;
  date: string;
  content: string;
  description: string | null;
  category: string;
  completed: boolean;
  completed_at: string | null;
  deadline: string | null;
  pinned: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_reason: string | null;
  project_id: string | null;
}

interface NoteLabelRow {
  note_id: string;
  label_id: string;
  user_id: string;
}

interface NoteAssigneeRow {
  note_id: string;
  contact_id: string;
  user_id: string;
}

interface UseSupabaseRealtimeOptions {
  /** Filter by date */
  date?: string;
  /** Filter by project */
  projectId?: string | null;
  /** Called when notes should be refetched */
  onNotesChange?: () => void;
  /** Called when labels should be refetched */
  onLabelsChange?: () => void;
  /** Called when assignees should be refetched */
  onAssigneesChange?: () => void;
}

/**
 * Hook that bridges Supabase realtime subscriptions to the event bus.
 * Subscribes to postgres_changes and emits domain events.
 *
 * This enables:
 * - UI components to react to realtime changes via event subscriptions
 * - Distinguishing between UI-triggered changes (source: 'ui') and
 *   realtime changes from other clients (source: 'realtime')
 */
export function useSupabaseRealtime(options: UseSupabaseRealtimeOptions = {}) {
  const { onNotesChange, onLabelsChange, onAssigneesChange } = options;
  const { user } = useAuth();
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  // Handle note changes
  const handleNoteChange = useCallback(
    (payload: PostgresChangePayload<NoteRow>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case 'INSERT': {
          if (newRecord && !newRecord.deleted_at) {
            eventBus.emit(
              'note:created',
              {
                noteId: newRecord.id,
                content: newRecord.content,
                category: newRecord.category as NoteCategory,
                projectId: newRecord.project_id,
              },
              'realtime'
            );
          }
          break;
        }

        case 'UPDATE': {
          if (newRecord) {
            // Check if it was a soft delete
            if (newRecord.deleted_at && (!oldRecord || !oldRecord.deleted_at)) {
              eventBus.emit(
                'note:deleted',
                {
                  noteId: newRecord.id,
                  reason: newRecord.deleted_reason || 'unknown',
                },
                'realtime'
              );
            }
            // Check if completed status changed
            else if (oldRecord && newRecord.completed !== oldRecord.completed) {
              eventBus.emit(
                'note:completed',
                {
                  noteId: newRecord.id,
                  completed: newRecord.completed,
                  completedAt: newRecord.completed_at,
                },
                'realtime'
              );
            }
            // Check if pinned status changed
            else if (oldRecord && newRecord.pinned !== oldRecord.pinned) {
              eventBus.emit(
                'note:pinned',
                {
                  noteId: newRecord.id,
                  pinned: newRecord.pinned,
                },
                'realtime'
              );
            }
            // General update
            else {
              eventBus.emit(
                'note:updated',
                {
                  noteId: newRecord.id,
                  content: newRecord.content,
                  category: newRecord.category as NoteCategory,
                  description: newRecord.description,
                },
                'realtime'
              );
            }
          }
          break;
        }

        case 'DELETE': {
          if (oldRecord) {
            eventBus.emit(
              'note:deleted',
              {
                noteId: oldRecord.id,
                reason: 'hard_delete',
              },
              'realtime'
            );
          }
          break;
        }
      }

      // Notify parent to refetch
      onNotesChange?.();
    },
    [onNotesChange]
  );

  // Handle note_labels changes
  const handleNoteLabelChange = useCallback(
    (payload: PostgresChangePayload<NoteLabelRow>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case 'INSERT': {
          if (newRecord) {
            eventBus.emit(
              'label:addedToNote',
              {
                noteId: newRecord.note_id,
                labelId: newRecord.label_id,
                labelName: '', // We don't have this from realtime
                labelColor: '', // We don't have this from realtime
              },
              'realtime'
            );
          }
          break;
        }

        case 'DELETE': {
          if (oldRecord) {
            eventBus.emit(
              'label:removedFromNote',
              {
                noteId: oldRecord.note_id,
                labelId: oldRecord.label_id,
              },
              'realtime'
            );
          }
          break;
        }
      }

      // Notify parent to refetch labels
      onLabelsChange?.();
    },
    [onLabelsChange]
  );

  // Handle note_assignees changes
  const handleNoteAssigneeChange = useCallback(
    (payload: PostgresChangePayload<NoteAssigneeRow>) => {
      const { eventType, new: newRecord, old: oldRecord } = payload;

      switch (eventType) {
        case 'INSERT': {
          if (newRecord) {
            eventBus.emit(
              'assignee:added',
              {
                noteId: newRecord.note_id,
                contactId: newRecord.contact_id,
              },
              'realtime'
            );
          }
          break;
        }

        case 'DELETE': {
          if (oldRecord) {
            eventBus.emit(
              'assignee:removed',
              {
                noteId: oldRecord.note_id,
                contactId: oldRecord.contact_id,
              },
              'realtime'
            );
          }
          break;
        }
      }

      // Notify parent to refetch assignees
      onAssigneesChange?.();
    },
    [onAssigneesChange]
  );

  // Set up subscriptions
  useEffect(() => {
    if (!user || !supabase) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel with all subscriptions
    const channel = supabase
      .channel(`realtime-${user.id}`)
      // Notes subscription
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`,
        },
        handleNoteChange as (payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>) => void
      )
      // Note labels subscription
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_labels',
          filter: `user_id=eq.${user.id}`,
        },
        handleNoteLabelChange as (payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>) => void
      )
      // Note assignees subscription
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_assignees',
          filter: `user_id=eq.${user.id}`,
        },
        handleNoteAssigneeChange as (payload: RealtimePostgresChangesPayload<{ [key: string]: unknown }>) => void
      )
      .subscribe((status) => {
        if (import.meta.env.DEV) {
          console.debug('[useSupabaseRealtime] Subscription status:', status);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, handleNoteChange, handleNoteLabelChange, handleNoteAssigneeChange]);

  return {
    isConnected: channelRef.current !== null,
  };
}
