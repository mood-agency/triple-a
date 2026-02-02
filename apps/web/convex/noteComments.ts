import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const comments = await ctx.db
      .query("noteComments")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return comments.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    noteId: v.id("notes"),
    content: v.string(),
    blockId: v.optional(v.string()),
    threadId: v.optional(v.id("noteComments")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    const now = new Date().toISOString();

    const commentId = await ctx.db.insert("noteComments", {
      noteId: args.noteId,
      userId,
      content: args.content,
      blockId: args.blockId,
      threadId: args.threadId,
      resolved: false,
      createdAt: now,
      updatedAt: now,
    });

    return commentId;
  },
});

export const update = mutation({
  args: {
    commentId: v.id("noteComments"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.userId !== userId) {
      throw new Error("Comment not found");
    }

    await ctx.db.patch(args.commentId, {
      content: args.content,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const remove = mutation({
  args: { commentId: v.id("noteComments") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.commentId);
    if (!comment || comment.userId !== userId) {
      throw new Error("Comment not found");
    }

    await ctx.db.patch(args.commentId, {
      deletedAt: new Date().toISOString(),
    });
  },
});

export const resolveThread = mutation({
  args: {
    threadId: v.id("noteComments"),
    resolved: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const comment = await ctx.db.get(args.threadId);
    if (!comment || comment.userId !== userId) {
      throw new Error("Comment not found");
    }

    await ctx.db.patch(args.threadId, {
      resolved: args.resolved,
      updatedAt: new Date().toISOString(),
    });
  },
});
