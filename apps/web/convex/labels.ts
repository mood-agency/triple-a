import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const labels = await ctx.db
      .query("labels")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return labels.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const get = query({
  args: { id: v.id("labels") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const label = await ctx.db.get(args.id);
    if (!label || label.userId !== userId) return null;

    return label;
  },
});

export const getLabelsForNote = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const noteLabels = await ctx.db
      .query("noteLabels")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    const labels = await Promise.all(
      noteLabels.map((nl) => ctx.db.get(nl.labelId))
    );

    return labels.filter(
      (l): l is NonNullable<typeof l> => l !== null && !l.deletedAt
    );
  },
});

/**
 * Get labels for a public note (no auth required)
 * Only works if the note is public
 */
export const getForNote = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    // Verify the note is public
    const note = await ctx.db.get(args.noteId);
    if (!note || !note.isPublic || note.deletedAt) return [];

    const noteLabels = await ctx.db
      .query("noteLabels")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    const labels = await Promise.all(
      noteLabels.map((nl) => ctx.db.get(nl.labelId))
    );

    return labels
      .filter((l): l is NonNullable<typeof l> => l !== null && !l.deletedAt)
      .map((l) => ({ name: l.name, color: l.color }));
  },
});

/**
 * Get all labels for all notes of the current user
 * Returns a map of noteId -> labels
 * More efficient than calling getLabelsForNote for each note
 */
export const getAllNoteLabels = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return {};

    // Get all note-label associations for this user
    const allNoteLabels = await ctx.db
      .query("noteLabels")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get all labels for this user (cached)
    const allLabels = await ctx.db
      .query("labels")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const labelsMap = new Map(allLabels.map((l) => [l._id, l]));

    // Build result map: noteId -> labels[]
    const result: Record<string, typeof allLabels> = {};

    for (const nl of allNoteLabels) {
      const label = labelsMap.get(nl.labelId);
      if (label) {
        if (!result[nl.noteId]) {
          result[nl.noteId] = [];
        }
        result[nl.noteId].push(label);
      }
    }

    return result;
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    name: v.string(),
    color: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = new Date().toISOString();

    const labelId = await ctx.db.insert("labels", {
      userId,
      name: args.name,
      color: args.color,
      createdAt: now,
      updatedAt: now,
    });

    return labelId;
  },
});

export const update = mutation({
  args: {
    id: v.id("labels"),
    name: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const label = await ctx.db.get(args.id);
    if (!label || label.userId !== userId) {
      throw new Error("Label not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    if (args.name !== undefined) updates.name = args.name;
    if (args.color !== undefined) updates.color = args.color;

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("labels") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const label = await ctx.db.get(args.id);
    if (!label || label.userId !== userId) {
      throw new Error("Label not found");
    }

    // Soft delete
    await ctx.db.patch(args.id, {
      deletedAt: new Date().toISOString(),
    });

    // Remove all note-label associations
    const noteLabels = await ctx.db
      .query("noteLabels")
      .withIndex("by_label", (q) => q.eq("labelId", args.id))
      .collect();

    for (const nl of noteLabels) {
      await ctx.db.delete(nl._id);
    }
  },
});

export const addToNote = mutation({
  args: {
    noteId: v.id("notes"),
    labelId: v.id("labels"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify ownership
    const note = await ctx.db.get(args.noteId);
    const label = await ctx.db.get(args.labelId);

    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }
    if (!label || label.userId !== userId) {
      throw new Error("Label not found");
    }

    // Check if already exists
    const existing = await ctx.db
      .query("noteLabels")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .filter((q) => q.eq(q.field("labelId"), args.labelId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("noteLabels", {
      noteId: args.noteId,
      labelId: args.labelId,
      userId,
      createdAt: new Date().toISOString(),
    });
  },
});

export const removeFromNote = mutation({
  args: {
    noteId: v.id("notes"),
    labelId: v.id("labels"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const noteLabel = await ctx.db
      .query("noteLabels")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .filter((q) => q.eq(q.field("labelId"), args.labelId))
      .first();

    if (noteLabel && noteLabel.userId === userId) {
      await ctx.db.delete(noteLabel._id);
    }
  },
});

export const setLabelsForNote = mutation({
  args: {
    noteId: v.id("notes"),
    labelIds: v.array(v.id("labels")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    // Remove all existing labels
    const existingNoteLabels = await ctx.db
      .query("noteLabels")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    for (const nl of existingNoteLabels) {
      await ctx.db.delete(nl._id);
    }

    // Add new labels
    const now = new Date().toISOString();
    for (const labelId of args.labelIds) {
      await ctx.db.insert("noteLabels", {
        noteId: args.noteId,
        labelId,
        userId,
        createdAt: now,
      });
    }
  },
});
