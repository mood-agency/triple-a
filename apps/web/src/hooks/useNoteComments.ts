import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { NoteComment, NoteCommentThread } from '@triple-a/types'

export function useNoteComments(noteId: string) {
  const { user } = useAuth()
  const userId = user?.id
  const [comments, setComments] = useState<NoteComment[]>([])
  const [threads, setThreads] = useState<NoteCommentThread[]>([])
  // Ref to always hold the latest loadComments — avoids re-subscribing realtime on fetch changes
  const loadCommentsRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // Load comments for this note
  const loadComments = useCallback(async () => {
    if (!supabase || !userId || !noteId) {
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
  }, [userId, noteId])

  // Keep ref in sync so realtime handlers always call the latest version
  loadCommentsRef.current = loadComments

  // Load on mount and when noteId changes
  useEffect(() => {
    loadComments()
  }, [loadComments])

  // Realtime subscription
  // Uses loadCommentsRef so subscription doesn't need to be torn down on fetch fn change
  useEffect(() => {
    if (!supabase || !userId || !noteId) return

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
          loadCommentsRef.current()
        }
      )
      .subscribe()

    return () => {
      if (supabase) {
        supabase.removeChannel(channel)
      }
    }
  }, [userId, noteId])

  const addComment = useCallback(
    async (content: string, blockId?: string | null, threadId?: string | null) => {
      if (!supabase || !userId) return null

      const { data, error } = await (supabase as any)
        .from('note_comments')
        .insert({
          user_id: userId,
          note_id: noteId,
          thread_id: threadId || null,
          content,
          block_id: blockId || null,
          resolved: false,
          sync_status: 'synced',
        })
        .select()
        .single()

      if (error) {
        console.error('[useNoteComments] Error adding comment:', error)
        return null
      }

      // Optimistic update: add the new comment to local state immediately
      if (data) {
        const newComment: NoteComment = {
          id: data.id,
          user_id: data.user_id,
          note_id: data.note_id,
          thread_id: data.thread_id,
          content: data.content,
          block_id: data.block_id,
          resolved: data.resolved,
          created_at: data.created_at,
          updated_at: data.updated_at,
          deleted_at: data.deleted_at,
          remote_id: data.remote_id,
          sync_status: data.sync_status,
          last_synced_at: data.last_synced_at,
        }

        setComments(prev => [...prev, newComment])

        // Update threads
        setThreads(prev => {
          if (threadId) {
            // Reply: add to existing thread
            return prev.map(t =>
              t.id === threadId
                ? { ...t, comments: [...t.comments, newComment] }
                : t
            )
          }
          // New root comment: create a new thread
          return [...prev, {
            id: newComment.id,
            block_id: newComment.block_id,
            comments: [newComment],
            resolved: false,
          }]
        })
      }

      return data?.id || null
    },
    [userId, noteId]
  )

  const updateComment = useCallback(
    async (commentId: string, content: string) => {
      if (!supabase || !userId) return

      // Optimistic: update local state immediately
      const updateContent = (c: NoteComment) =>
        c.id === commentId ? { ...c, content } : c
      setComments(prev => prev.map(updateContent))
      setThreads(prev => prev.map(t => ({
        ...t,
        comments: t.comments.map(updateContent),
      })))

      const { error } = await (supabase as any)
        .from('note_comments')
        .update({ content })
        .eq('id', commentId)

      if (error) {
        console.error('[useNoteComments] Error updating comment:', error)
        await loadCommentsRef.current()
      }
    },
    [userId]
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!supabase || !userId) return

      // Optimistic: remove from local state immediately
      setComments(prev => prev.filter(c => c.id !== commentId))
      setThreads(prev => {
        // If the deleted comment is a root comment (thread), remove entire thread
        const isRoot = prev.some(t => t.id === commentId)
        if (isRoot) return prev.filter(t => t.id !== commentId)
        // Otherwise remove reply from its thread
        return prev.map(t => ({
          ...t,
          comments: t.comments.filter(c => c.id !== commentId),
        }))
      })

      const { error } = await (supabase as any)
        .from('note_comments')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', commentId)

      if (error) {
        console.error('[useNoteComments] Error deleting comment:', error)
        await loadCommentsRef.current()
      }
    },
    [userId]
  )

  const resolveThread = useCallback(
    async (threadId: string, resolved: boolean) => {
      if (!supabase || !userId) return

      // Optimistic: update local state immediately
      setThreads(prev => prev.map(t =>
        t.id === threadId ? { ...t, resolved } : t
      ))

      const { error } = await (supabase as any)
        .from('note_comments')
        .update({ resolved })
        .eq('id', threadId)

      if (error) {
        console.error('[useNoteComments] Error resolving thread:', error)
        await loadCommentsRef.current()
      }
    },
    [userId]
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
