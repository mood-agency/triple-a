import { supabase } from '@/lib/supabase';
import type { Note, NoteCategory, NoteVersion, NoteAction, MeetingAttendee } from '@/types/note';
import type {
  INoteRepository,
  NoteFilters,
  CreateNoteData,
  UpdateNoteData,
  RealtimeEvent,
} from '../types';

type SupabaseChannel = ReturnType<NonNullable<typeof supabase>['channel']>;

function mapRowToNote(row: Record<string, unknown>): Note {
  return {
    id: row.id as string,
    date: row.date as string,
    content: row.content as string,
    description: (row.description as string) || null,
    category: row.category as NoteCategory,
    completed: row.completed as boolean,
    completed_at: (row.completed_at as string) || null,
    deadline: (row.deadline as string) || null,
    is_all_day: (row.is_all_day as boolean) || false,
    pinned: row.pinned as boolean,
    sort_order: (row.sort_order as number) ?? 0,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    deleted_at: (row.deleted_at as string) || null,
    deleted_reason: (row.deleted_reason as string) || null,
    project_id: (row.project_id as string) || null,
    last_postpone_reason: null,
    remote_id: row.id as string,
    sync_status: 'synced' as const,
    last_synced_at: row.updated_at as string,
    gcal_event_id: (row.gcal_event_id as string) || null,
    meeting_link: (row.meeting_link as string) || null,
    location: (row.location as string) || null,
    meeting_attendees: (row.meeting_attendees as MeetingAttendee[]) || null,
    gcal_html_link: (row.gcal_html_link as string) || null,
    is_public: (row.is_public as boolean) || false,
    public_slug: (row.public_slug as string) || null,
  };
}

function mapRowToVersion(row: Record<string, unknown>): NoteVersion {
  return {
    id: row.id as string,
    note_id: row.note_id as string,
    content: row.content as string,
    description: (row.description as string) || null,
    category: row.category as NoteCategory,
    completed: row.completed as boolean,
    version_number: row.version_number as number,
    created_at: row.created_at as string,
  };
}

function mapRowToAction(row: Record<string, unknown>): NoteAction {
  return {
    id: row.id as string,
    note_id: row.note_id as string,
    action_type: row.action_type as 'postponed',
    reason: (row.reason as string) || null,
    previous_date: (row.previous_date as string) || null,
    new_date: (row.new_date as string) || null,
    created_at: row.created_at as string,
  };
}

export class SupabaseNoteRepository implements INoteRepository {
  private userId: string;
  private projectId: string | null;
  private date: string;
  private cachedNotes: Note[] = [];

  constructor(userId: string, projectId: string | null = null, date: string) {
    this.userId = userId;
    this.projectId = projectId;
    this.date = date;
  }

  async getAll(filters?: NoteFilters): Promise<Note[]> {
    if (!supabase) return [];

    let query = supabase
      .from('notes')
      .select('*')
      .eq('user_id', this.userId);

    // Handle deleted filter
    if (!filters?.includeDeleted) {
      query = query.is('deleted_at', null);
    }

    // Date filter
    const date = filters?.date ?? this.date;
    if (date) {
      query = query.eq('date', date);
    }

    // Project filter
    const projectId = filters?.projectId !== undefined ? filters.projectId : this.projectId;
    if (projectId !== undefined) {
      if (projectId === null) {
        query = query.is('project_id', null);
      } else {
        query = query.eq('project_id', projectId);
      }
    }

    // Completed filter
    if (filters?.completed !== undefined) {
      query = query.eq('completed', filters.completed);
    }

    query = query
      .order('pinned', { ascending: false })
      .order('sort_order', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[SupabaseNoteRepository] getAll error:', error);
      return [];
    }

    this.cachedNotes = (data || []).map(mapRowToNote);
    return this.cachedNotes;
  }

