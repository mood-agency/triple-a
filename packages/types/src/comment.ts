import type { SyncStatus } from './note'

export interface NoteComment {
  id: string
  user_id: string
  note_id: string
  thread_id: string | null
  content: string
  block_id: string | null
  resolved: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null

  // Sync fields
  remote_id?: string | null
  sync_status?: SyncStatus
  last_synced_at?: string | null
}

export interface NoteCommentInput {
  note_id: string
  thread_id?: string | null
  content: string
  block_id?: string | null
}

export interface NoteCommentThread {
  id: string
  block_id: string | null
  comments: NoteComment[]
  resolved: boolean
}
