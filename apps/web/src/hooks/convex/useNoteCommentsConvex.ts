import { useMemo, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { NoteComment, NoteCommentThread } from "@triple-a/types";

/**
 * Check if a string looks like a valid Convex ID (not a UUID)
 */
function isValidConvexId(id: string | null | undefined): boolean {
  if (!id) return false;
  if (id.includes("-")) return false;
  return /^[a-zA-Z0-9_]+$/.test(id);
}

/**
 * Convex-based note comments hook
 */
export function useNoteCommentsConvex(noteId: string) {
  const validNoteId = isValidConvexId(noteId) ? noteId : null;

  const convexComments = useQuery(
    api.noteComments.list,
    validNoteId ? { noteId: validNoteId as Id<"notes"> } : "skip"
  );

  const createMutation = useMutation(api.noteComments.create);
  const updateMutation = useMutation(api.noteComments.update);
  const removeMutation = useMutation(api.noteComments.remove);
  const resolveThreadMutation = useMutation(api.noteComments.resolveThread);

  const comments: NoteComment[] = useMemo(() => {
    if (!convexComments) return [];

    return convexComments.map((c) => ({
      id: c._id,
      user_id: c.userId,
      note_id: c.noteId,
      thread_id: c.threadId ?? null,
      content: c.content,
      block_id: c.blockId ?? null,
      resolved: c.resolved,
      created_at: c.createdAt,
      updated_at: c.updatedAt,
      deleted_at: c.deletedAt ?? null,
      remote_id: c._id,
      sync_status: "synced" as const,
      last_synced_at: c.updatedAt,
    }));
  }, [convexComments]);

  const threads: NoteCommentThread[] = useMemo(() => {
    const threadMap = new Map<string, NoteCommentThread>();

    // First pass: create threads from root comments
    for (const comment of comments) {
      if (!comment.thread_id) {
        threadMap.set(comment.id, {
          id: comment.id,
          block_id: comment.block_id,
          comments: [comment],
          resolved: comment.resolved,
        });
      }
    }

    // Second pass: add replies to threads
    for (const comment of comments) {
      if (comment.thread_id) {
        const thread = threadMap.get(comment.thread_id);
        if (thread) {
          thread.comments.push(comment);
        }
      }
    }

    // Sort comments within threads by created_at
    for (const thread of threadMap.values()) {
      thread.comments.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    return Array.from(threadMap.values());
  }, [comments]);

  const addComment = useCallback(
    async (
      content: string,
      blockId?: string | null,
      threadId?: string | null
    ) => {
      if (!validNoteId) return null;

      const commentId = await createMutation({
        noteId: validNoteId as Id<"notes">,
        content,
        blockId: blockId ?? undefined,
        threadId: isValidConvexId(threadId)
          ? (threadId as Id<"noteComments">)
          : undefined,
      });

      return commentId;
    },
    [validNoteId, createMutation]
  );

  const updateComment = useCallback(
    async (commentId: string, content: string) => {
      if (!isValidConvexId(commentId)) return;
      await updateMutation({
        commentId: commentId as Id<"noteComments">,
        content,
      });
    },
    [updateMutation]
  );

  const deleteComment = useCallback(
    async (commentId: string) => {
      if (!isValidConvexId(commentId)) return;
      await removeMutation({ commentId: commentId as Id<"noteComments"> });
    },
    [removeMutation]
  );

  const resolveThread = useCallback(
    async (threadId: string, resolved: boolean) => {
      if (!isValidConvexId(threadId)) return;
      await resolveThreadMutation({
        threadId: threadId as Id<"noteComments">,
        resolved,
      });
    },
    [resolveThreadMutation]
  );

  const getThreadsForBlock = useCallback(
    (blockId: string) => {
      return threads.filter((thread) => thread.block_id === blockId);
    },
    [threads]
  );

  return {
    comments,
    threads,
    addComment,
    updateComment,
    deleteComment,
    resolveThread,
    getThreadsForBlock,
  };
}
