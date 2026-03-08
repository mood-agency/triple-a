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
  const userId = user?.id;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>['channel']> | null>(null);
  // Ref to always hold the latest fetchContacts — avoids re-subscribing realtime on fetch changes
  const fetchContactsRef = useRef<() => Promise<void>>(() => Promise.resolve());

  /**
   * Fetch contacts from Supabase
   */
  const fetchContacts = useCallback(async () => {
    if (!userId || !supabase) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('name')
      .order('lastname');

    if (error) {
      console.error('[useContactsSupabase] Fetch error:', error);
      setLoading(false);
      return;
    }

    const contactsList: Contact[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      lastname: row.lastname || '',
      phone: row.phone || '',
      email: row.email || '',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
      user_id: row.user_id,
      is_default: row.is_default || false,
      remote_id: row.id,
      sync_status: 'synced' as const,
      last_synced_at: row.updated_at || null,
      deleted_at: null,
    }));

    setContacts(contactsList);
    setLoading(false);
  }, [userId]);

  // Keep ref in sync so realtime handlers always call the latest version
  fetchContactsRef.current = fetchContacts;

  // Initial fetch
  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Realtime subscription
  // Uses fetchContactsRef so subscription doesn't need to be torn down on fetch fn change
  useEffect(() => {
    if (!userId || !supabase) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`contacts-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'contacts',
          filter: `user_id=eq.${userId}`,
        },
        () => fetchContactsRef.current()
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current && supabase) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  /**
   * Create a new contact
   */
  const createContact = useCallback(
    async (contactInput: ContactInput): Promise<Contact> => {
      if (!userId || !supabase) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: userId,
          name: contactInput.name,
          lastname: contactInput.lastname,
          phone: contactInput.phone,
          email: contactInput.email,
        })
        .select()
        .single();

      if (error) throw error;

      const row = data as any;
      return {
        id: row.id,
        name: row.name,
        lastname: row.lastname || '',
        phone: row.phone || '',
        email: row.email || '',
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
        user_id: row.user_id,
        is_default: row.is_default || false,
        remote_id: row.id,
        sync_status: 'synced',
      };
    },
    [userId]
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

      const row = data as any;
      return {
        id: row.id,
        name: row.name,
        lastname: row.lastname || '',
        phone: row.phone || '',
        email: row.email || '',
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
        user_id: row.user_id,
        is_default: row.is_default || false,
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

  /**
   * Set a contact as the default assignee
   * Automatically unsets any previous default contact
   */
  const setDefaultContact = useCallback(async (id: string): Promise<void> => {
    if (!userId || !supabase) throw new Error('Not authenticated');

    // First, unset all defaults for this user
    const { error: unsetError } = await supabase
      .from('contacts')
      .update({ is_default: false } as any)
      .eq('user_id', userId)
      .eq('is_default' as any, true);

    if (unsetError) throw unsetError;

    // Then set the new default
    const { error: setError } = await supabase
      .from('contacts')
      .update({ is_default: true } as any)
      .eq('id', id);

    if (setError) throw setError;

    // Refetch to update UI
    await fetchContacts();
  }, [userId, fetchContacts]);

  /**
   * Unset the default contact
   */
  const unsetDefaultContact = useCallback(async (id: string): Promise<void> => {
    if (!supabase) throw new Error('Supabase not configured');

    const { error } = await supabase
      .from('contacts')
      .update({ is_default: false } as any)
      .eq('id', id);

    if (error) throw error;

    // Refetch to update UI
    await fetchContacts();
  }, [fetchContacts]);

  return {
    contacts,
    loading,
    createContact,
    updateContact,
    deleteContact,
    setDefaultContact,
    unsetDefaultContact,
  };
}
