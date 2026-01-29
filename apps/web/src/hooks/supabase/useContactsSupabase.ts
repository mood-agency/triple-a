import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Contact, ContactInput } from '@/types/contact';

/**
 * Supabase-direct contacts hook
 * Provides the same API as useContactsStore but queries Supabase directly
 */
export function useContactsSupabase() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);

  /**
   * Fetch contacts from Supabase
   */
  const fetchContacts = useCallback(async () => {
    if (!user || !supabase) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('name')
      .order('lastname');

    if (error) {
      console.error('[useContactsSupabase] Fetch error:', error);
      setLoading(false);
      return;
    }

    const contactsList: Contact[] = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      lastname: row.lastname || '',
      phone: row.phone || '',
      email: row.email || '',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      user_id: row.user_id,
      remote_id: row.id,
      sync_status: 'synced' as const,
      last_synced_at: row.updated_at || null,
      deleted_at: null,
    }));

    setContacts(contactsList);
    setLoading(false);
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Realtime subscription
  useEffect(() => {
    if (!user || !supabase) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`contacts-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchContacts()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user, fetchContacts]);

  /**
   * Create a new contact
   */
  const createContact = useCallback(
    async (contactInput: ContactInput): Promise<Contact> => {
      if (!user || !supabase) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          name: contactInput.name,
          lastname: contactInput.lastname,
          phone: contactInput.phone,
          email: contactInput.email,
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        lastname: data.lastname || '',
        phone: data.phone || '',
        email: data.email || '',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        user_id: data.user_id,
        remote_id: data.id,
        sync_status: 'synced',
      };
    },
    [user]
  );

  /**
   * Update a contact
   */
  const updateContact = useCallback(
    async (id: string, contactInput: Partial<ContactInput>): Promise<Contact> => {
      if (!supabase) throw new Error('Supabase not configured');

      const updates: Record<string, unknown> = {};
      if (contactInput.name !== undefined) updates.name = contactInput.name;
      if (contactInput.lastname !== undefined) updates.lastname = contactInput.lastname;
      if (contactInput.phone !== undefined) updates.phone = contactInput.phone;
      if (contactInput.email !== undefined) updates.email = contactInput.email;

      const { data, error } = await supabase
        .from('contacts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        lastname: data.lastname || '',
        phone: data.phone || '',
        email: data.email || '',
        created_at: data.created_at || new Date().toISOString(),
        updated_at: data.updated_at || new Date().toISOString(),
        user_id: data.user_id,
      };
    },
    []
  );

  /**
   * Delete a contact (soft delete)
   */
  const deleteContact = useCallback(async (id: string): Promise<void> => {
    if (!supabase) throw new Error('Supabase not configured');

    const { error } = await supabase
      .from('contacts')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  }, []);

  return {
    contacts,
    loading,
    createContact,
    updateContact,
    deleteContact,
  };
}
