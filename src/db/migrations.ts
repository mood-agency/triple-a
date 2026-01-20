import type { Database } from 'sql.js';

export function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'todo',
      completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date)
  `);

  // Migration: add completed column if it doesn't exist
  const tableInfo = db.exec("PRAGMA table_info(notes)");
  if (tableInfo.length > 0) {
    const columns = tableInfo[0].values.map((row) => row[1]);
    if (!columns.includes('completed')) {
      db.run('ALTER TABLE notes ADD COLUMN completed INTEGER NOT NULL DEFAULT 0');
    }
    // Migration: add category column if it doesn't exist
    if (!columns.includes('category')) {
      db.run("ALTER TABLE notes ADD COLUMN category TEXT NOT NULL DEFAULT 'todo'");
    }
    // Migration: add description column if it doesn't exist
    if (!columns.includes('description')) {
      db.run('ALTER TABLE notes ADD COLUMN description TEXT DEFAULT NULL');
    }
  }

  // Create note_history table for tracking changes
  db.run(`
    CREATE TABLE IF NOT EXISTS note_history (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      content TEXT NOT NULL,
      description TEXT DEFAULT NULL,
      category TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      changed_at TEXT NOT NULL,
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
    )
  `);

  // Migration: add description column to note_history if it doesn't exist
  const historyTableInfo = db.exec("PRAGMA table_info(note_history)");
  if (historyTableInfo.length > 0) {
    const historyColumns = historyTableInfo[0].values.map((row) => row[1]);
    if (!historyColumns.includes('description')) {
      db.run('ALTER TABLE note_history ADD COLUMN description TEXT DEFAULT NULL');
    }
  }

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_note_history_note_id ON note_history(note_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_note_history_changed_at ON note_history(changed_at)
  `);

  // Create labels table
  db.run(`
    CREATE TABLE IF NOT EXISTS labels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6b7280',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_labels_name ON labels(name)
  `);

  // Create note_labels junction table for many-to-many relationship
  db.run(`
    CREATE TABLE IF NOT EXISTS note_labels (
      note_id TEXT NOT NULL,
      label_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (note_id, label_id),
      FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
      FOREIGN KEY (label_id) REFERENCES labels(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_note_labels_note_id ON note_labels(note_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_note_labels_label_id ON note_labels(label_id)
  `);
}
