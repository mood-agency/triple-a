import { supabase } from '@/lib/supabase';
import type { Label } from '@/types/note';
import type {
  ILabelRepository,
  CreateLabelData,
  UpdateLabelData,
  RealtimeEvent,
} from '../types';

type SupabaseChannel = ReturnType<NonNullable<typeof supabase>['channel']>;

function mapRowToLabel(row: Record<string, unknown>): Label {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string) || '#6b7280',
    created_at: (row.created_at as string) || new Date().toISOString(),
    updated_at: (row.updated_at as string) || new Date().toISOString(),
    remote_id: row.id as string,
    sync_status: 'synced' as const,
    last_synced_at: (row.updated_at as string) || null,
  };
}

export class SupabaseLabelRepository implements ILabelRepository {
  private userId: string;
  private cachedLabels: Label[] = [];
  // cachedNoteLabelsMap reserved for future optimization

  constructor(userId: string) {
    this.userId = userId;
  }

  async getAll(): Promise<Label[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .eq('user_id', this.userId)
      .is('deleted_at', null)
      .order('name');

    if (error) {
      console.error('[SupabaseLabelRepository] getAll error:', error);
      return [];
    }

    this.cachedLabels = (data || []).map(mapRowToLabel);
    return this.cachedLabels;
  }

  async getById(id: string): Promise<Label | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseLabelRepository] getById error:', error);
      return null;
    }

    return data ? mapRowToLabel(data) : null;
  }

  async getLabelsForNote(noteId: string): Promise<Label[]> {
    if (!supabase) return [];

    // Get label IDs for this note
    const { data: noteLabels, error: noteLabelsError } = await supabase
      .from('note_labels')
      .select('label_id')
      .eq('note_id', noteId);

    if (noteLabelsError) {
      console.error('[SupabaseLabelRepository] getLabelsForNote error:', noteLabelsError);
      return [];
    }

    if (!noteLabels || noteLabels.length === 0) return [];

    const labelIds = noteLabels.map((nl) => nl.label_id);

    // Get labels
    const { data, error } = await supabase
      .from('labels')
      .select('*')
      .in('id', labelIds)
      .is('deleted_at', null)
      .order('name');

    if (error) {
      console.error('[SupabaseLabelRepository] getLabelsForNote labels error:', error);
      return [];
    }

    return (data || []).map(mapRowToLabel);
  }

  async getNoteLabelsMap(): Promise<Map<string, Label[]>> {
    if (!supabase) return new Map();

    // Fetch labels and note_labels in parallel
    const [labelsResult, noteLabelsResult] = await Promise.all([
      supabase
        .from('labels')
        .select('*')
        .eq('user_id', this.userId)
        .is('deleted_at', null)
        .order('name'),
      supabase.from('note_labels').select('note_id, label_id'),
    ]);

    if (labelsResult.error) {
      console.error('[SupabaseLabelRepository] getNoteLabelsMap labels error:', labelsResult.error);
      return new Map();
    }

    if (noteLabelsResult.error) {
      console.error('[SupabaseLabelRepository] getNoteLabelsMap noteLabels error:', noteLabelsResult.error);
      return new Map();
    }

    // Build labels map by ID
    const labelsById = new Map<string, Label>();
    for (const row of labelsResult.data || []) {
      labelsById.set(row.id, mapRowToLabel(row));
    }

    // Build note -> labels map
    const result = new Map<string, Label[]>();
    for (const row of noteLabelsResult.data || []) {
      const label = labelsById.get(row.label_id);
      if (label) {
        const existing = result.get(row.note_id) || [];
        existing.push(label);
        result.set(row.note_id, existing);
      }
    }

    // Sort labels by name for each note
    for (const [noteId, labels] of result) {
      result.set(
        noteId,
        labels.sort((a, b) => a.name.localeCompare(b.name))
      );
    }

    return result;
  }

  async create(data: CreateLabelData): Promise<Label> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data: row, error } = await supabase
      .from('labels')
      .insert({
        user_id: this.userId,
        name: data.name,
        color: data.color,
      })
      .select()
      .single();

    if (error) throw error;

    return mapRowToLabel(row);
  }

  async update(id: string, data: UpdateLabelData): Promise<void> {
    if (!supabase) return;

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.color !== undefined) updates.color = data.color;

    const { error } = await supabase
      .from('labels')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[SupabaseLabelRepository] update error:', error);
    }
  }

  async delete(id: string): Promise<void> {
    if (!supabase) return;

    // Soft delete the label
    const { error } = await supabase
      .from('labels')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[SupabaseLabelRepository] delete error:', error);
      return;
    }

    // Remove note_labels associations
    await supabase.from('note_labels').delete().eq('label_id', id);
  }

  async addToNote(noteId: string, labelId: string): Promise<void> {
    if (!supabase) return;

    // Check if already exists
    const { data: existing } = await supabase
      .from('note_labels')
      .select('note_id')
      .eq('note_id', noteId)
      .eq('label_id', labelId)
      .maybeSingle();

    if (existing) return;

    const { error } = await supabase.from('note_labels').insert({
      note_id: noteId,
      label_id: labelId,
      user_id: this.userId,
    });

    if (error) {
      console.error('[SupabaseLabelRepository] addToNote error:', error);
    }
  }

  async removeFromNote(noteId: string, labelId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('note_labels')
      .delete()
      .eq('note_id', noteId)
      .eq('label_id', labelId);

    if (error) {
      console.error('[SupabaseLabelRepository] removeFromNote error:', error);
    }
  }

  async createAndAddToNote(noteId: string, data: CreateLabelData): Promise<Label> {
    const label = await this.create(data);
    await this.addToNote(noteId, label.id);
    return label;
  }

  subscribe(callback: (event: RealtimeEvent<Label>) => void): () => void {
    if (!supabase) return () => {};

    const channel: SupabaseChannel = supabase
      .channel(`labels-${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'labels',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          callback({
            type: payload.eventType as RealtimeEvent['type'],
            table: 'labels',
            old: payload.old ? mapRowToLabel(payload.old as Record<string, unknown>) : null,
            new: payload.new ? mapRowToLabel(payload.new as Record<string, unknown>) : null,
          });
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }

  subscribeNoteLabels(callback: (event: RealtimeEvent) => void): () => void {
    if (!supabase) return () => {};

    const channel: SupabaseChannel = supabase
      .channel(`note-labels-${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_labels',
        },
        (payload) => {
          callback({
            type: payload.eventType as RealtimeEvent['type'],
            table: 'note_labels',
            old: payload.old,
            new: payload.new,
          });
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }
}
