import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useContactsSupabase } from '@/hooks/supabase/useContactsSupabase';
import type { Contact, ContactInput } from '@/types/contact';

interface ContactsContextValue {
  contacts: Contact[];
  loading: boolean;
  createContact: (contactInput: ContactInput) => Promise<Contact>;
  updateContact: (id: string, contactInput: Partial<ContactInput>) => Promise<Contact>;
  deleteContact: (id: string) => Promise<void>;
}

const ContactsContext = createContext<ContactsContextValue | null>(null);

interface ContactsProviderProps {
  children: ReactNode;
}

export function ContactsProvider({ children }: ContactsProviderProps) {
  const {
    contacts,
    loading,
    createContact,
    updateContact,
    deleteContact,
  } = useContactsSupabase();

  const value = useMemo(() => ({
    contacts,
    loading,
    createContact,
    updateContact,
    deleteContact,
  }), [contacts, loading, createContact, updateContact, deleteContact]);

  return (
    <ContactsContext.Provider value={value}>
      {children}
    </ContactsContext.Provider>
  );
}

export function useContactsContext() {
  const context = useContext(ContactsContext);
  if (!context) {
    throw new Error('useContactsContext must be used within a ContactsProvider');
  }
  return context;
}
