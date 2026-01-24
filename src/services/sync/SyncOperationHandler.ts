import type { Database } from 'sql.js';
import type { Note, Label, NoteHistory, NoteLabel } from '@/types/note';
import type { Contact } from '@/types/contact';
import type { PendingSyncOperation, SyncOperation } from '@/types/sync';

// Type helper for bypassing strict type inference issues with Supabase generics
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = any;

/**
 * Service for handling individual sync operations (insert, update, delete)
 * Processes pending sync queue items and syncs them to Supabase
 */
export class SyncOperationHandler {
  private db: Database;
  private userId: string;
  private supabaseClient: AnySupabaseClient;

  constructor(db: Database, userId: string, supabaseClient: AnySupabaseClient) {
    this.db = db;
    this.userId = userId;
    this.supabaseClient = supabaseClient;
  }

  /**
   * Process a single sync operation from the pending queue
   */
  async processSyncOperation(op: PendingSyncOperation): Promise<void> {
    if (!this.supabaseClient) return;

    const data = op.data ? JSON.parse(op.data) : null;

    switch (op.table_name) {
      case 'notes':
        await this.syncNote(op.operation, op.record_id, data);
        break;
      case 'labels':
        await this.syncLabel(op.operation, op.record_id, data);
        break;
      case 'note_labels':
        await this.syncNoteLabel(op.operation, op.record_id, data);
        break;
      case 'note_history':
        await this.syncNoteHistory(op.operation, op.record_id, data);
        break;
      case 'contacts':
        await this.syncContact(op.operation, op.record_id, data);
        break;
    }
  }

  /**
   * Sync a note operation (insert, update, delete) to Supabase
   */
  private async syncNote(operation: SyncOperation, recordId: string, data: Partial<Note> | null): Promise<void> {
    const client = this.supabaseClient;
    if (!client) return;

    // Helper to map local assignee_id to remote contact id
    const getRemoteAssigneeId = (localAssigneeId: string | null | undefined): string | null => {
      if (!localAssigneeId) return null;
      const contactResult = this.db.exec(`SELECT remote_id FROM contacts WHERE id = ?`, [localAssigneeId]);
      return contactResult[0]?.values[0]?.[0] as string | null;
    };

    switch (operation) {
      case 'insert':
        if (data) {
          console.log('[SyncOperationHandler] Inserting note with user_id:', this.userId, 'data:', data);
          const remoteAssigneeId = getRemoteAssigneeId(data.assignee_id);
          const { data: inserted, error } = await client
            .from('notes')
            .insert({
              user_id: this.userId,
              date: data.date!,
              content: data.content!,
              description: data.description,
              category: data.category,
              completed: data.completed,
              completed_at: data.completed_at,
              deadline: data.deadline,
              pinned: data.pinned,
              sort_order: data.sort_order ?? 0,
              created_at: data.created_at,
              updated_at: data.updated_at,
              assignee_id: remoteAssigneeId,
            })
            .select('id')
            .single();

          console.log('[SyncOperationHandler] Insert result:', { inserted, error });
          if (error) throw error;

          // Update local record with remote_id
          if (inserted) {
            this.db.run(
              `UPDATE notes SET remote_id = ?, sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
              [inserted.id, new Date().toISOString(), recordId]
            );
          }
        }
        break;

      case 'update':
        if (data) {
          const remoteIdResult = this.db.exec(`SELECT remote_id FROM notes WHERE id = ?`, [recordId]);
          const remoteId = remoteIdResult[0]?.values[0]?.[0] as string | null;

          if (remoteId) {
            const remoteAssigneeId = getRemoteAssigneeId(data.assignee_id);
            const { error } = await client
              .from('notes')
              .update({
                content: data.content,
                description: data.description,
                category: data.category,
                completed: data.completed,
                completed_at: data.completed_at,
                deadline: data.deadline,
                pinned: data.pinned,
                sort_order: data.sort_order,
                updated_at: data.updated_at,
                deleted_at: data.deleted_at,
                assignee_id: remoteAssigneeId,
              })
              .eq('id', remoteId);

            if (error) throw error;

            this.db.run(
              `UPDATE notes SET sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
              [new Date().toISOString(), recordId]
            );
          }
        }
        break;

      case 'delete': {
        const remoteIdResult = this.db.exec(`SELECT remote_id FROM notes WHERE id = ?`, [recordId]);
        const remoteId = remoteIdResult[0]?.values[0]?.[0] as string | null;

        if (remoteId) {
          const { error } = await client
            .from('notes')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', remoteId);

          if (error) throw error;
        }
        break;
      }
    }
  }

