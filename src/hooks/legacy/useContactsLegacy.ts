import { useState, useCallback, useEffect } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useSync } from '@/contexts/SyncContext';
import { persistDatabase } from '@/db';
import type { Contact, ContactInput } from '@/types/contact';

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Legacy hook for managing contacts (sql.js implementation)
 */
export function useContactsLegacy() {
  const { db, isReady } = useDatabase();
  const { queueOperation } = useSync();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);

  const loadContacts = useCallback(() => {
    if (!db || !isReady) return;

    const query = 'SELECT id, name, lastname, phone, email, created_at, updated_at, user_id FROM contacts WHERE deleted_at IS NULL ORDER BY name ASC, lastname ASC';
    const result = db.exec(query);

    if (result.length > 0) {
      const rows = result[0].values.map((row) => ({
        id: row[0] as string,
        name: row[1] as string,
        lastname: row[2] as string,
        phone: row[3] as string,
        email: row[4] as string,
        created_at: row[5] as string,
        updated_at: row[6] as string,
        user_id: row[7] as string | undefined,
      }));
      setContacts(rows);
    } else {
      setContacts([]);
    }
    setLoading(false);
  }, [db, isReady]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const createContact = useCallback(
    async (contactInput: ContactInput): Promise<Contact> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();
      const contact: Contact = {
        id: generateId(),
        ...contactInput,
        created_at: now,
        updated_at: now,
      };

      db.run(
        'INSERT INTO contacts (id, name, lastname, phone, email, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [contact.id, contact.name, contact.lastname, contact.phone, contact.email, contact.created_at, contact.updated_at, 'local']
      );

      await persistDatabase();
      await queueOperation('contacts', 'insert', contact.id, {
        name: contact.name,
        lastname: contact.lastname,
        phone: contact.phone,
        email: contact.email,
        created_at: contact.created_at,
        updated_at: contact.updated_at,
      });
      loadContacts();
      return contact;
    },
    [db, loadContacts, queueOperation]
  );

  const updateContact = useCallback(
    async (id: string, contactInput: Partial<ContactInput>): Promise<Contact> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Build dynamic update query
      const updates: string[] = [];
      const params: unknown[] = [];
      const syncData: Record<string, unknown> = { updated_at: now };

      if (contactInput.name !== undefined) {
        updates.push('name = ?');
        params.push(contactInput.name);
        syncData.name = contactInput.name;
      }
      if (contactInput.lastname !== undefined) {
        updates.push('lastname = ?');
        params.push(contactInput.lastname);
        syncData.lastname = contactInput.lastname;
      }
      if (contactInput.phone !== undefined) {
        updates.push('phone = ?');
        params.push(contactInput.phone);
        syncData.phone = contactInput.phone;
      }
      if (contactInput.email !== undefined) {
        updates.push('email = ?');
        params.push(contactInput.email);
        syncData.email = contactInput.email;
      }

      updates.push('updated_at = ?');
      params.push(now);
      params.push(id);

      db.run(
        `UPDATE contacts SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      await persistDatabase();
      await queueOperation('contacts', 'update', id, syncData);
      loadContacts();

      // Return the updated contact
      const result = db.exec('SELECT id, name, lastname, phone, email, created_at, updated_at, user_id FROM contacts WHERE id = ?', [id]);
      if (result.length === 0 || result[0].values.length === 0) {
        throw new Error('Contact not found after update');
      }

      const row = result[0].values[0];
      return {
        id: row[0] as string,
        name: row[1] as string,
        lastname: row[2] as string,
        phone: row[3] as string,
        email: row[4] as string,
        created_at: row[5] as string,
        updated_at: row[6] as string,
        user_id: row[7] as string | undefined,
      };
    },
    [db, loadContacts, queueOperation]
  );

  const deleteContact = useCallback(
    async (id: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      // Soft delete for sync support
      const now = new Date().toISOString();
      db.run('UPDATE contacts SET deleted_at = ?, updated_at = ? WHERE id = ?', [now, now, id]);

      await persistDatabase();
      await queueOperation('contacts', 'delete', id);
      loadContacts();
    },
    [db, loadContacts, queueOperation]
  );

  return {
    contacts,
    loading,
    createContact,
    updateContact,
    deleteContact,
  };
}
