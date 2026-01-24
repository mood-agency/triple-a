import type { Database } from 'sql.js';

// Type helper for bypassing strict type inference issues with Supabase generics
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

/**
 * Service for merging remote data into local database
 * Handles conflict resolution using timestamp-based strategy
 */
export class SyncMergeService {
  private db: Database;
  private userId: string;
  private supabaseClient: AnySupabaseClient;

  constructor(db: Database, userId: string, supabaseClient: AnySupabaseClient) {
    this.db = db;
    this.userId = userId;
    this.supabaseClient = supabaseClient;
  }

  /**
   * Pull remote changes from Supabase and merge into local database
   */
  async pullChanges(): Promise<void> {
    const client = this.supabaseClient;
    if (!client) return;

    const lastSyncResult = this.db.exec(`SELECT value FROM sync_state WHERE key = 'last_synced_at'`);
    const lastSyncedAt = lastSyncResult[0]?.values[0]?.[0] as string | null;

    // Pull notes (include deleted notes to sync deletions from other devices)
    let notesQuery = client
      .from('notes')
      .select('*')
      .eq('user_id', this.userId);

    if (lastSyncedAt) {
      notesQuery = notesQuery.gt('updated_at', lastSyncedAt);
    }

    const { data: remoteNotes, error: notesError } = await notesQuery;
    if (notesError) throw notesError;

    for (const remoteNote of remoteNotes || []) {
      this.mergeRemoteNote(remoteNote);
    }

    // Pull labels (include deleted labels to sync deletions from other devices)
    let labelsQuery = client
      .from('labels')
      .select('*')
      .eq('user_id', this.userId);

    if (lastSyncedAt) {
      labelsQuery = labelsQuery.gt('updated_at', lastSyncedAt);
    }

    const { data: remoteLabels, error: labelsError } = await labelsQuery;
    if (labelsError) throw labelsError;

    for (const remoteLabel of remoteLabels || []) {
      this.mergeRemoteLabel(remoteLabel);
    }

    // Pull note_history (using changed_at for incremental sync)
    let historyQuery = client
      .from('note_history')
      .select('*')
      .eq('user_id', this.userId);

    if (lastSyncedAt) {
      historyQuery = historyQuery.gt('changed_at', lastSyncedAt);
    }

    const { data: remoteHistory, error: historyError } = await historyQuery;
    if (historyError) throw historyError;

    for (const remoteHistoryEntry of remoteHistory || []) {
      this.mergeRemoteNoteHistory(remoteHistoryEntry);
    }
  }

