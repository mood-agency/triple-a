export interface Contact {
  id: string;
  name: string;
  lastname: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
  user_id?: string;
}

export type ContactInput = Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'user_id'>;
