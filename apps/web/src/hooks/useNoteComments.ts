import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { NoteComment, NoteCommentThread } from '@triple-a/types'

export function useNoteComments(noteId: string) {
  const { user } = useAuth()
  const [comments, setComments] = useState<NoteComment[]>([])
  const [threads, setThreads] = useState<NoteCommentThread[]>([])

  // Load comments for this note
  const loadComments = useCallback(async () => {
    if (!supabase || !user || !noteId) {
      setComments([])
      setThreads([])
      return
    }

    try {
      // note_comments table not in generated Supabase types
      const { data, error } = await (supabase as any)
        .from('note_comments')
        .select('*')
        .eq('note_id', noteId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('[useNoteComments] Error loading comments:', error)
        setComments([])
        setThreads([])
        return
      }

      const allComments: NoteComment[] = (data || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        note_id: row.note_id,
        thread_id: row.thread_id,
        content: row.content,
        block_id: row.block_id,
        resolved: row.resolved,
        created_at: row.created_at,
        updated_at: row.updated_at,
        deleted_at: row.deleted_at,
        remote_id: row.remote_id,
        sync_status: row.sync_status as NoteComment['sync_status'],
        last_synced_at: row.last_synced_at,
      }))

      setComments(allComments)

      // Group into threads
      const threadMap = new Map<string, NoteCommentThread>()

      // First pass: create threads from root comments
      for (const comment of allComments) {
        if (!comment.thread_id) {
          threadMap.set(comment.id, {
            id: comment.id,
            block_id: comment.block_id,
            comments: [comment],
            resolved: comment.resolved,
          })
        }
      }

      // Second pass: add replies to threads
      for (const comment of allComments) {
        if (comment.thread_id) {
          const thread = threadMap.get(comment.thread_id)
          if (thread) {
            thread.comments.push(comment)
          }
        }
      }

      // Sort comments within threads by created_at
      for (const thread of threadMap.values()) {
        thread.comments.sort((a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      }

      setThreads(Array.from(threadMap.values()))
    } catch (err) {
      console.error('[useNoteComments] Unexpected error:', err)
      setComments([])
      setThreads([])
    }
  }, [user, noteId])

  // Load on mount and when noteId changes
  useEffect(() => {
    loadComments()
  }, [loadComments])

  // Realtime subscription
  useEffect(() => {
    if (!supabase || !user || !noteId) return

    const channel = supabase
      .channel(`note-comments-${noteId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_comments',
          filter: `note_id=eq.${noteId}`,
        },
        () => {
          loadComments()
        }
      )
      .subscribe()

    return () => {
      if (supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [user, noteId, loadComments])

  const addComment = useCallback(
    async (content: string, blockId?: string | null, threadId?: string | null) => {
      if (!supabase || !user) return null

      const { data, error } = await (supabase as any)
        .from('note_comments')
        .insert({
          user_id: user.id,
          note_id: noteId,
          thread_id: threadId || null,
          content,
          block_id: blockId || null,
          resolved: false,
          sync_status: 'synced',
        })
        .select('id')
        .single()

      if (error) {
        console.error('[useNoteComments] Error adding comment:', error)
        return null
      }

      return data?.id || null
    },
    [user, noteId]
  )

  const updateComment = useCallback(
    async (commentId: string, content: string) => {
      if (!supabase || !user) return

      const { error } = await (supabase as any)
        .from('note_comments')
        .update({ content })
        .eq('id', commentId)

      if (error) {
        console.error('[useNoteComments] Error updating comment:', error)
      }
    },
    [user]
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!supabase || !user) return

      const { error } = await (supabase as any)
        .from('note_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId)

      if (error) {
        console.error('[useNoteComments] Error deleting comment:', error)
      }
    },
    [user]
  )

  const resolveThread = useCallback(
    async (threadId: string, resolved: boolean) => {
      if (!supabase || !user) return

      const { error } = await (supabase as any)
        .from('note_comments')
        .update({ resolved })
        .eq('id', threadId)

      if (error) {
        console.error('[useNoteComments] Error resolving thread:', error)
      }
    },
    [user]
  )

  const getThreadsForBlock = useCallback(
    (blockId: string) => {
      return threads.filter(thread => thread.block_id === blockId)
    },
    [threads]
  )

  return {
    comments,
    threads,
    addComment,
    updateComment,
    deleteComment,
    resolveThread,
    getThreadsForBlock,
  }
}
