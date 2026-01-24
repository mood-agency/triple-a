import { useState, useCallback, useEffect } from 'react';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import type { Contact, ContactInput } from '@/types/contact';
import { generateId, now } from '@/store/schema';

/**
 * TinyBase-based contacts hook
 * Provides the same API as the original useContacts hook
 */
export function useContactsStore() {
  const { store, isReady } = useTinyBase();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * Load contacts from TinyBase store
   */
  const loadContacts = useCallback(() => {
    if (!store || !isReady) return;

    const contactsTable = store.getTable('contacts') || {};

    const contactsList: Contact[] = Object.entries(contactsTable)
      .filter(([_, row]) => {
        // Filter out soft-deleted contacts
        return !(row as Record<string, unknown>).deleted_at;
      })
      .map(([id, row]) => {
        const contactRow = row as Record<string, unknown>;
        return {
          id,
          name: contactRow.name as string,
          lastname: contactRow.lastname as string,
          phone: contactRow.phone as string,
          email: contactRow.email as string,
          created_at: contactRow.created_at as string,
          updated_at: contactRow.updated_at as string,
          user_id: (contactRow.user_id as string) || undefined,
          remote_id: (contactRow.remote_id as string) || null,
          sync_status: (contactRow.sync_status as Contact['sync_status']) || 'local',
          last_synced_at: (contactRow.last_synced_at as string) || null,
          deleted_at: (contactRow.deleted_at as string) || null,
        };
      })
      .sort((a, b) => {
        const nameCompare = a.name.localeCompare(b.name);
        if (nameCompare !== 0) return nameCompare;
        return a.lastname.localeCompare(b.lastname);
      });

    setContacts(contactsList);
    setLoading(false);
  }, [store, isReady]);

  // Load contacts when store is ready
  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Listen to store changes
  useEffect(() => {
    if (!store) return;

    const listenerId = store.addTableListener('contacts', () => {
      loadContacts();
    });

    return () => {
      store.delListener(listenerId);
    };
  }, [store, loadContacts]);

  /**
   * Create a new contact
   */
  const createContact = useCallback(
    async (contactInput: ContactInput): Promise<Contact> => {
      if (!store) throw new Error('Store not ready');

      const id = generateId();
      const timestamp = now();

      const contact: Contact = {
        id,
        ...contactInput,
        created_at: timestamp,
        updated_at: timestamp,
      };

      store.setRow('contacts', id, {
        name: contactInput.name,
        lastname: contactInput.lastname,
        phone: contactInput.phone,
        email: contactInput.email,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
        user_id: null,
        remote_id: null,
        sync_status: 'local',
        last_synced_at: null,
      });

      return contact;
    },
    [store]
  );

  /**
   * Update a contact
   */
  const updateContact = useCallback(
    async (id: string, contactInput: Partial<ContactInput>): Promise<Contact> => {
      if (!store) throw new Error('Store not ready');

      const existingContact = store.getRow('contacts', id);
      if (!existingContact || Object.keys(existingContact).length === 0) {
        throw new Error('Contact not found');
      }

      const timestamp = now();
      const updates: Record<string, unknown> = {
        updated_at: timestamp,
        sync_status: 'pending',
      };

      if (contactInput.name !== undefined) {
        updates.name = contactInput.name;
      }
      if (contactInput.lastname !== undefined) {
        updates.lastname = contactInput.lastname;
      }
      if (contactInput.phone !== undefined) {
        updates.phone = contactInput.phone;
      }
      if (contactInput.email !== undefined) {
        updates.email = contactInput.email;
      }

      store.setPartialRow('contacts', id, updates);

      // Return the updated contact
      const updatedRow = store.getRow('contacts', id);
      return {
        id,
        name: updatedRow.name as string,
        lastname: updatedRow.lastname as string,
        phone: updatedRow.phone as string,
        email: updatedRow.email as string,
        created_at: updatedRow.created_at as string,
        updated_at: updatedRow.updated_at as string,
        user_id: (updatedRow.user_id as string) || undefined,
      };
    },
    [store]
  );

  /**
   * Delete a contact (soft delete)
   */
  const deleteContact = useCallback(
    async (id: string): Promise<void> => {
      if (!store) throw new Error('Store not ready');

      const timestamp = now();
      store.setPartialRow('contacts', id, {
        deleted_at: timestamp,
        updated_at: timestamp,
        sync_status: 'pending',
      });
    },
    [store]
  );

  return {
    contacts,
    loading,
    createContact,
    updateContact,
    deleteContact,
  };
}
