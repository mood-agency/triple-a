import type { MergeableStore } from 'tinybase';
import { SyncBatcher } from './SyncBatcher';
import type { SyncServiceConfig, SyncTable } from './types';
import { TABLES_WITH_SOFT_DELETE } from './types';

/**
 * SyncDeletionHandler syncs remote deletions to the local store.
 * When a record is soft-deleted on Supabase, this removes the local copy.
 */
export class SyncDeletionHandler {
  private store: MergeableStore;
  private batcher: SyncBatcher;

  constructor(
    store: MergeableStore,
    userId: string,
    config: SyncServiceConfig
  ) {
    this.store = store;
    this.batcher = new SyncBatcher(userId, config);
  }

  /**
   * Sync deletions from Supabase.
   * Fetches all soft-deleted records and removes them locally.
   */
  async syncDeletions(): Promise<void> {
    for (const table of TABLES_WITH_SOFT_DELETE) {
      await this.syncTableDeletions(table);
    }
  }

  /**
   * Sync deletions for a single table.
   */
  private async syncTableDeletions(table: SyncTable): Promise<void> {
    const deletedRecords = await this.batcher.fetchDeleted(table);

    if (deletedRecords.length === 0) {
      return;
    }

    const deletedRemoteIds = new Set(
      deletedRecords.map((r) => r.id as string)
    );
    const localTable = this.store.getTable(table) || {};

    for (const [localId, row] of Object.entries(localTable)) {
      const remoteId = (row as Record<string, unknown>).remote_id as string;

      if (remoteId && deletedRemoteIds.has(remoteId)) {
        // Remote was deleted - remove locally
        this.store.delRow(table, localId);

        // Clean up related records
        this.cleanupRelatedRecords(table, localId);
      }
    }
  }

  /**
   * Clean up related records when a parent record is deleted.
   */
  private cleanupRelatedRecords(table: SyncTable, localId: string): void {
    switch (table) {
      case 'notes': {
        // Remove note_labels, note_assignees, note_versions, note_actions
        this.deleteRelatedRows('note_labels', 'note_id', localId);
        this.deleteRelatedRows('note_assignees', 'note_id', localId);
        this.deleteRelatedRows('note_versions', 'note_id', localId);
        this.deleteRelatedRows('note_actions', 'note_id', localId);
        break;
      }

      case 'labels': {
        // Remove note_labels for this label
        this.deleteRelatedRows('note_labels', 'label_id', localId);
        break;
      }

      case 'contacts': {
        // Remove note_assignees for this contact
        this.deleteRelatedRows('note_assignees', 'contact_id', localId);

        // Clear assignee_id on notes that reference this contact
        const notes = this.store.getTable('notes') || {};
        for (const [noteId, note] of Object.entries(notes)) {
          if ((note as Record<string, unknown>).assignee_id === localId) {
            this.store.setCell('notes', noteId, 'assignee_id', null);
          }
        }
        break;
      }

      case 'projects': {
        // Clear project_id on notes that reference this project
        const notes = this.store.getTable('notes') || {};
        for (const [noteId, note] of Object.entries(notes)) {
          if ((note as Record<string, unknown>).project_id === localId) {
            this.store.setCell('notes', noteId, 'project_id', null);
          }
        }
        break;
      }
    }
  }

  /**
   * Delete all rows in a table that have a specific foreign key value.
   */
  private deleteRelatedRows(
    table: string,
    fkColumn: string,
    fkValue: string
  ): void {
    const tableData = this.store.getTable(table) || {};

    for (const [rowId, row] of Object.entries(tableData)) {
      if ((row as Record<string, unknown>)[fkColumn] === fkValue) {
        this.store.delRow(table, rowId);
      }
    }
  }
}
