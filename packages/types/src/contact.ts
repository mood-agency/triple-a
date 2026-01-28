export interface Contact {
  id: string;
  name: string;
  lastname: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
  // Sync fields
  remote_id?: string | null;
  sync_status?: 'local' | 'pending' | 'synced' | 'conflict';
  last_synced_at?: string | null;
  deleted_at?: string | null;
}

export type ContactInput = Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'remote_id' | 'sync_status' | 'last_synced_at' | 'deleted_at'>;
