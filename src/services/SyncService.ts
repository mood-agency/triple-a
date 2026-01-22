import type { Database } from 'sql.js'
import { supabase } from '@/lib/supabase'
import type { Note, Label, NoteHistory, NoteLabel } from '@/types/note'
import type { PendingSyncOperation, SyncTable, SyncOperation } from '@/types/sync'

// Get supabase client - returns null if not configured
function getSupabaseClient() {
  return supabase
}

// Type helpers for bypassing strict type inference issues with Supabase generics
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any

export class SyncService {
  private db: Database
  private userId: string
  private isSyncing = false

  constructor(db: Database, userId: string) {
    this.db = db
    this.userId = userId
  }

  async queueOperation(
    tableName: SyncTable,
    operation: SyncOperation,
    recordId: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    this.db.run(
      `INSERT INTO pending_sync (id, table_name, operation, record_id, data, created_at, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, tableName, operation, recordId, data ? JSON.stringify(data) : null, now]
    )
  }

  getPendingOperations(): PendingSyncOperation[] {
    const result = this.db.exec(
      'SELECT id, table_name, operation, record_id, data, created_at, retry_count FROM pending_sync ORDER BY created_at ASC'
    )

    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      table_name: row[1] as SyncTable,
      operation: row[2] as SyncOperation,
      record_id: row[3] as string,
      data: row[4] as string | null,
      created_at: row[5] as string,
      retry_count: row[6] as number,
    }))
  }

  getPendingCount(): number {
    const result = this.db.exec('SELECT COUNT(*) FROM pending_sync')
    if (result.length === 0) return 0
    return result[0].values[0][0] as number
  }

  private removeOperation(id: string): void {
    this.db.run('DELETE FROM pending_sync WHERE id = ?', [id])
  }

  private incrementRetry(id: string): void {
    this.db.run('UPDATE pending_sync SET retry_count = retry_count + 1 WHERE id = ?', [id])
  }

  async sync(): Promise<{ success: boolean; error?: string }> {
    console.log('[SyncService] sync() called')
    if (!getSupabaseClient()) {
      console.log('[SyncService] No Supabase client')
      return { success: false, error: 'Supabase not configured' }
    }

    if (this.isSyncing) {
      console.log('[SyncService] Already syncing')
      return { success: false, error: 'Sync already in progress' }
    }

    this.isSyncing = true

    try {
      // 1. Push local changes to remote
      console.log('[SyncService] Pushing changes...')
      await this.pushChanges()

      // 2. Pull remote changes
      console.log('[SyncService] Pulling changes...')
      await this.pullChanges()

      // Update last sync time
      const now = new Date().toISOString()
      this.db.run(
        `INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_synced_at', ?)`,
        [now]
      )

      console.log('[SyncService] Sync completed successfully')
      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown sync error'
      console.error('[SyncService] Sync error:', error)
      return { success: false, error: message }
    } finally {
      this.isSyncing = false
    }
  }

  private async pushChanges(): Promise<void> {
    if (!getSupabaseClient()) return

    const operations = this.getPendingOperations()
    console.log('[SyncService] Pending operations:', operations.length, operations)

    for (const op of operations) {
      try {
        console.log('[SyncService] Processing operation:', op)
        await this.processSyncOperation(op)
        this.removeOperation(op.id)
        console.log('[SyncService] Operation completed successfully')
      } catch (error) {
        console.error(`[SyncService] Sync operation failed:`, op, error)
        this.incrementRetry(op.id)

        if (op.retry_count >= 3) {
          this.removeOperation(op.id)
        }
      }
    }
  }

  private async processSyncOperation(op: PendingSyncOperation): Promise<void> {
    if (!getSupabaseClient()) return

    const data = op.data ? JSON.parse(op.data) : null

    switch (op.table_name) {
      case 'notes':
        await this.syncNote(op.operation, op.record_id, data)
        break
      case 'labels':
        await this.syncLabel(op.operation, op.record_id, data)
        break
      case 'note_labels':
        await this.syncNoteLabel(op.operation, op.record_id, data)
        break
      case 'note_history':
        await this.syncNoteHistory(op.operation, op.record_id, data)
        break
    }
  }

  private async syncNote(operation: SyncOperation, recordId: string, data: Partial<Note> | null): Promise<void> {
    const client = getSupabaseClient() as AnySupabaseClient
    if (!client) return

    switch (operation) {
      case 'insert':
        if (data) {
          console.log('[SyncService] Inserting note with user_id:', this.userId, 'data:', data)
          const { data: inserted, error } = await client
            .from('notes')
            .insert({
              user_id: this.userId,
              date: data.date!,
              content: data.content!,
              description: data.description,
              category: data.category,
              completed: data.completed,
              pinned: data.pinned,
              sort_order: data.sort_order ?? 0,
              created_at: data.created_at,
              updated_at: data.updated_at,
            })
            .select('id')
            .single()

          console.log('[SyncService] Insert result:', { inserted, error })
          if (error) throw error

          // Update local record with remote_id
          if (inserted) {
            this.db.run(
              `UPDATE notes SET remote_id = ?, sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
              [inserted.id, new Date().toISOString(), recordId]
            )
          }
        }
        break

      case 'update':
        if (data) {
          const remoteIdResult = this.db.exec(`SELECT remote_id FROM notes WHERE id = ?`, [recordId])
          const remoteId = remoteIdResult[0]?.values[0]?.[0] as string | null

          if (remoteId) {
            const { error } = await client
              .from('notes')
              .update({
                content: data.content,
                description: data.description,
                category: data.category,
                completed: data.completed,
                pinned: data.pinned,
                sort_order: data.sort_order,
                updated_at: data.updated_at,
              })
              .eq('id', remoteId)

            if (error) throw error

            this.db.run(
              `UPDATE notes SET sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
              [new Date().toISOString(), recordId]
            )
          }
        }
        break

      case 'delete': {
        const remoteIdResult = this.db.exec(`SELECT remote_id FROM notes WHERE id = ?`, [recordId])
        const remoteId = remoteIdResult[0]?.values[0]?.[0] as string | null

        if (remoteId) {
          const { error } = await client
            .from('notes')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', remoteId)

          if (error) throw error
        }
        break
      }
    }
  }

  private async syncLabel(operation: SyncOperation, recordId: string, data: Partial<Label> | null): Promise<void> {
    const client = getSupabaseClient() as AnySupabaseClient
    if (!client) return

    switch (operation) {
      case 'insert':
        if (data) {
          const { data: inserted, error } = await client
            .from('labels')
            .insert({
              user_id: this.userId,
              name: data.name!,
              color: data.color!,
              created_at: data.created_at,
              updated_at: data.updated_at,
            })
            .select('id')
            .single()

          if (error) throw error

          if (inserted) {
            this.db.run(
              `UPDATE labels SET remote_id = ?, sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
              [inserted.id, new Date().toISOString(), recordId]
            )
          }
        }
        break

      case 'update':
        if (data) {
          const remoteIdResult = this.db.exec(`SELECT remote_id FROM labels WHERE id = ?`, [recordId])
          const remoteId = remoteIdResult[0]?.values[0]?.[0] as string | null

          if (remoteId) {
            const { error } = await client
              .from('labels')
              .update({
                name: data.name,
                color: data.color,
                updated_at: data.updated_at,
              })
              .eq('id', remoteId)

            if (error) throw error

            this.db.run(
              `UPDATE labels SET sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
              [new Date().toISOString(), recordId]
            )
          }
        }
        break

      case 'delete': {
        const remoteIdResult = this.db.exec(`SELECT remote_id FROM labels WHERE id = ?`, [recordId])
        const remoteId = remoteIdResult[0]?.values[0]?.[0] as string | null

        if (remoteId) {
          const { error } = await client
            .from('labels')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', remoteId)

          if (error) throw error
        }
        break
      }
    }
  }

  private async syncNoteLabel(operation: SyncOperation, _recordId: string, data: Partial<NoteLabel> | null): Promise<void> {
    const client = getSupabaseClient() as AnySupabaseClient
    if (!client || !data) return

    // Get remote IDs for note and label
    const noteResult = this.db.exec(`SELECT remote_id FROM notes WHERE id = ?`, [data.note_id])
    const labelResult = this.db.exec(`SELECT remote_id FROM labels WHERE id = ?`, [data.label_id])

    const noteRemoteId = noteResult[0]?.values[0]?.[0] as string | null
    const labelRemoteId = labelResult[0]?.values[0]?.[0] as string | null

    if (!noteRemoteId || !labelRemoteId) return

    switch (operation) {
      case 'insert': {
        const { error: insertError } = await client
          .from('note_labels')
          .insert({
            note_id: noteRemoteId,
            label_id: labelRemoteId,
            user_id: this.userId,
            created_at: data.created_at,
          })

        if (insertError && !insertError.message.includes('duplicate')) {
          throw insertError
        }
        break
      }

      case 'delete': {
        const { error: deleteError } = await client
          .from('note_labels')
          .delete()
          .eq('note_id', noteRemoteId)
          .eq('label_id', labelRemoteId)

        if (deleteError) throw deleteError
        break
      }
    }
  }

  private async syncNoteHistory(_operation: SyncOperation, _recordId: string, data: Partial<NoteHistory> | null): Promise<void> {
    const client = getSupabaseClient() as AnySupabaseClient
    if (!client || _operation !== 'insert' || !data) return

    const noteResult = this.db.exec(`SELECT remote_id FROM notes WHERE id = ?`, [data.note_id])
    const noteRemoteId = noteResult[0]?.values[0]?.[0] as string | null

    if (!noteRemoteId) return

    const { error } = await client
      .from('note_history')
      .insert({
        note_id: noteRemoteId,
        user_id: this.userId,
        content: data.content!,
        description: data.description,
        category: data.category!,
        completed: data.completed,
        changed_at: data.changed_at,
      })

    if (error) throw error
  }

  private async pullChanges(): Promise<void> {
    const client = getSupabaseClient() as AnySupabaseClient
    if (!client) return

    const lastSyncResult = this.db.exec(`SELECT value FROM sync_state WHERE key = 'last_synced_at'`)
    const lastSyncedAt = lastSyncResult[0]?.values[0]?.[0] as string | null

    // Pull notes
    let notesQuery = client
      .from('notes')
      .select('*')
      .eq('user_id', this.userId)
      .is('deleted_at', null)

    if (lastSyncedAt) {
      notesQuery = notesQuery.gt('updated_at', lastSyncedAt)
    }

    const { data: remoteNotes, error: notesError } = await notesQuery
    if (notesError) throw notesError

    for (const remoteNote of remoteNotes || []) {
      this.mergeRemoteNote(remoteNote)
    }

    // Pull labels
    let labelsQuery = client
      .from('labels')
      .select('*')
      .eq('user_id', this.userId)
      .is('deleted_at', null)

    if (lastSyncedAt) {
      labelsQuery = labelsQuery.gt('updated_at', lastSyncedAt)
    }

    const { data: remoteLabels, error: labelsError } = await labelsQuery
    if (labelsError) throw labelsError

    for (const remoteLabel of remoteLabels || []) {
      this.mergeRemoteLabel(remoteLabel)
    }
  }

  private mergeRemoteNote(remoteNote: Record<string, unknown>): void {
    const existingResult = this.db.exec(
      `SELECT id, updated_at, sync_status FROM notes WHERE remote_id = ?`,
      [remoteNote.id as string]
    )

    const now = new Date().toISOString()

    if (existingResult.length === 0 || existingResult[0].values.length === 0) {
      // Insert new note from remote
      const localId = crypto.randomUUID()
      this.db.run(
        `INSERT INTO notes (id, date, content, description, category, completed, pinned, sort_order, created_at, updated_at, remote_id, sync_status, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [
          localId,
          remoteNote.date,
          remoteNote.content,
          remoteNote.description,
          remoteNote.category,
          remoteNote.completed ? 1 : 0,
          remoteNote.pinned ? 1 : 0,
          remoteNote.sort_order,
          remoteNote.created_at,
          remoteNote.updated_at,
          remoteNote.id,
          now,
        ]
      )
    } else {
      const [localId, localUpdatedAt, syncStatus] = existingResult[0].values[0] as [string, string, string]

      // Only update if remote is newer and local isn't pending
      if (syncStatus === 'synced' || new Date(remoteNote.updated_at as string) > new Date(localUpdatedAt)) {
        this.db.run(
          `UPDATE notes SET content = ?, description = ?, category = ?, completed = ?, pinned = ?, sort_order = ?, updated_at = ?, sync_status = 'synced', last_synced_at = ?
           WHERE id = ?`,
          [
            remoteNote.content,
            remoteNote.description,
            remoteNote.category,
            remoteNote.completed ? 1 : 0,
            remoteNote.pinned ? 1 : 0,
            remoteNote.sort_order,
            remoteNote.updated_at,
            now,
            localId,
          ]
        )
      }
    }
  }

  private mergeRemoteLabel(remoteLabel: Record<string, unknown>): void {
    const existingResult = this.db.exec(
      `SELECT id, updated_at, sync_status FROM labels WHERE remote_id = ?`,
      [remoteLabel.id as string]
    )

    const now = new Date().toISOString()

    if (existingResult.length === 0 || existingResult[0].values.length === 0) {
      const localId = crypto.randomUUID()
      this.db.run(
        `INSERT INTO labels (id, name, color, created_at, updated_at, remote_id, sync_status, last_synced_at)
         VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [
          localId,
          remoteLabel.name,
          remoteLabel.color,
          remoteLabel.created_at,
          remoteLabel.updated_at,
          remoteLabel.id,
          now,
        ]
      )
    } else {
      const [localId, localUpdatedAt, syncStatus] = existingResult[0].values[0] as [string, string, string]

      if (syncStatus === 'synced' || new Date(remoteLabel.updated_at as string) > new Date(localUpdatedAt)) {
        this.db.run(
          `UPDATE labels SET name = ?, color = ?, updated_at = ?, sync_status = 'synced', last_synced_at = ?
           WHERE id = ?`,
          [
            remoteLabel.name,
            remoteLabel.color,
            remoteLabel.updated_at,
            now,
            localId,
          ]
        )
      }
    }
  }

  getLastSyncedAt(): string | null {
    const result = this.db.exec(`SELECT value FROM sync_state WHERE key = 'last_synced_at'`)
    return result[0]?.values[0]?.[0] as string | null
  }

  // One-way sync: Pull all data from Supabase (ignores lastSyncedAt)
  async pullAllFromSupabase(
    onProgress?: (current: number, total: number, item: string) => void
  ): Promise<{ success: boolean; error?: string; pulled: { notes: number; labels: number; noteLabels: number } }> {
    const client = getSupabaseClient() as AnySupabaseClient
    if (!client) {
      return { success: false, error: 'Supabase not configured', pulled: { notes: 0, labels: 0, noteLabels: 0 } }
    }

    if (this.isSyncing) {
      return { success: false, error: 'Sync already in progress', pulled: { notes: 0, labels: 0, noteLabels: 0 } }
    }

    this.isSyncing = true
    const pulled = { notes: 0, labels: 0, noteLabels: 0 }

    try {
      console.log('[SyncService] pullAllFromSupabase - Starting full pull')

      // Get all remote labels
      const { data: remoteLabels, error: labelsError } = await client
        .from('labels')
        .select('*')
        .eq('user_id', this.userId)
        .is('deleted_at', null)

      if (labelsError) throw labelsError

      // Get all remote notes
      const { data: remoteNotes, error: notesError } = await client
        .from('notes')
        .select('*')
        .eq('user_id', this.userId)
        .is('deleted_at', null)

      if (notesError) throw notesError

      // Get all remote note_labels
      const { data: remoteNoteLabels, error: noteLabelsError } = await client
        .from('note_labels')
        .select('*')
        .eq('user_id', this.userId)

      if (noteLabelsError) throw noteLabelsError

      const total = (remoteLabels?.length || 0) + (remoteNotes?.length || 0) + (remoteNoteLabels?.length || 0)
      let current = 0

      console.log('[SyncService] Items to pull:', {
        labels: remoteLabels?.length || 0,
        notes: remoteNotes?.length || 0,
        noteLabels: remoteNoteLabels?.length || 0
      })

      const now = new Date().toISOString()

      // Pull labels first
      for (const remoteLabel of remoteLabels || []) {
        current++
        onProgress?.(current, total, `Label: ${remoteLabel.name}`)

        const existingResult = this.db.exec(
          `SELECT id FROM labels WHERE remote_id = ?`,
          [remoteLabel.id as string]
        )

        if (existingResult.length === 0 || existingResult[0].values.length === 0) {
          // Insert new label
          const localId = crypto.randomUUID()
          this.db.run(
            `INSERT INTO labels (id, name, color, created_at, updated_at, remote_id, sync_status, last_synced_at)
             VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)`,
            [
              localId,
              remoteLabel.name,
              remoteLabel.color,
              remoteLabel.created_at,
              remoteLabel.updated_at,
              remoteLabel.id,
              now,
            ]
          )
          pulled.labels++
        } else {
          // Update existing
          const localId = existingResult[0].values[0][0] as string
          this.db.run(
            `UPDATE labels SET name = ?, color = ?, updated_at = ?, sync_status = 'synced', last_synced_at = ?
             WHERE id = ?`,
            [
              remoteLabel.name,
              remoteLabel.color,
              remoteLabel.updated_at,
              now,
              localId,
            ]
          )
          pulled.labels++
        }
      }

      // Pull notes
      for (const remoteNote of remoteNotes || []) {
        current++
        onProgress?.(current, total, `Note: ${(remoteNote.content as string).substring(0, 30)}...`)

        const existingResult = this.db.exec(
          `SELECT id FROM notes WHERE remote_id = ?`,
          [remoteNote.id as string]
        )

        if (existingResult.length === 0 || existingResult[0].values.length === 0) {
          // Insert new note
          const localId = crypto.randomUUID()
          this.db.run(
            `INSERT INTO notes (id, date, content, description, category, completed, completed_at, deadline, pinned, sort_order, created_at, updated_at, remote_id, sync_status, last_synced_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
            [
              localId,
              remoteNote.date,
              remoteNote.content,
              remoteNote.description,
              remoteNote.category,
              remoteNote.completed ? 1 : 0,
              remoteNote.completed_at,
              remoteNote.deadline,
              remoteNote.pinned ? 1 : 0,
              remoteNote.sort_order,
              remoteNote.created_at,
              remoteNote.updated_at,
              remoteNote.id,
              now,
            ]
          )
          pulled.notes++
        } else {
          // Update existing
          const localId = existingResult[0].values[0][0] as string
          this.db.run(
            `UPDATE notes SET date = ?, content = ?, description = ?, category = ?, completed = ?, completed_at = ?, deadline = ?, pinned = ?, sort_order = ?, updated_at = ?, sync_status = 'synced', last_synced_at = ?
             WHERE id = ?`,
            [
              remoteNote.date,
              remoteNote.content,
              remoteNote.description,
              remoteNote.category,
              remoteNote.completed ? 1 : 0,
              remoteNote.completed_at,
              remoteNote.deadline,
              remoteNote.pinned ? 1 : 0,
              remoteNote.sort_order,
              remoteNote.updated_at,
              now,
              localId,
            ]
          )
          pulled.notes++
        }
      }

      // Pull note_labels
      for (const remoteNoteLabel of remoteNoteLabels || []) {
        current++
        onProgress?.(current, total, `Note-Label relation`)

        // Get local IDs from remote IDs
        const noteResult = this.db.exec(`SELECT id FROM notes WHERE remote_id = ?`, [remoteNoteLabel.note_id])
        const labelResult = this.db.exec(`SELECT id FROM labels WHERE remote_id = ?`, [remoteNoteLabel.label_id])

        const localNoteId = noteResult[0]?.values[0]?.[0] as string | null
        const localLabelId = labelResult[0]?.values[0]?.[0] as string | null

        if (localNoteId && localLabelId) {
          // Check if relation exists
          const existingResult = this.db.exec(
            `SELECT note_id FROM note_labels WHERE note_id = ? AND label_id = ?`,
            [localNoteId, localLabelId]
          )

          if (existingResult.length === 0 || existingResult[0].values.length === 0) {
            this.db.run(
              `INSERT INTO note_labels (note_id, label_id, created_at) VALUES (?, ?, ?)`,
              [localNoteId, localLabelId, remoteNoteLabel.created_at]
            )
            pulled.noteLabels++
          }
        }
      }

      // Update last sync time
      this.db.run(
        `INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_synced_at', ?)`,
        [now]
      )

      console.log('[SyncService] pullAllFromSupabase - Complete:', pulled)
      return { success: true, pulled }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[SyncService] pullAllFromSupabase error:', error)
      return { success: false, error: message, pulled }
    } finally {
      this.isSyncing = false
    }
  }

  // One-way sync: Push all local data to Supabase
  async pushAllToSupabase(
    onProgress?: (current: number, total: number, item: string) => void
  ): Promise<{ success: boolean; error?: string; pushed: { notes: number; labels: number; noteLabels: number; noteHistory: number } }> {
    const client = getSupabaseClient() as AnySupabaseClient
    if (!client) {
      return { success: false, error: 'Supabase not configured', pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0 } }
    }

    if (this.isSyncing) {
      return { success: false, error: 'Sync already in progress', pushed: { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0 } }
    }

    this.isSyncing = true
    const pushed = { notes: 0, labels: 0, noteLabels: 0, noteHistory: 0 }

    try {
      // Get all local data
      const notesResult = this.db.exec(`SELECT id, date, content, description, category, completed, pinned, sort_order, created_at, updated_at, remote_id, deadline, completed_at FROM notes`)
      const labelsResult = this.db.exec(`SELECT id, name, color, created_at, updated_at, remote_id FROM labels`)
      const noteLabelsResult = this.db.exec(`SELECT note_id, label_id, created_at FROM note_labels`)
      const noteHistoryResult = this.db.exec(`SELECT id, note_id, content, description, category, completed, changed_at, action_type, reason, previous_date FROM note_history`)

      const notes = notesResult[0]?.values || []
      const labels = labelsResult[0]?.values || []
      const noteLabels = noteLabelsResult[0]?.values || []
      const noteHistory = noteHistoryResult[0]?.values || []

      const total = notes.length + labels.length + noteLabels.length + noteHistory.length
      let current = 0

      console.log('[SyncService] pushAllToSupabase - Starting one-way sync')
      console.log('[SyncService] Items to push:', { notes: notes.length, labels: labels.length, noteLabels: noteLabels.length, noteHistory: noteHistory.length })

      // Push all labels first (they need to exist before note_labels)
      for (const row of labels) {
        const [id, name, color, created_at, updated_at, remote_id] = row as [string, string, string, string, string, string | null]
        current++
        onProgress?.(current, total, `Label: ${name}`)

        try {
          if (remote_id) {
            // Update existing
            const { error } = await client
              .from('labels')
              .upsert({
                id: remote_id,
                user_id: this.userId,
                name,
                color,
                created_at,
                updated_at,
              })

            if (error) throw error
          } else {
            // Insert new
            const { data: inserted, error } = await client
              .from('labels')
              .insert({
                user_id: this.userId,
                name,
                color,
                created_at,
                updated_at,
              })
              .select('id')
              .single()

            if (error) throw error

            if (inserted) {
              this.db.run(
                `UPDATE labels SET remote_id = ?, sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
                [inserted.id, new Date().toISOString(), id]
              )
            }
          }
          pushed.labels++
        } catch (error) {
          console.error('[SyncService] Failed to push label:', id, error)
        }
      }

      // Push all notes
      for (const row of notes) {
        const [id, date, content, description, category, completed, pinned, sort_order, created_at, updated_at, remote_id, deadline, completed_at] = row as [string, string, string, string | null, string, number, number, number, string, string, string | null, string | null, string | null]
        current++
        onProgress?.(current, total, `Note: ${content.substring(0, 30)}...`)

        try {
          if (remote_id) {
            // Update existing
            const { error } = await client
              .from('notes')
              .upsert({
                id: remote_id,
                user_id: this.userId,
                date,
                content,
                description,
                category,
                completed: completed === 1,
                pinned: pinned === 1,
                sort_order,
                created_at,
                updated_at,
                deadline,
                completed_at,
              })

            if (error) throw error
          } else {
            // Insert new
            const { data: inserted, error } = await client
              .from('notes')
              .insert({
                user_id: this.userId,
                date,
                content,
                description,
                category,
                completed: completed === 1,
                pinned: pinned === 1,
                sort_order,
                created_at,
                updated_at,
                deadline,
                completed_at,
              })
              .select('id')
              .single()

            if (error) throw error

            if (inserted) {
              this.db.run(
                `UPDATE notes SET remote_id = ?, sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
                [inserted.id, new Date().toISOString(), id]
              )
            }
          }
          pushed.notes++
        } catch (error) {
          console.error('[SyncService] Failed to push note:', id, error)
        }
      }

      // Push note_labels (need to map local IDs to remote IDs)
      for (const row of noteLabels) {
        const [note_id, label_id, created_at] = row as [string, string, string]
        current++
        onProgress?.(current, total, `Note-Label relation`)

        try {
          const noteResult = this.db.exec(`SELECT remote_id FROM notes WHERE id = ?`, [note_id])
          const labelResult = this.db.exec(`SELECT remote_id FROM labels WHERE id = ?`, [label_id])

          const noteRemoteId = noteResult[0]?.values[0]?.[0] as string | null
          const labelRemoteId = labelResult[0]?.values[0]?.[0] as string | null

          if (noteRemoteId && labelRemoteId) {
            const { error } = await client
              .from('note_labels')
              .upsert({
                note_id: noteRemoteId,
                label_id: labelRemoteId,
                user_id: this.userId,
                created_at,
              })

            if (error && !error.message.includes('duplicate')) {
              throw error
            }
            pushed.noteLabels++
          }
        } catch (error) {
          console.error('[SyncService] Failed to push note_label:', note_id, label_id, error)
        }
      }

      // Push note_history
      for (const row of noteHistory) {
        const [id, note_id, content, description, category, completed, changed_at, action_type, reason, previous_date] = row as [string, string, string, string | null, string, number, string, string, string | null, string | null]
        current++
        onProgress?.(current, total, `History entry`)

        try {
          const noteResult = this.db.exec(`SELECT remote_id FROM notes WHERE id = ?`, [note_id])
          const noteRemoteId = noteResult[0]?.values[0]?.[0] as string | null

          if (noteRemoteId) {
            // Check if this history entry already exists (by note_id + changed_at)
            const { data: existing } = await client
              .from('note_history')
              .select('id')
              .eq('note_id', noteRemoteId)
              .eq('changed_at', changed_at)
              .maybeSingle()

            if (!existing) {
              const { error } = await client
                .from('note_history')
                .insert({
                  note_id: noteRemoteId,
                  user_id: this.userId,
                  content,
                  description,
                  category,
                  completed: completed === 1,
                  changed_at,
                  action_type,
                  reason,
                  previous_date,
                })

              if (error) throw error
              pushed.noteHistory++
            }
          }
        } catch (error) {
          console.error('[SyncService] Failed to push note_history:', id, error)
        }
      }

      // Clear pending sync queue since we've pushed everything
      this.db.run('DELETE FROM pending_sync')

      // Update last sync time
      const now = new Date().toISOString()
      this.db.run(
        `INSERT OR REPLACE INTO sync_state (key, value) VALUES ('last_synced_at', ?)`,
        [now]
      )

      console.log('[SyncService] pushAllToSupabase - Complete:', pushed)
      return { success: true, pushed }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[SyncService] pushAllToSupabase error:', error)
      return { success: false, error: message, pushed }
    } finally {
      this.isSyncing = false
    }
  }
}
