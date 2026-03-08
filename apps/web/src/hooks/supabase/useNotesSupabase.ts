import { useCallback, useEffect, useMemo, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProject } from '@/contexts/ProjectContext';
import { supabase } from '@/lib/supabase';
import { eventBus } from '@/events';
import type { Note, NoteCategory, MeetingAttendee } from '@/types/note';
import { formatLocalDate } from '@/utils/dateUtils';
import { useNotesStore } from '@/stores/useNotesStore';

const DEFAULT_VERSION_THROTTLE_SECONDS = 30;

interface UseNotesSupabaseOptions {
  date?: string;
  versionThrottleSeconds?: number;
}

/**
 * Supabase-direct notes hook.
 * State lives in useNotesStore (Zustand); this hook manages side effects
 * (fetch, realtime subscription, CQRS events) and wraps store actions
 * with Supabase persistence.
 */
export function useNotesSupabase(options: UseNotesSupabaseOptions = {}) {
  const { date, versionThrottleSeconds = DEFAULT_VERSION_THROTTLE_SECONDS } = options;
  const { user } = useAuth();
  const userId = user?.id;
  const { activeProjectId, loading: projectLoading } = useActiveProject();

  // Use a stable project ID — only use validated activeProjectId after projects load.
  // This prevents querying with an invalid project ID from localStorage.
  const projectId = useMemo(() => {
    if (projectLoading) return undefined;
    return activeProjectId;
  }, [projectLoading, activeProjectId]);

  // Read state from Zustand store
  const notes = useNotesStore(s => s.notes);
  const loading = useNotesStore(s => s.loading);
  const currentDate = useNotesStore(s => s.currentDate);
  const currentProjectId = useNotesStore(s => s.currentProjectId);

  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  // Track the projectId we're currently fetching for to avoid race conditions
  const requestedProjectIdRef = useRef<string | null | undefined>(projectId);
  // Ref to always hold the latest fetchNotes — avoids re-subscribing realtime/event
  // channels every time fetchNotes identity changes (e.g. on projectId change).
  const fetchNotesRef = useRef<() => Promise<void>>(() => Promise.resolve());

  // If scope changed, notes are stale - treat as loading
  const notesAreStale = date !== currentDate || projectId !== currentProjectId;
  const effectiveLoading = loading || notesAreStale || projectLoading;

  const defaultDate = formatLocalDate(new Date());
  const effectiveDate = date || defaultDate;

  /**
   * Fetch notes from Supabase
   */
  const fetchNotes = useCallback(async () => {
    if (!userId || !supabase || projectId === undefined) {
      useNotesStore.getState().setLoading(false);
      return;
    }

    // Capture the projectId for this request
    const requestProjectId = projectId;
    requestedProjectIdRef.current = requestProjectId;

    useNotesStore.getState().setLoading(true);

    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (date) {
      query = query.eq('date', date);
    }

    if (requestProjectId !== undefined) {
      if (requestProjectId === null) {
        query = query.is('project_id', null);
      } else {
        query = query.eq('project_id', requestProjectId);
      }
    }

    query = query.order('pinned', { ascending: false }).order('created_at', { ascending: false });

    const { data, error } = await query;

    // If projectId changed while we were fetching, discard these results
    if (requestedProjectIdRef.current !== requestProjectId) {
      return;
    }

    if (error) {
      console.error('[useNotesSupabase] Fetch error:', error);
      useNotesStore.getState().setLoading(false);
      return;
    }

    const notesList: Note[] = (data || []).map((row: any) => ({
      id: row.id,
      date: row.date,
      content: row.content,
      description: row.description || null,
      category: row.category as NoteCategory,
      completed: row.completed,
      completed_at: row.completed_at || null,
      deadline: row.deadline || null,
      is_all_day: row.is_all_day || false,
      pinned: row.pinned,
      sort_order: row.sort_order ?? 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at || null,
      deleted_reason: row.deleted_reason || null,
      project_id: row.project_id || null,
      last_postpone_reason: null,
      remote_id: row.id,
      sync_status: 'synced' as const,
      last_synced_at: row.updated_at,
      gcal_event_id: row.gcal_event_id || null,
      meeting_link: row.meeting_link || null,
      location: row.location || null,
      meeting_attendees: row.meeting_attendees as MeetingAttendee[] | null,
      gcal_html_link: row.gcal_html_link || null,
      is_public: row.is_public || false,
      public_slug: row.public_slug || null,
    }));

    // mergeFetchedNotes handles pending note preservation
    const store = useNotesStore.getState();
    store.mergeFetchedNotes(notesList);
    store.setScope(date, requestProjectId);
    store.setLoading(false);
  }, [userId, date, projectId]);

  // Keep ref in sync so realtime/event handlers always call the latest version.
  fetchNotesRef.current = fetchNotes;

  // Clear notes and refetch when scope changes
  useEffect(() => {
    useNotesStore.getState().clearNotes();
    useNotesStore.getState().setLoading(true);
    fetchNotes();
  }, [fetchNotes]);

  // Realtime subscription — set up once per user. Uses fetchNotesRef so the
  // channel doesn't need to be torn down when projectId / date changes.
  useEffect(() => {
    if (!userId || !supabase) return;

    // Clean up previous channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel(`notes-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Debounce: batch rapid realtime events into a single fetchNotes.
          if (debounceTimer) clearTimeout(debounceTimer);
          const pendingCount = useNotesStore.getState().pendingNoteIds.size;
          debounceTimer = setTimeout(() => {
            fetchNotesRef.current();
          }, pendingCount > 0 ? 2000 : 300);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  // Listen to CQRS events to refresh data immediately (without waiting for realtime).
  // Uses fetchNotesRef so the subscriptions don't need to be re-created on scope changes.
  useEffect(() => {
    const unsubscribeCreated = eventBus.subscribe('note:created', (event) => {
      if (event.source === 'command') {
        fetchNotesRef.current();
      }
    });

    const unsubscribeUpdated = eventBus.subscribe('note:updated', (event) => {
      if (event.source === 'command') {
        fetchNotesRef.current();
      }
    });

    const unsubscribeDeleted = eventBus.subscribe('note:deleted', (event) => {
      if (event.source === 'command') {
        fetchNotesRef.current();
      }
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, []);

  /**
   * Create initial version for a note
   */
  const createInitialVersion = useCallback(
    async (noteId: string, content: string, description: string | null, category: NoteCategory, completed: boolean) => {
      if (!userId || !supabase) return;

      const { error } = await supabase.from('note_versions').insert({
        note_id: noteId,
        user_id: userId,
        content,
        description: description || null,
        category,
        completed,
        version_number: 1,
      });

      if (error) {
        console.error('[useNotesSupabase] Error creating initial version:', error);
      }
    },
    [userId]
  );

  /**
   * Create a new note (optimistic — added to store immediately, persisted in background)
   */
  const createNote = useCallback(
    (
      content: string,
      category: NoteCategory = 'todo',
      description?: string | null,
      labelIds?: string[],
      assigneeId?: string | null
    ): Note => {
      if (!userId || !supabase) throw new Error('Not authenticated');

      // Use store for synchronous access
      const currentNotes = useNotesStore.getState().notes;
      const maxSortOrder = currentNotes.reduce((max, n) => Math.max(max, n.sort_order || 0), -1);

      // Construct note locally — no DB round-trip needed for UI
      const noteId = crypto.randomUUID();
      const now = new Date().toISOString();
      const note: Note = {
        id: noteId,
        date: effectiveDate,
        content,
        description: description || null,
        category,
        completed: false,
        completed_at: null,
        deadline: null,
        is_all_day: false,
        pinned: false,
        sort_order: maxSortOrder + 1,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        deleted_reason: null,
        project_id: projectId || null,
        remote_id: noteId,
        sync_status: 'pending',
        is_public: false,
        public_slug: null,
      };

      // Add to store immediately — auto-create effect will see it right away
      useNotesStore.getState().addNote(note);

      // Persist to Supabase — labels/assignees must wait for note to exist
      // to avoid foreign key constraint violations on note_labels/note_assignees
      supabase
        .from('notes')
        .insert({
          id: noteId,
          user_id: userId,
          date: effectiveDate,
          content,
          description: description || null,
          category,
          completed: false,
          pinned: false,
          sort_order: maxSortOrder + 1,
          project_id: projectId || null,
          is_public: false,
        })
        .then(({ error }) => {
          if (error) {
            console.error('[useNotesSupabase] createNote error:', error);
            useNotesStore.getState().removeNote(noteId);
            return;
          }

          // Labels — persisted after note exists
          if (labelIds && labelIds.length > 0) {
            const labelInserts = labelIds.map((labelId) => ({
              note_id: noteId,
              label_id: labelId,
              user_id: userId,
            }));
            supabase!.from('note_labels').insert(labelInserts)
              .then(({ error: labelError }) => {
                if (labelError) console.error('[useNotesSupabase] createNote labels error:', labelError);
              });
          }

          // Assignee — persisted via event bus after note exists
          if (assigneeId) {
            eventBus.emit('assignee:added', { noteId, contactId: assigneeId });
          }
        });

      // Initial version — persisted in background
      createInitialVersion(noteId, content, description || null, category, false);

      eventBus.emit('note:created', {
        noteId: note.id,
        content: note.content,
        category: note.category,
        projectId: note.project_id,
      }, 'ui');

      return note;
    },
    [userId, effectiveDate, projectId, createInitialVersion]
  );

  /**
   * Create a note after a specific note (local-first, optimistic)
   */
  const createNoteAfter = useCallback(
    async (
      afterNoteId: string,
      category: NoteCategory = 'todo',
      deadline?: string | null,
      labelIds: string[] = [],
      assigneeId?: string | null,
      newNoteId?: string
    ): Promise<Note> => {
      if (!userId || !supabase) throw new Error('Not authenticated');

      // getState() is always synchronous and current — no refs needed
      const currentNotes = useNotesStore.getState().notes;
      const afterNote = currentNotes.find((n) => n.id === afterNoteId);
      const afterSortOrder = afterNote?.sort_order || 0;

      const sortedNotes = [...currentNotes].sort((a, b) => a.sort_order - b.sort_order);
      const afterIndex = sortedNotes.findIndex((n) => n.id === afterNoteId);
      let newSortOrder: number;

      if (afterIndex >= 0 && afterIndex < sortedNotes.length - 1) {
        const nextSortOrder = sortedNotes[afterIndex + 1].sort_order;
        newSortOrder = (afterSortOrder + nextSortOrder) / 2;
      } else {
        newSortOrder = afterSortOrder + 1;
      }

      // Construct note locally — no DB round-trip needed
      const noteId = newNoteId || crypto.randomUUID();
      const now = new Date().toISOString();
      const note: Note = {
        id: noteId,
        date: effectiveDate,
        content: '',
        description: null,
        category,
        completed: false,
        completed_at: null,
        deadline: deadline || null,
        is_all_day: false,
        pinned: false,
        sort_order: newSortOrder,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        deleted_reason: null,
        project_id: projectId || null,
        remote_id: noteId,
        sync_status: 'pending',
        is_public: false,
        public_slug: null,
      };

      // Add to store immediately — next Enter press will find it via getState()
      useNotesStore.getState().addNote(note);

      // Persist to Supabase — must complete before emitting label/assignee events
      // to avoid foreign key constraint violations on note_labels/note_assignees
      const { error: insertError } = await supabase
        .from('notes')
        .insert({
          id: noteId,
          user_id: userId,
          date: effectiveDate,
          content: '',
          category,
          completed: false,
          deadline: deadline || null,
          pinned: false,
          sort_order: newSortOrder,
          project_id: projectId || null,
          is_public: false,
        });

      if (insertError) {
        console.error('[useNotesSupabase] createNoteAfter error:', insertError);
      }

      // Labels/assignees — emit events AFTER note is persisted
      if (!insertError) {
        if (labelIds.length > 0) {
          eventBus.emit('note:labelsAttached', { noteId, labelIds, userId });
        }

        if (assigneeId) {
          eventBus.emit('assignee:added', { noteId, contactId: assigneeId });
        }
      }

      return note;
    },
    [userId, effectiveDate, projectId]
  );

  /**
   * Create a new version when description changes
   * Throttled: won't create if last version was created less than 30 seconds ago
   */
  const createVersion = useCallback(
    async (noteId: string, content: string, description: string | null, category: NoteCategory, completed: boolean) => {
      if (!userId || !supabase) return;

      // Get the most recent version with its creation time
      const { data: lastVersion } = await supabase
        .from('note_versions')
        .select('version_number, created_at')
        .eq('note_id', noteId)
        .order('version_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Throttle: don't create a new version if last one was less than 30 seconds ago
      if (lastVersion?.created_at) {
        const lastVersionTime = new Date(lastVersion.created_at).getTime();
        const now = Date.now();
        const secondsSinceLastVersion = (now - lastVersionTime) / 1000;

        if (secondsSinceLastVersion < versionThrottleSeconds) {
          console.log('[useNotesSupabase] Skipping version creation - last version was', Math.round(secondsSinceLastVersion), 'seconds ago (throttle:', versionThrottleSeconds + 's)');
          return;
        }
      }

      const nextVersionNumber = (lastVersion?.version_number || 0) + 1;

      const { error } = await supabase.from('note_versions').insert({
        note_id: noteId,
        user_id: userId,
        content,
        description: description || null,
        category,
        completed,
        version_number: nextVersionNumber,
      });

      if (error) {
        console.error('[useNotesSupabase] Error creating version:', error);
      }
    },
    [userId, versionThrottleSeconds]
  );

  /**
   * Update a note
   */
  const updateNote = useCallback(
    async (
      id: string,
      content: string,
      category?: NoteCategory,
      description?: string | null
    ): Promise<void> => {
      if (!userId || !supabase) return;

      // Optimistic update via store
      useNotesStore.getState().updateNote(id, {
        content,
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
      });

      // Get current note state to check if description changed
      const { data: currentNote } = await supabase
        .from('notes')
        .select('content, description, category, completed')
        .eq('id', id)
        .maybeSingle();

      const updates: Record<string, unknown> = { content };
      if (category !== undefined) updates.category = category;
      if (description !== undefined) updates.description = description;

      const { error } = await supabase.from('notes').update(updates).eq('id', id);

      if (error) {
        console.error('[useNotesSupabase] Update error:', error);
        return;
      }

      // Create a new version if description changed (and has content)
      if (currentNote && description !== undefined && description !== currentNote.description) {
        const hasNewContent = description && description.trim().length > 0;
        const hadPreviousContent = currentNote.description && currentNote.description.trim().length > 0;

        if (hasNewContent || hadPreviousContent) {
          await createVersion(
            id,
            content,
            description,
            (category ?? currentNote.category) as NoteCategory,
            currentNote.completed
          );
        }
      }

      eventBus.emit('note:updated', {
        noteId: id,
        content,
        category,
        description,
      }, 'ui');
    },
    [userId, createVersion]
  );

  /**
   * Delete a note (soft delete, or hard delete if content is empty)
   */
  const deleteNote = useCallback(async (id: string, reason: string): Promise<void> => {
    if (!supabase) return;

    // Remove from Zustand store immediately (also cleans pendingNoteIds
    // so mergeFetchedNotes won't re-add the deleted note as "still pending")
    useNotesStore.getState().removeNote(id);

    // Check if note has content — empty notes get hard-deleted
    const { data: existing } = await supabase
      .from('notes')
      .select('content')
      .eq('id', id)
      .single();

    if (existing && !existing.content?.trim()) {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) console.error('[useNotesSupabase] Hard-delete error:', error);
      return;
    }

    const { error } = await supabase
      .from('notes')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_reason: reason,
      } as any)
      .eq('id', id);

    if (error) console.error('[useNotesSupabase] Delete error:', error);
  }, []);

  /**
   * Restore a deleted note
   */
  const restoreNote = useCallback(async (note: Note): Promise<void> => {
    if (!supabase) return;

    const { error } = await supabase
      .from('notes')
      .update({
        deleted_at: null,
        deleted_reason: null,
      } as any)
      .eq('id', note.id);

    if (error) console.error('[useNotesSupabase] Restore error:', error);
  }, []);

  /**
   * Toggle completed status
   */
  const toggleCompleted = useCallback(async (id: string, completed: boolean): Promise<void> => {
    if (!supabase) return;

    const completed_at = completed ? new Date().toISOString() : null;

    // Optimistic update via store
    useNotesStore.getState().updateNote(id, { completed, completed_at });

    const { error } = await supabase
      .from('notes')
      .update({ completed, completed_at })
      .eq('id', id);

    if (error) console.error('[useNotesSupabase] Toggle completed error:', error);
  }, []);

  /**
   * Toggle pinned status
   */
  const togglePinned = useCallback(async (id: string, pinned: boolean): Promise<void> => {
    if (!supabase) return;

    // Optimistic update via store
    useNotesStore.getState().updateNote(id, { pinned });

    const { error } = await supabase.from('notes').update({ pinned }).eq('id', id);

    if (error) console.error('[useNotesSupabase] Toggle pinned error:', error);
  }, []);

  /**
   * Update deadline
   */
  const updateDeadline = useCallback(async (id: string, deadline: string | null, isAllDay?: boolean): Promise<void> => {
    if (!supabase) return;

    const updates: Record<string, unknown> = { deadline };
    if (isAllDay !== undefined) updates.is_all_day = isAllDay;

    // Optimistic update via store
    useNotesStore.getState().updateNote(id, {
      deadline,
      ...(isAllDay !== undefined && { is_all_day: isAllDay }),
    });

    const { error } = await supabase.from('notes').update(updates).eq('id', id);

    if (error) console.error('[useNotesSupabase] Update deadline error:', error);

    eventBus.emit('note:deadlineUpdated', { noteId: id, deadline, isAllDay }, 'ui');
  }, []);

  /**
   * Update project
   */
  const updateProject = useCallback(
    async (id: string, newProjectId: string | null): Promise<void> => {
      if (!supabase) return;

      const { error } = await supabase.from('notes').update({ project_id: newProjectId }).eq('id', id);

      if (error) console.error('[useNotesSupabase] Update project error:', error);
    },
    []
  );

  /**
   * Postpone a note
   */
  const postponeNote = useCallback(
    async (id: string, newDeadline: string, reason?: string): Promise<void> => {
      if (!userId || !supabase) return;

      // Use store for synchronous access
      const currentNotes = useNotesStore.getState().notes;
      const note = currentNotes.find((n) => n.id === id);
      const previousDeadline = note?.deadline || null;

      // Update note deadline
      const { error: noteError } = await supabase
        .from('notes')
        .update({ deadline: newDeadline })
        .eq('id', id);

      if (noteError) {
        console.error('[useNotesSupabase] Postpone note error:', noteError);
        return;
      }

      // Create action record
      const { error: actionError } = await supabase.from('note_actions').insert({
        user_id: userId,
        note_id: id,
        action_type: 'postponed',
        reason: reason || null,
        previous_date: previousDeadline,
        new_date: newDeadline,
      });

      if (actionError) console.error('[useNotesSupabase] Create action error:', actionError);
    },
    [userId]
  );

  /**
   * Reorder notes
   */
  const reorderNotes = useCallback(async (orderedIds: string[]): Promise<void> => {
    if (!supabase) return;

    const sb = supabase;
    const updates = orderedIds.map((noteId, index) =>
      sb.from('notes').update({ sort_order: index }).eq('id', noteId)
    );

    await Promise.all(updates);
  }, []);

  /**
   * Toggle public sharing
   */
  const togglePublic = useCallback(
    async (id: string, makePublic: boolean): Promise<string | null> => {
      if (!supabase) return null;

      if (makePublic) {
        const slug = nanoid(12);
        const { error } = await supabase
          .from('notes')
          .update({ is_public: true, public_slug: slug })
          .eq('id', id);

        if (error) {
          console.error('[useNotesSupabase] Toggle public error:', error);
          return null;
        }
        return slug;
      } else {
        const { error } = await supabase
          .from('notes')
          .update({ is_public: false, public_slug: null })
          .eq('id', id);

        if (error) console.error('[useNotesSupabase] Toggle public error:', error);
        return null;
      }
    },
    []
  );

  return {
    notes: notesAreStale ? [] : notes,
    loading: effectiveLoading,
    createNote,
    createNoteAfter,
    updateNote,
    updateDeadline,
    updateProject,
    toggleCompleted,
    togglePinned,
    deleteNote,
    restoreNote,
    reorderNotes,
    postponeNote,
    togglePublic,
  };
}
