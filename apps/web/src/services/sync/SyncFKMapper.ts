import type { MergeableStore } from 'tinybase';
import type { PreparedRow, RemoteIdCache, SyncTable } from './types';

/**
 * SyncFKMapper handles foreign key mapping between local and remote IDs.
 */
export class SyncFKMapper {
  private store: MergeableStore;

  constructor(store: MergeableStore) {
    this.store = store;
  }

  /**
   * Build a cache of remote_id -> local_id for all tables.
   * This enables O(1) lookups during sync.
   */
  buildRemoteIdCache(): RemoteIdCache {
    const cache: RemoteIdCache = new Map();
    const tableNames: SyncTable[] = [
      'notes',
      'labels',
      'contacts',
      'note_versions',
      'note_actions',
      'note_labels',
      'note_assignees',
      'projects',
    ];

    for (const tableName of tableNames) {
      const table = this.store.getTable(tableName) || {};
      const tableCache = new Map<string, string>();

      for (const [localId, row] of Object.entries(table)) {
        const remoteId = (row as Record<string, unknown>).remote_id as
          | string
          | undefined;
        if (remoteId) {
          tableCache.set(remoteId, localId);
        }
      }

      cache.set(tableName, tableCache);
    }

    return cache;
  }

  /**
   * Find local ID by remote ID using cache (O(1)) or fallback to linear scan.
   */
  findLocalIdByRemoteId(
    table: SyncTable,
    remoteId: string,
    cache?: RemoteIdCache
  ): string | null {
    // Try cache first
    if (cache) {
      const tableCache = cache.get(table);
      if (tableCache) {
        return tableCache.get(remoteId) ?? null;
      }
    }

    // Fallback: linear scan
    const tableData = this.store.getTable(table) || {};
    for (const [localId, row] of Object.entries(tableData)) {
      if ((row as Record<string, unknown>).remote_id === remoteId) {
        return localId;
      }
    }

    return null;
  }

  /**
   * Prepare a row for push to Supabase.
   * Maps local FK IDs to remote IDs.
   * Returns null if required FKs can't be mapped (caller should queue for retry).
   */
  prepareForPush(
    table: SyncTable,
    localId: string,
    row: Record<string, unknown>,
    _cache: RemoteIdCache
  ): PreparedRow | null {
    const data = { ...row };
    const remoteId = data.remote_id as string | undefined;
    const deletedAt = data.deleted_at as string | null;

    // Remove local-only fields
    delete data.remote_id;
    delete data.sync_status;
    delete data.last_synced_at;

    // Map foreign keys based on table type
    switch (table) {
      case 'notes': {
        // Map assignee_id (contact)
        if (data.assignee_id) {
          const contact = this.store.getRow(
            'contacts',
            data.assignee_id as string
          );
          if (contact?.remote_id) {
            data.assignee_id = contact.remote_id;
          } else {
            data.assignee_id = null; // Can't map, clear it
          }
        }
        // Map project_id
        if (data.project_id) {
          const project = this.store.getRow(
            'projects',
            data.project_id as string
          );
          if (project?.remote_id) {
            data.project_id = project.remote_id;
          } else {
            data.project_id = null; // Can't map, clear it
          }
        }
        break;
      }

      case 'note_labels': {
        const noteLocalId = data.note_id as string;
        const labelLocalId = data.label_id as string;
        const note = this.store.getRow('notes', noteLocalId);
        const label = this.store.getRow('labels', labelLocalId);

        if (!note?.remote_id || !label?.remote_id) {
          // Required FKs not ready, queue for retry
          return null;
        }

        data.note_id = note.remote_id;
        data.label_id = label.remote_id;
        break;
      }

      case 'note_assignees': {
        const noteLocalId = data.note_id as string;
        const contactLocalId = data.contact_id as string;
        const note = this.store.getRow('notes', noteLocalId);
        const contact = this.store.getRow('contacts', contactLocalId);

        if (!note?.remote_id || !contact?.remote_id) {
          // Required FKs not ready, queue for retry
          return null;
        }

        data.note_id = note.remote_id;
        data.contact_id = contact.remote_id;
        break;
      }

      case 'note_versions':
      case 'note_actions': {
        const noteLocalId = data.note_id as string;
        const note = this.store.getRow('notes', noteLocalId);

        if (!note?.remote_id) {
          // Required FK not ready, queue for retry
          return null;
        }

        data.note_id = note.remote_id;
        break;
      }
    }

    return {
      localId,
      data,
      remoteId: remoteId || undefined,
      isDelete: !!deletedAt,
    };
  }

  /**
   * Map a remote row to local format.
   * Maps remote FK IDs to local IDs.
   */
  mapFromRemote(
    table: SyncTable,
    remoteRow: Record<string, unknown>,
    cache: RemoteIdCache
  ): Record<string, unknown> {
    const data = { ...remoteRow };

    // Remove Supabase-specific fields
    delete data.id;
    delete data.user_id;

    // Map foreign keys based on table type
    switch (table) {
      case 'notes': {
        if (data.assignee_id) {
          const localContactId = this.findLocalIdByRemoteId(
            'contacts',
            data.assignee_id as string,
            cache
          );
          data.assignee_id = localContactId || null;
        }
        if (data.project_id) {
          const localProjectId = this.findLocalIdByRemoteId(
            'projects',
            data.project_id as string,
            cache
          );
          data.project_id = localProjectId || null;
        }
        break;
      }

      case 'note_versions':
      case 'note_actions': {
        const localNoteId = this.findLocalIdByRemoteId(
          'notes',
          data.note_id as string,
          cache
        );
        if (localNoteId) {
          data.note_id = localNoteId;
        }
        break;
      }
    }

    return data;
  }

  /**
   * Map a junction table row from remote.
   * Returns the mapped row with local IDs, or null if FKs can't be resolved.
   */
  mapJunctionFromRemote(
    table: 'note_labels' | 'note_assignees',
    remoteRow: Record<string, unknown>,
    cache: RemoteIdCache
  ): { noteId: string; secondId: string; data: Record<string, unknown> } | null {
    const remoteNoteId = remoteRow.note_id as string;
    const secondKey = table === 'note_labels' ? 'label_id' : 'contact_id';
    const secondTable = table === 'note_labels' ? 'labels' : 'contacts';
    const remoteSecondId = remoteRow[secondKey] as string;

    const localNoteId = this.findLocalIdByRemoteId('notes', remoteNoteId, cache);
    const localSecondId = this.findLocalIdByRemoteId(
      secondTable,
      remoteSecondId,
      cache
    );

    if (!localNoteId || !localSecondId) {
      return null;
    }

    return {
      noteId: localNoteId,
      secondId: localSecondId,
      data: {
        note_id: localNoteId,
        [secondKey]: localSecondId,
        created_at: remoteRow.created_at,
      },
    };
  }
}