  /**
   * Sync a label operation (insert, update, delete) to Supabase
   */
  private async syncLabel(operation: SyncOperation, recordId: string, data: Partial<Label> | null): Promise<void> {
    const client = this.supabaseClient;
    if (!client) return;

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
            .single();

          if (error) throw error;

          if (inserted) {
            this.db.run(
              `UPDATE labels SET remote_id = ?, sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
              [inserted.id, new Date().toISOString(), recordId]
            );
          }
        }
        break;

      case 'update':
        if (data) {
          const remoteIdResult = this.db.exec(`SELECT remote_id FROM labels WHERE id = ?`, [recordId]);
          const remoteId = remoteIdResult[0]?.values[0]?.[0] as string | null;

          if (remoteId) {
            const { error } = await client
              .from('labels')
              .update({
                name: data.name,
                color: data.color,
                updated_at: data.updated_at,
              })
              .eq('id', remoteId);

            if (error) throw error;

            this.db.run(
              `UPDATE labels SET sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
              [new Date().toISOString(), recordId]
            );
          }
        }
        break;

      case 'delete': {
        const remoteIdResult = this.db.exec(`SELECT remote_id FROM labels WHERE id = ?`, [recordId]);
        const remoteId = remoteIdResult[0]?.values[0]?.[0] as string | null;

        if (remoteId) {
          const { error } = await client
            .from('labels')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', remoteId);

          if (error) throw error;
        }
        break;
      }
    }
  }

  /**
   * Sync a note-label relationship (insert, delete) to Supabase
   */
  private async syncNoteLabel(operation: SyncOperation, _recordId: string, data: Partial<NoteLabel> | null): Promise<void> {
    const client = this.supabaseClient;
    if (!client || !data) return;

    // Get remote IDs for note and label
    const noteResult = this.db.exec(`SELECT remote_id FROM notes WHERE id = ?`, [data.note_id]);
    const labelResult = this.db.exec(`SELECT remote_id FROM labels WHERE id = ?`, [data.label_id]);

    const noteRemoteId = noteResult[0]?.values[0]?.[0] as string | null;
    const labelRemoteId = labelResult[0]?.values[0]?.[0] as string | null;

    if (!noteRemoteId || !labelRemoteId) return;

    switch (operation) {
      case 'insert': {
        const { error: insertError } = await client
          .from('note_labels')
          .insert({
            note_id: noteRemoteId,
            label_id: labelRemoteId,
            user_id: this.userId,
            created_at: data.created_at,
          });

        if (insertError && !insertError.message.includes('duplicate')) {
          throw insertError;
        }
        break;
      }

      case 'delete': {
        const { error: deleteError } = await client
          .from('note_labels')
          .delete()
          .eq('note_id', noteRemoteId)
          .eq('label_id', labelRemoteId);

        if (deleteError) throw deleteError;
        break;
      }
    }
  }

  /**
   * Sync a note history entry (insert only) to Supabase
   */
  private async syncNoteHistory(_operation: SyncOperation, _recordId: string, data: Partial<NoteHistory> | null): Promise<void> {
    const client = this.supabaseClient;
    if (!client || _operation !== 'insert' || !data) return;

    const noteResult = this.db.exec(`SELECT remote_id FROM notes WHERE id = ?`, [data.note_id]);
    const noteRemoteId = noteResult[0]?.values[0]?.[0] as string | null;

    if (!noteRemoteId) return;

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
      });

    if (error) throw error;
  }

  /**
   * Sync a contact operation (insert, update, delete) to Supabase
   */
  private async syncContact(operation: SyncOperation, recordId: string, data: Partial<Contact> | null): Promise<void> {
    const client = this.supabaseClient;
    if (!client) return;

    switch (operation) {
      case 'insert':
        if (data) {
          console.log('[SyncOperationHandler] Inserting contact with user_id:', this.userId, 'data:', data);
          const { data: inserted, error } = await client
            .from('contacts')
            .insert({
              user_id: this.userId,
              name: data.name!,
              lastname: data.lastname,
              phone: data.phone,
              email: data.email,
              created_at: data.created_at,
              updated_at: data.updated_at,
            })
            .select('id')
            .single();

          console.log('[SyncOperationHandler] Insert contact result:', { inserted, error });
          if (error) throw error;

          // Update local record with remote_id
          if (inserted) {
            this.db.run(
              `UPDATE contacts SET remote_id = ?, sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
              [inserted.id, new Date().toISOString(), recordId]
            );
          }
        }
        break;

      case 'update':
        if (data) {
          const remoteIdResult = this.db.exec(`SELECT remote_id FROM contacts WHERE id = ?`, [recordId]);
          const remoteId = remoteIdResult[0]?.values[0]?.[0] as string | null;

          if (remoteId) {
            const { error } = await client
              .from('contacts')
              .update({
                name: data.name,
                lastname: data.lastname,
                phone: data.phone,
                email: data.email,
                updated_at: data.updated_at,
                deleted_at: data.deleted_at,
              })
              .eq('id', remoteId);

            if (error) throw error;

            this.db.run(
              `UPDATE contacts SET sync_status = 'synced', last_synced_at = ? WHERE id = ?`,
              [new Date().toISOString(), recordId]
            );
          }
        }
        break;

      case 'delete': {
        const remoteIdResult = this.db.exec(`SELECT remote_id FROM contacts WHERE id = ?`, [recordId]);
        const remoteId = remoteIdResult[0]?.values[0]?.[0] as string | null;

        if (remoteId) {
          const { error } = await client
            .from('contacts')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', remoteId);

          if (error) throw error;
        }
        break;
      }
    }
  }
}
