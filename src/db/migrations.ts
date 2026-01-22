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
    // Migration: add action_type column for changelog
    if (!historyColumns.includes('action_type')) {
      db.run("ALTER TABLE note_history ADD COLUMN action_type TEXT DEFAULT 'edit'");
    }
    // Migration: add reason column for user-provided explanation
    if (!historyColumns.includes('reason')) {
      db.run('ALTER TABLE note_history ADD COLUMN reason TEXT DEFAULT NULL');
    }
    // Migration: add previous_date column for tracking postponements
    if (!historyColumns.includes('previous_date')) {
      db.run('ALTER TABLE note_history ADD COLUMN previous_date TEXT DEFAULT NULL');
    }
  }

  // Migration: add sort_order column if it doesn't exist
  const notesTableInfo = db.exec("PRAGMA table_info(notes)");
  if (notesTableInfo.length > 0) {
    const notesColumns = notesTableInfo[0].values.map((row) => row[1]);
    if (!notesColumns.includes('sort_order')) {
      db.run('ALTER TABLE notes ADD COLUMN sort_order INTEGER DEFAULT 0');
      // Initialize sort_order based on existing created_at order (descending, so newer = lower sort_order)
      db.run(`
        UPDATE notes SET sort_order = (
          SELECT COUNT(*) FROM notes n2
          WHERE n2.date = notes.date AND n2.created_at > notes.created_at
        )
      `);
    }
    // Migration: add pinned column if it doesn't exist
    if (!notesColumns.includes('pinned')) {
      db.run('ALTER TABLE notes ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0');
    }
    // Migration: add completed_at column if it doesn't exist
    if (!notesColumns.includes('completed_at')) {
      db.run('ALTER TABLE notes ADD COLUMN completed_at TEXT DEFAULT NULL');
    }
    // Migration: add deadline column if it doesn't exist
    if (!notesColumns.includes('deadline')) {
      db.run('ALTER TABLE notes ADD COLUMN deadline TEXT DEFAULT NULL');
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

  // ========================================
  // Sync-related migrations
  // ========================================

  // Add sync columns to notes table
  const syncNotesInfo = db.exec("PRAGMA table_info(notes)");
  if (syncNotesInfo.length > 0) {
    const syncNotesColumns = syncNotesInfo[0].values.map((row) => row[1]);
    if (!syncNotesColumns.includes('remote_id')) {
      db.run('ALTER TABLE notes ADD COLUMN remote_id TEXT DEFAULT NULL');
    }
    if (!syncNotesColumns.includes('sync_status')) {
      db.run("ALTER TABLE notes ADD COLUMN sync_status TEXT DEFAULT 'local'");
    }
    if (!syncNotesColumns.includes('last_synced_at')) {
      db.run('ALTER TABLE notes ADD COLUMN last_synced_at TEXT DEFAULT NULL');
    }
    // Migration: add deleted_at column for soft delete
    if (!syncNotesColumns.includes('deleted_at')) {
      db.run('ALTER TABLE notes ADD COLUMN deleted_at TEXT DEFAULT NULL');
    }
  }

  // Add sync columns to labels table
  const syncLabelsInfo = db.exec("PRAGMA table_info(labels)");
  if (syncLabelsInfo.length > 0) {
    const syncLabelsColumns = syncLabelsInfo[0].values.map((row) => row[1]);
    if (!syncLabelsColumns.includes('remote_id')) {
      db.run('ALTER TABLE labels ADD COLUMN remote_id TEXT DEFAULT NULL');
    }
    if (!syncLabelsColumns.includes('sync_status')) {
      db.run("ALTER TABLE labels ADD COLUMN sync_status TEXT DEFAULT 'local'");
    }
    if (!syncLabelsColumns.includes('last_synced_at')) {
      db.run('ALTER TABLE labels ADD COLUMN last_synced_at TEXT DEFAULT NULL');
    }
    // Migration: add deleted_at column for soft delete
    if (!syncLabelsColumns.includes('deleted_at')) {
      db.run('ALTER TABLE labels ADD COLUMN deleted_at TEXT DEFAULT NULL');
    }
  }

  // Create pending_sync table for offline operations queue
  db.run(`
    CREATE TABLE IF NOT EXISTS pending_sync (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      operation TEXT NOT NULL,
      record_id TEXT NOT NULL,
      data TEXT,
      created_at TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_pending_sync_created_at ON pending_sync(created_at)
  `);

  // Create sync_state table for tracking sync progress
  db.run(`
    CREATE TABLE IF NOT EXISTS sync_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Create contacts table
  db.run(`
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lastname TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      user_id TEXT DEFAULT NULL
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email)
  `);
}