  async getById(id: string): Promise<Note | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseNoteRepository] getById error:', error);
      return null;
    }

    return data ? mapRowToNote(data) : null;
  }

  async getVersions(noteId: string): Promise<NoteVersion[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('note_versions')
      .select('*')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('[SupabaseNoteRepository] getVersions error:', error);
      return [];
    }

    return (data || []).map(mapRowToVersion);
  }

  async getActions(noteId: string): Promise<NoteAction[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('note_actions')
      .select('*')
      .eq('note_id', noteId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[SupabaseNoteRepository] getActions error:', error);
      return [];
    }

    return (data || []).map(mapRowToAction);
  }

  async create(data: CreateNoteData): Promise<Note> {
    if (!supabase) throw new Error('Supabase not configured');

    // Calculate sort_order
    const maxSortOrder = this.cachedNotes.reduce(
      (max, n) => Math.max(max, n.sort_order || 0),
      -1
    );

    const { data: row, error } = await supabase
      .from('notes')
      .insert({
        user_id: this.userId,
        date: data.date ?? this.date,
        content: data.content,
        description: data.description || null,
        category: data.category,
        deadline: data.deadline || null,
        completed: false,
        pinned: data.pinned ?? false,
        sort_order: data.sortOrder ?? maxSortOrder + 1,
        project_id: data.projectId ?? this.projectId,
        is_public: false,
      })
      .select()
      .single();

    if (error) throw error;

    const note = mapRowToNote(row);

    // Create initial version
    await this.createVersion(note.id, note.content, note.description, note.category, note.completed);

    return note;
  }

  async createAfter(afterNoteId: string, data: CreateNoteData): Promise<Note> {
    if (!supabase) throw new Error('Supabase not configured');

    const afterNote = this.cachedNotes.find((n) => n.id === afterNoteId);
    const afterSortOrder = afterNote?.sort_order || 0;

    // Find next note's sort order
    const sortedNotes = [...this.cachedNotes].sort((a, b) => a.sort_order - b.sort_order);
    const afterIndex = sortedNotes.findIndex((n) => n.id === afterNoteId);
    let newSortOrder: number;

    if (afterIndex >= 0 && afterIndex < sortedNotes.length - 1) {
      const nextSortOrder = sortedNotes[afterIndex + 1].sort_order;
      newSortOrder = (afterSortOrder + nextSortOrder) / 2;
    } else {
      newSortOrder = afterSortOrder + 1;
    }

    // Build insert object, including id if provided (for BlockNote sync)
    const insertData: Record<string, unknown> = {
      user_id: this.userId,
      date: data.date ?? this.date,
      content: data.content,
      description: data.description || null,
      category: data.category,
      deadline: data.deadline || null,
      completed: false,
      pinned: data.pinned ?? false,
      sort_order: newSortOrder,
      project_id: data.projectId ?? this.projectId,
      is_public: false,
    };

    // Use BlockNote's block ID if provided to maintain sync
    if (data.id) {
      insertData.id = data.id;
    }

    const { data: row, error } = await supabase
      .from('notes')
      .insert(insertData as never)
      .select()
      .single();

    if (error) throw error;

    return mapRowToNote(row);
  }

  async update(id: string, data: UpdateNoteData): Promise<void> {
    if (!supabase) return;

    // Get current note to check for description changes
    const currentNote = await this.getById(id);

    const updates: Record<string, unknown> = {};
    if (data.content !== undefined) updates.content = data.content;
    if (data.category !== undefined) updates.category = data.category;
    if (data.description !== undefined) updates.description = data.description;
    if (data.deadline !== undefined) updates.deadline = data.deadline;
    if (data.projectId !== undefined) updates.project_id = data.projectId;
    if (data.date !== undefined) updates.date = data.date;

    const { error } = await supabase
      .from('notes')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[SupabaseNoteRepository] update error:', error);
      return;
    }

    // Create version if description changed
    if (
      currentNote &&
      data.description !== undefined &&
      data.description !== currentNote.description
    ) {
      const hasNewContent = data.description && data.description.trim().length > 0;
      const hadPreviousContent =
        currentNote.description && currentNote.description.trim().length > 0;

      if (hasNewContent || hadPreviousContent) {
        await this.createVersion(
          id,
          data.content ?? currentNote.content,
          data.description,
          data.category ?? currentNote.category,
          currentNote.completed
        );
      }
    }
  }

  async delete(id: string, reason: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('notes')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_reason: reason,
      })
      .eq('id', id);

    if (error) {
      console.error('[SupabaseNoteRepository] delete error:', error);
    }
  }

  async restore(id: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('notes')
      .update({
        deleted_at: null,
        deleted_reason: null,
      })
      .eq('id', id);

    if (error) {
      console.error('[SupabaseNoteRepository] restore error:', error);
    }
  }

  async toggleCompleted(id: string, completed: boolean): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('notes')
      .update({
        completed,
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq('id', id);

    if (error) {
      console.error('[SupabaseNoteRepository] toggleCompleted error:', error);
    }
  }

  async togglePinned(id: string, pinned: boolean): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('notes')
      .update({ pinned })
      .eq('id', id);

    if (error) {
      console.error('[SupabaseNoteRepository] togglePinned error:', error);
    }
  }

  async reorder(noteIds: string[]): Promise<void> {
    if (!supabase) return;

    const updates = noteIds.map((id, index) =>
      supabase!.from('notes').update({ sort_order: index }).eq('id', id)
    );

    await Promise.all(updates);
  }

  async postpone(id: string, newDate: string, reason?: string): Promise<void> {
    if (!supabase) return;

    const note = this.cachedNotes.find((n) => n.id === id);
    const previousDate = note?.deadline || null;

    // Update note deadline
    const { error: noteError } = await supabase
      .from('notes')
      .update({ deadline: newDate })
      .eq('id', id);

    if (noteError) {
      console.error('[SupabaseNoteRepository] postpone error:', noteError);
      return;
    }

    // Create action record
    const { error: actionError } = await supabase.from('note_actions').insert({
      user_id: this.userId,
      note_id: id,
      action_type: 'postponed',
      reason: reason || null,
      previous_date: previousDate,
      new_date: newDate,
    });

    if (actionError) {
      console.error('[SupabaseNoteRepository] create action error:', actionError);
    }
  }

  subscribe(callback: (event: RealtimeEvent<Note>) => void): () => void {
    if (!supabase) return () => {};

    const channel: SupabaseChannel = supabase
      .channel(`notes-${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          callback({
            type: payload.eventType as RealtimeEvent['type'],
            table: 'notes',
            old: payload.old ? mapRowToNote(payload.old as Record<string, unknown>) : null,
            new: payload.new ? mapRowToNote(payload.new as Record<string, unknown>) : null,
          });
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }

  // Private helper methods
  private async createVersion(
    noteId: string,
    content: string,
    description: string | null,
    category: NoteCategory,
    completed: boolean
  ): Promise<void> {
    if (!supabase) return;

    // Get last version to check throttling
    const { data: lastVersion } = await supabase
      .from('note_versions')
      .select('version_number, created_at')
      .eq('note_id', noteId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Throttle: don't create if last version was less than 30 seconds ago
    if (lastVersion?.created_at) {
      const lastVersionTime = new Date(lastVersion.created_at).getTime();
      const secondsSinceLastVersion = (Date.now() - lastVersionTime) / 1000;

      if (secondsSinceLastVersion < 30) {
        return;
      }
    }

    const nextVersionNumber = (lastVersion?.version_number || 0) + 1;

    const { error } = await supabase.from('note_versions').insert({
      note_id: noteId,
      user_id: this.userId,
      content,
      description: description || null,
      category,
      completed,
      version_number: nextVersionNumber,
    });

    if (error) {
      console.error('[SupabaseNoteRepository] createVersion error:', error);
    }
  }

  // Update context
  setProjectId(projectId: string | null): void {
    this.projectId = projectId;
  }

  setDate(date: string): void {
    this.date = date;
  }

  updateCache(notes: Note[]): void {
    this.cachedNotes = notes;
  }
}