  /**
   * Merge a remote note into local database
   * Uses timestamp-based conflict resolution (newer wins)
   */
  mergeRemoteNote(remoteNote: Record<string, unknown>): void {
    const existingResult = this.db.exec(
      `SELECT id, updated_at, sync_status FROM notes WHERE remote_id = ?`,
      [remoteNote.id as string]
    );

    const now = new Date().toISOString();

    if (existingResult.length === 0 || existingResult[0].values.length === 0) {
      // Insert new note from remote (including deleted_at for soft-deleted notes)
      const localId = crypto.randomUUID();
      this.db.run(
        `INSERT INTO notes (id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at, deleted_at, remote_id, sync_status, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [
          localId,
          remoteNote.date,
          remoteNote.content,
          remoteNote.description,
          remoteNote.category,
          remoteNote.completed ? 1 : 0,
          remoteNote.completed_at ?? null,
          remoteNote.deadline ?? null,
          remoteNote.pinned ? 1 : 0,
          remoteNote.sort_order,
          remoteNote.created_at,
          remoteNote.updated_at,
          remoteNote.deleted_at ?? null,
          remoteNote.id,
          now,
        ]
      );
    } else {
      const [localId, localUpdatedAt, syncStatus] = existingResult[0].values[0] as [string, string, string];

      // Only update if remote is newer and local isn't pending
      if (syncStatus === 'synced' || new Date(remoteNote.updated_at as string) > new Date(localUpdatedAt)) {
        this.db.run(
          `UPDATE notes SET content = ?, description = ?, category = ?, completed = ?, completed_at = ?, deadline = ?, pinned = ?, sort_order = ?, updated_at = ?, deleted_at = ?, sync_status = 'synced', last_synced_at = ?
           WHERE id = ?`,
          [
            remoteNote.content,
            remoteNote.description,
            remoteNote.category,
            remoteNote.completed ? 1 : 0,
            remoteNote.completed_at ?? null,
            remoteNote.deadline ?? null,
            remoteNote.pinned ? 1 : 0,
            remoteNote.sort_order,
            remoteNote.updated_at,
            remoteNote.deleted_at ?? null,
            now,
            localId,
          ]
        );
      }
    }
  }

  /**
   * Merge a remote label into local database
   * Uses timestamp-based conflict resolution (newer wins)
   */
  mergeRemoteLabel(remoteLabel: Record<string, unknown>): void {
    const existingResult = this.db.exec(
      `SELECT id, updated_at, sync_status FROM labels WHERE remote_id = ?`,
      [remoteLabel.id as string]
    );

    const now = new Date().toISOString();

    if (existingResult.length === 0 || existingResult[0].values.length === 0) {
      const localId = crypto.randomUUID();
      this.db.run(
        `INSERT INTO labels (id, name, color, created_at, updated_at, deleted_at, remote_id, sync_status, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [
          localId,
          remoteLabel.name,
          remoteLabel.color,
          remoteLabel.created_at,
          remoteLabel.updated_at,
          remoteLabel.deleted_at ?? null,
          remoteLabel.id,
          now,
        ]
      );
    } else {
      const [localId, localUpdatedAt, syncStatus] = existingResult[0].values[0] as [string, string, string];

      if (syncStatus === 'synced' || new Date(remoteLabel.updated_at as string) > new Date(localUpdatedAt)) {
        this.db.run(
          `UPDATE labels SET name = ?, color = ?, updated_at = ?, deleted_at = ?, sync_status = 'synced', last_synced_at = ?
           WHERE id = ?`,
          [
            remoteLabel.name,
            remoteLabel.color,
            remoteLabel.updated_at,
            remoteLabel.deleted_at ?? null,
            now,
            localId,
          ]
        );
      }
    }
  }

  /**
   * Merge a remote note_history entry into local database
   * Uses note_id + changed_at as unique identifier to avoid duplicates
   */
  mergeRemoteNoteHistory(remoteHistory: Record<string, unknown>): void {
    // Get local note ID from remote note ID
    const noteResult = this.db.exec(
      `SELECT id FROM notes WHERE remote_id = ?`,
      [remoteHistory.note_id as string]
    );

    const localNoteId = noteResult[0]?.values[0]?.[0] as string | null;

    // Skip if the note doesn't exist locally
    if (!localNoteId) return;

    // Check if this history entry already exists (by note_id + changed_at)
    const existingResult = this.db.exec(
      `SELECT id FROM note_history WHERE note_id = ? AND changed_at = ?`,
      [localNoteId, remoteHistory.changed_at as string]
    );

    if (existingResult.length === 0 || existingResult[0].values.length === 0) {
      // Insert new history entry
      const localId = crypto.randomUUID();
      this.db.run(
        `INSERT INTO note_history (id, note_id, content, description, category, completed, changed_at, action_type, reason, previous_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          localId,
          localNoteId,
          remoteHistory.content,
          remoteHistory.description ?? null,
          remoteHistory.category,
          remoteHistory.completed ? 1 : 0,
          remoteHistory.changed_at,
          remoteHistory.action_type ?? 'edit',
          remoteHistory.reason ?? null,
          remoteHistory.previous_date ?? null,
        ]
      );
    }
  }
}
