import { useState, useCallback, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { eventBus } from '@/events';
import type { Note, NoteCategory } from '@/types/note';
import { formatLocalDate } from '@/utils/dateUtils';

interface UseNotesSupabaseOptions {
  date?: string;
  projectId?: string | null;
}

/**
 * Supabase-direct notes hook
 * Provides the same API as useNotesStore but queries Supabase directly
 */
export function useNotesSupabase(options: UseNotesSupabaseOptions = {}) {
  const { date, projectId } = options;
  const { user } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  // Synchronous mirror of notes — updated immediately in createNoteAfter so
  // rapid successive calls always see the latest array (React state is batched).
  const latestNotesRef = useRef<Note[]>([]);
  // Track note IDs created locally but not yet confirmed by Supabase insert.
  // fetchNotes merges these so realtime full-refetches don't wipe in-flight notes.
  const pendingNoteIdsRef = useRef<Set<string>>(new Set());
  // Track the projectId we're currently fetching for to avoid race conditions
  const requestedProjectIdRef = useRef<string | null | undefined>(projectId);
  // Track the projectId that the current notes belong to
  const [notesProjectId, setNotesProjectId] = useState<string | null | undefined>(projectId);

  // If projectId changed, notes are stale - treat as loading
  const notesAreStale = projectId !== notesProjectId;
  const effectiveLoading = loading || notesAreStale;

  const defaultDate = formatLocalDate(new Date());
  const effectiveDate = date || defaultDate;

  /**
   * Fetch notes from Supabase
   */
  const fetchNotes = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    // Capture the projectId for this request
    const requestProjectId = projectId;
    requestedProjectIdRef.current = requestProjectId;

    setLoading(true);

    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', user.id)
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

    query = query.order('pinned', { ascending: false }).order('sort_order', { ascending: true });

    const { data, error } = await query;

    // If projectId changed while we were fetching, discard these results
    if (requestedProjectIdRef.current !== requestProjectId) {
      return;
    }

    if (error) {
      console.error('[useNotesSupabase] Fetch error:', error);
      setLoading(false);
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
      is_public: row.is_public || false,
      public_slug: row.public_slug || null,
    }));

    // Merge: keep locally-created notes whose inserts haven't been confirmed yet.
    // Once the insert completes the ID is removed from pendingNoteIdsRef and the
    // next fetchNotes will naturally include it from the DB.
    let mergedNotes = notesList;
    const pendingIds = pendingNoteIdsRef.current;
    if (pendingIds.size > 0) {
      const dbIds = new Set(notesList.map(n => n.id));
      const stillPending = latestNotesRef.current.filter(
        n => pendingIds.has(n.id) && !dbIds.has(n.id)
      );
      if (stillPending.length > 0) {
        mergedNotes = [...notesList, ...stillPending];
      }
    }

    latestNotesRef.current = mergedNotes;
    setNotes(mergedNotes);
    setNotesProjectId(requestProjectId);
    setLoading(false);
  }, [user, date, projectId]);

  // Clear notes and refetch when projectId changes
  useEffect(() => {
    // Clear notes immediately to avoid showing stale data from different project
    latestNotesRef.current = [];
    setNotes([]);
    setLoading(true);
    fetchNotes();
  }, [fetchNotes]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !supabase) return;

    // Clean up previous channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`notes-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // fetchNotes merges pending local notes so this is safe even
          // when inserts are still in-flight (see pendingNoteIdsRef).
          fetchNotes();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, fetchNotes]);

  // Listen to CQRS events to refresh data immediately (without waiting for realtime)
  useEffect(() => {
    const unsubscribeCreated = eventBus.subscribe('note:created', (event) => {
      // Only refetch if the event came from CQRS command (not from this hook)
      if (event.source === 'command') {
        fetchNotes();
      }
    });

    const unsubscribeUpdated = eventBus.subscribe('note:updated', (event) => {
      if (event.source === 'command') {
        fetchNotes();
      }
    });

    const unsubscribeDeleted = eventBus.subscribe('note:deleted', (event) => {
      if (event.source === 'command') {
        fetchNotes();
      }
    });

    return () => {
      unsubscribeCreated();
      unsubscribeUpdated();
      unsubscribeDeleted();
    };
  }, [fetchNotes]);

  /**
   * Create initial version for a note
   */
  const createInitialVersion = useCallback(
    async (noteId: string, content: string, description: string | null, category: NoteCategory, completed: boolean) => {
      if (!user || !supabase) return;

      const { error } = await supabase.from('note_versions').insert({
        note_id: noteId,
        user_id: user.id,
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
    [user]
  );

  /**
   * Create a new note
   */
  const createNote = useCallback(
    async (
      content: string,
      category: NoteCategory = 'todo',
      description?: string | null,
      labelIds?: string[]
    ): Promise<Note> => {
      if (!user || !supabase) throw new Error('Not authenticated');

      // Calculate sort_order
      const maxSortOrder = notes.reduce((max, n) => Math.max(max, n.sort_order || 0), -1);

      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: user.id,
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
        .select()
        .single();

      if (error) throw error;

      // Add labels if provided
      if (labelIds && labelIds.length > 0 && data) {
        const labelInserts = labelIds.map((labelId) => ({
          note_id: data.id,
          label_id: labelId,
          user_id: user.id,
        }));
        await supabase.from('note_labels').insert(labelInserts);
      }

      const row = data as any;

      // Create initial version
      await createInitialVersion(row.id, row.content, row.description, row.category, row.completed);

      const note: Note = {
        id: row.id,
        date: row.date,
        content: row.content,
        description: row.description,
        category: row.category as NoteCategory,
        completed: row.completed,
        completed_at: row.completed_at,
        deadline: row.deadline,
        is_all_day: row.is_all_day || false,
        pinned: row.pinned,
        sort_order: row.sort_order ?? 0,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: null,
        deleted_reason: null,
        project_id: row.project_id,
        remote_id: row.id,
        sync_status: 'synced',
        is_public: row.is_public || false,
        public_slug: row.public_slug || null,
      };

      return note;
    },
    [user, notes, effectiveDate, projectId, createInitialVersion]
  );

  /**
   * Create a note after a specific note
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
      if (!user || !supabase) throw new Error('Not authenticated');

      // 1. Calculate sort_order from the synchronous ref (not the stale closure)
      //    React batches setNotes updates, so `notes` can be stale during rapid calls.
      //    latestNotesRef is updated synchronously in this function, so it's always current.
      const currentNotes = latestNotesRef.current;
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

      // 2. Construct note locally — no DB round-trip needed
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

      // 3. Add to local state IMMEDIATELY — next Enter press will find it
      pendingNoteIdsRef.current.add(noteId);
      latestNotesRef.current = [...latestNotesRef.current, note];
      setNotes(prev => [...prev, note]);

      // 4. Persist to Supabase in background (fire-and-forget)
      supabase
        .from('notes')
        .insert({
          id: noteId,
          user_id: user.id,
          date: effectiveDate,
          content: '',
          category,
          completed: false,
          deadline: deadline || null,
          pinned: false,
          sort_order: newSortOrder,
          project_id: projectId || null,
          is_public: false,
        })
        .then(({ error }) => {
          pendingNoteIdsRef.current.delete(noteId);
          if (error) console.error('[useNotesSupabase] createNoteAfter error:', error);
        });

      // 6. Labels/assignees — fire-and-forget
      if (labelIds.length > 0) {
        supabase.from('note_labels').insert(
          labelIds.map((labelId) => ({ note_id: noteId, label_id: labelId, user_id: user.id }))
        ).then(({ error }) => {
          if (error) console.error('[useNotesSupabase] Label insert error:', error);
        });
      }

      if (assigneeId) {
        supabase.from('note_assignees').insert({
          note_id: noteId, contact_id: assigneeId, user_id: user.id,
        }).then(({ error }) => {
          if (error) console.error('[useNotesSupabase] Assignee insert error:', error);
        });
      }

      // 6. Return immediately — no waiting for network
      return note;
    },
    [user, effectiveDate, projectId]
  );

  /**
   * Create a new version when description changes
   * Throttled: won't create if last version was created less than 30 seconds ago
   */
  const createVersion = useCallback(
    async (noteId: string, content: string, description: string | null, category: NoteCategory, completed: boolean) => {
      if (!user || !supabase) return;

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

        if (secondsSinceLastVersion < 30) {
          console.log('[useNotesSupabase] Skipping version creation - last version was', Math.round(secondsSinceLastVersion), 'seconds ago');
          return;
        }
      }

      const nextVersionNumber = (lastVersion?.version_number || 0) + 1;

      const { error } = await supabase.from('note_versions').insert({
        note_id: noteId,
        user_id: user.id,
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
    [user]
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
      if (!user || !supabase) return;

      // Optimistic update: immediately update local state so UI reflects changes
      setNotes(prev => prev.map(n => {
        if (n.id !== id) return n;
        return {
          ...n,
          content,
          ...(category !== undefined && { category }),
          ...(description !== undefined && { description }),
        };
      }));

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
        // Only create version if description has actual content
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
    },
    [user, createVersion]
  );

  /**
   * Delete a note (soft delete, or hard delete if content is empty)
   */
  const deleteNote = useCallback(async (id: string, reason: string): Promise<void> => {
    if (!supabase) return;

    // Check if note has content — empty notes get hard-deleted so they
    // don't clutter the deleted-notes view.
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

    // Optimistic update
    setNotes(prev => prev.map(n => n.id === id ? { ...n, completed, completed_at } : n));

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

    // Optimistic update
    setNotes(prev => prev.map(n => n.id === id ? { ...n, pinned } : n));

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

    // Optimistic update
    setNotes(prev => prev.map(n => n.id === id ? { ...n, deadline, ...(isAllDay !== undefined && { is_all_day: isAllDay }) } : n));

    const { error } = await supabase.from('notes').update(updates).eq('id', id);

    if (error) console.error('[useNotesSupabase] Update deadline error:', error);
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
      if (!user || !supabase) return;

      const note = notes.find((n) => n.id === id);
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
        user_id: user.id,
        note_id: id,
        action_type: 'postponed',
        reason: reason || null,
        previous_date: previousDeadline,
        new_date: newDeadline,
      });

      if (actionError) console.error('[useNotesSupabase] Create action error:', actionError);
    },
    [user, notes]
  );

  /**
   * Reorder notes
   */
  const reorderNotes = useCallback(async (orderedIds: string[]): Promise<void> => {
    if (!supabase) return;

    // Update each note's sort_order
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
