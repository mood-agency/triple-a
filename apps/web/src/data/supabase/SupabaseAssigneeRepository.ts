import { supabase } from '@/lib/supabase';
import type { Contact } from '@/types/contact';
import type {
  IAssigneeRepository,
  CreateContactData,
  UpdateContactData,
  RealtimeEvent,
} from '../types';

type SupabaseChannel = ReturnType<NonNullable<typeof supabase>['channel']>;

function mapRowToContact(row: Record<string, unknown>): Contact {
  return {
    id: row.id as string,
    name: row.name as string,
    lastname: (row.lastname as string) || '',
    phone: (row.phone as string) || '',
    email: (row.email as string) || '',
    created_at: (row.created_at as string) || new Date().toISOString(),
    updated_at: (row.updated_at as string) || new Date().toISOString(),
    user_id: row.user_id as string,
    remote_id: row.id as string,
    sync_status: 'synced' as const,
    last_synced_at: (row.updated_at as string) || null,
    deleted_at: (row.deleted_at as string) || null,
  };
}

export class SupabaseAssigneeRepository implements IAssigneeRepository {
  private userId: string;
  private cachedContacts: Contact[] = [];

  constructor(userId: string) {
    this.userId = userId;
  }

  async getAll(): Promise<Contact[]> {
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', this.userId)
      .is('deleted_at', null)
      .order('name');

    if (error) {
      console.error('[SupabaseAssigneeRepository] getAll error:', error);
      return [];
    }

    this.cachedContacts = (data || []).map(mapRowToContact);
    return this.cachedContacts;
  }

  async getById(id: string): Promise<Contact | null> {
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('[SupabaseAssigneeRepository] getById error:', error);
      return null;
    }

    return data ? mapRowToContact(data) : null;
  }

  async getAssigneesForNote(noteId: string): Promise<Contact[]> {
    if (!supabase) return [];

    // Get contact IDs for this note
    const { data: noteAssignees, error: noteAssigneesError } = await supabase
      .from('note_assignees')
      .select('contact_id')
      .eq('note_id', noteId);

    if (noteAssigneesError) {
      console.error('[SupabaseAssigneeRepository] getAssigneesForNote error:', noteAssigneesError);
      return [];
    }

    if (!noteAssignees || noteAssignees.length === 0) return [];

    const contactIds = noteAssignees.map((na) => na.contact_id);

    // Get contacts
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .in('id', contactIds)
      .is('deleted_at', null)
      .order('name');

    if (error) {
      console.error('[SupabaseAssigneeRepository] getAssigneesForNote contacts error:', error);
      return [];
    }

    return (data || []).map(mapRowToContact);
  }

  async getNoteAssigneesMap(): Promise<Map<string, Contact[]>> {
    if (!supabase) return new Map();

    // Fetch contacts and note_assignees in parallel
    const [contactsResult, noteAssigneesResult] = await Promise.all([
      supabase
        .from('contacts')
        .select('*')
        .eq('user_id', this.userId)
        .is('deleted_at', null)
        .order('name'),
      supabase.from('note_assignees').select('note_id, contact_id'),
    ]);

    if (contactsResult.error) {
      console.error('[SupabaseAssigneeRepository] getNoteAssigneesMap contacts error:', contactsResult.error);
      return new Map();
    }

    if (noteAssigneesResult.error) {
      console.error('[SupabaseAssigneeRepository] getNoteAssigneesMap noteAssignees error:', noteAssigneesResult.error);
      return new Map();
    }

    // Build contacts map by ID
    const contactsById = new Map<string, Contact>();
    for (const row of contactsResult.data || []) {
      contactsById.set(row.id, mapRowToContact(row));
    }

    // Build note -> contacts map
    const result = new Map<string, Contact[]>();
    for (const row of noteAssigneesResult.data || []) {
      const contact = contactsById.get(row.contact_id);
      if (contact) {
        const existing = result.get(row.note_id) || [];
        existing.push(contact);
        result.set(row.note_id, existing);
      }
    }

    // Sort contacts by name for each note
    for (const [noteId, contacts] of result) {
      result.set(
        noteId,
        contacts.sort((a, b) => a.name.localeCompare(b.name))
      );
    }

    return result;
  }

  async create(data: CreateContactData): Promise<Contact> {
    if (!supabase) throw new Error('Supabase not configured');

    const { data: row, error } = await supabase
      .from('contacts')
      .insert({
        user_id: this.userId,
        name: data.name,
        lastname: data.lastname,
        phone: data.phone || '',
        email: data.email || '',
      })
      .select()
      .single();

    if (error) throw error;

    return mapRowToContact(row);
  }

  async update(id: string, data: UpdateContactData): Promise<void> {
    if (!supabase) return;

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.lastname !== undefined) updates.lastname = data.lastname;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.email !== undefined) updates.email = data.email;

    const { error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id);

    if (error) {
      console.error('[SupabaseAssigneeRepository] update error:', error);
    }
  }

  async delete(id: string): Promise<void> {
    if (!supabase) return;

    // Soft delete
    const { error } = await supabase
      .from('contacts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('[SupabaseAssigneeRepository] delete error:', error);
      return;
    }

    // Remove note_assignees associations
    await supabase.from('note_assignees').delete().eq('contact_id', id);
  }

  async addToNote(noteId: string, contactId: string): Promise<void> {
    if (!supabase) return;

    // Check if already exists
    const { data: existing } = await supabase
      .from('note_assignees')
      .select('note_id')
      .eq('note_id', noteId)
      .eq('contact_id', contactId)
      .maybeSingle();

    if (existing) return;

    const { error } = await supabase.from('note_assignees').insert({
      note_id: noteId,
      contact_id: contactId,
      user_id: this.userId,
    });

    if (error) {
      console.error('[SupabaseAssigneeRepository] addToNote error:', error);
    }
  }

  async removeFromNote(noteId: string, contactId: string): Promise<void> {
    if (!supabase) return;

    const { error } = await supabase
      .from('note_assignees')
      .delete()
      .eq('note_id', noteId)
      .eq('contact_id', contactId);

    if (error) {
      console.error('[SupabaseAssigneeRepository] removeFromNote error:', error);
    }
  }

  async setNoteAssignees(noteId: string, contactIds: string[]): Promise<void> {
    if (!supabase) return;

    // Remove all existing
    await supabase.from('note_assignees').delete().eq('note_id', noteId);

    // Add new ones
    if (contactIds.length > 0) {
      const inserts = contactIds.map((contactId) => ({
        note_id: noteId,
        contact_id: contactId,
        user_id: this.userId,
      }));
      await supabase.from('note_assignees').insert(inserts);
    }
  }

  subscribe(callback: (event: RealtimeEvent<Contact>) => void): () => void {
    if (!supabase) return () => {};

    const channel: SupabaseChannel = supabase
      .channel(`contacts-${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          callback({
            type: payload.eventType as RealtimeEvent['type'],
            table: 'contacts',
            old: payload.old ? mapRowToContact(payload.old as Record<string, unknown>) : null,
            new: payload.new ? mapRowToContact(payload.new as Record<string, unknown>) : null,
          });
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(channel);
    };
  }

  subscribeNoteAssignees(callback: (event: RealtimeEvent) => void): () => void {
    if (!supabase) return () => {};

    const channel: SupabaseChannel = supabase
      .channel(`note-assignees-${this.userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_assignees',
        },
        (payload) => {
          callback({
            type: payload.eventType as RealtimeEvent['type'],
            table: 'note_assignees',
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
