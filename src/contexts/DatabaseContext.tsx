import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Database } from 'sql.js';
import { initDatabase } from '@/db';

interface DatabaseContextType {
  db: Database | null;
  isReady: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    initDatabase()
      .then((database) => {
        setDb(database);
        setIsReady(true);
      })
      .catch((err) => setError(err));
  }, []);

  return (
    <DatabaseContext.Provider value={{ db, isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }
  return context;
}
