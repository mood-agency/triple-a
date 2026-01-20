import initSqlJs, { Database } from 'sql.js';
import { loadFromIndexedDB, saveToIndexedDB } from './persistence';
import { runMigrations } from './migrations';

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
  });

  const savedData = await loadFromIndexedDB();
  db = savedData ? new SQL.Database(savedData) : new SQL.Database();

  runMigrations(db);

  return db;
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export async function persistDatabase(): Promise<void> {
  if (!db) return;
  const data = db.export();
  await saveToIndexedDB(data);
}
