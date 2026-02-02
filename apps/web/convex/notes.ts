import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// ============================================
// QUERIES
// ============================================

export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    date: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    let notes;

    if (args.projectId) {
      notes = await ctx.db
        .query("notes")
        .withIndex("by_user_project", (q) =>
          q.eq("userId", userId).eq("projectId", args.projectId)
        )
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    } else if (args.date) {
      notes = await ctx.db
        .query("notes")
        .withIndex("by_user_date", (q) =>
          q.eq("userId", userId).eq("date", args.date)
        )
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    } else {
      notes = await ctx.db
        .query("notes")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .filter((q) => q.eq(q.field("deletedAt"), undefined))
        .collect();
    }

    // Sort by pinned (desc) then sortOrder (asc)
    return notes.sort((a, b) => {
      if (a.pinned !== b.pinned) return b.pinned ? 1 : -1;
      return a.sortOrder - b.sortOrder;
    });
  },
});

export const get = query({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) return null;

    return note;
  },
});

export const getPublic = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const note = await ctx.db
      .query("notes")
      .withIndex("by_public_slug", (q) => q.eq("publicSlug", args.slug))
      .filter((q) =>
        q.and(
          q.eq(q.field("isPublic"), true),
          q.eq(q.field("deletedAt"), undefined)
        )
      )
      .first();

    return note;
  },
});

// ============================================
// MUTATIONS
// ============================================

export const create = mutation({
  args: {
    content: v.string(),
    category: v.optional(v.string()),
    description: v.optional(v.string()),
    date: v.optional(v.string()),
    deadline: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
    labelIds: v.optional(v.array(v.id("labels"))),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = new Date().toISOString();
    const today = now.split("T")[0];

    // Get max sort order for this project/date
    const existingNotes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    const maxSortOrder = existingNotes.reduce(
      (max, n) => Math.max(max, n.sortOrder),
      0
    );

    const noteId = await ctx.db.insert("notes", {
      userId,
      content: args.content,
      description: args.description,
      category: args.category ?? "todo",
      date: args.date ?? today,
      deadline: args.deadline,
      projectId: args.projectId,
      completed: false,
      pinned: false,
      sortOrder: maxSortOrder + 1,
      isPublic: false,
      createdAt: now,
      updatedAt: now,
    });

    // Add labels if provided
    if (args.labelIds && args.labelIds.length > 0) {
      for (const labelId of args.labelIds) {
        await ctx.db.insert("noteLabels", {
          noteId,
          labelId,
          userId,
          createdAt: now,
        });
      }
    }

    // Create initial version
    await ctx.db.insert("noteVersions", {
      noteId,
      userId,
      content: args.content,
      description: args.description,
      category: args.category ?? "todo",
      completed: false,
      versionNumber: 1,
      createdAt: now,
    });

    return noteId;
  },
});

export const update = mutation({
  args: {
    id: v.id("notes"),
    content: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    deadline: v.optional(v.string()),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = { updatedAt: now };

    if (args.content !== undefined) updates.content = args.content;
    if (args.description !== undefined) updates.description = args.description;
    if (args.category !== undefined) updates.category = args.category;
    if (args.deadline !== undefined) updates.deadline = args.deadline;
    if (args.projectId !== undefined) updates.projectId = args.projectId;

    await ctx.db.patch(args.id, updates);

    // Create version if content/description changed
    if (args.content !== undefined || args.description !== undefined) {
      const versions = await ctx.db
        .query("noteVersions")
        .withIndex("by_note", (q) => q.eq("noteId", args.id))
        .collect();

      const lastVersion = versions.sort(
        (a, b) => b.versionNumber - a.versionNumber
      )[0];
      const lastVersionTime = lastVersion
        ? new Date(lastVersion.createdAt).getTime()
        : 0;
      const timeSinceLastVersion = (Date.now() - lastVersionTime) / 1000;

      // Throttle: only create version if > 30 seconds since last
      if (timeSinceLastVersion > 30) {
        await ctx.db.insert("noteVersions", {
          noteId: args.id,
          userId,
          content: args.content ?? note.content,
          description: args.description ?? note.description,
          category: args.category ?? note.category,
          completed: note.completed,
          versionNumber: (lastVersion?.versionNumber ?? 0) + 1,
          createdAt: now,
        });
      }
    }
  },
});

export const toggleComplete = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    const now = new Date().toISOString();
    const newCompleted = !note.completed;

    await ctx.db.patch(args.id, {
      completed: newCompleted,
      completedAt: newCompleted ? now : undefined,
      updatedAt: now,
    });

    // Record action
    await ctx.db.insert("noteActions", {
      noteId: args.id,
      userId,
      actionType: newCompleted ? "completed" : "reopened",
      createdAt: now,
    });
  },
});

export const togglePin = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    await ctx.db.patch(args.id, {
      pinned: !note.pinned,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const postpone = mutation({
  args: {
    id: v.id("notes"),
    newDeadline: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    const now = new Date().toISOString();
    const previousDeadline = note.deadline;

    await ctx.db.patch(args.id, {
      deadline: args.newDeadline,
      updatedAt: now,
    });

    // Record action
    await ctx.db.insert("noteActions", {
      noteId: args.id,
      userId,
      actionType: "postponed",
      previousDate: previousDeadline,
      newDate: args.newDeadline,
      reason: args.reason,
      createdAt: now,
    });
  },
});

export const softDelete = mutation({
  args: {
    id: v.id("notes"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    await ctx.db.patch(args.id, {
      deletedAt: new Date().toISOString(),
      deletedReason: args.reason,
    });
  },
});

export const restore = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    await ctx.db.patch(args.id, {
      deletedAt: undefined,
      deletedReason: undefined,
      updatedAt: new Date().toISOString(),
    });
  },
});

export const updateSortOrder = mutation({
  args: {
    updates: v.array(
      v.object({
        id: v.id("notes"),
        sortOrder: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    for (const update of args.updates) {
      const note = await ctx.db.get(update.id);
      if (note && note.userId === userId) {
        await ctx.db.patch(update.id, {
          sortOrder: update.sortOrder,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  },
});

// ============================================
// IMPORT FROM SUPABASE (Migration helper)
// ============================================

export const importFromSupabase = mutation({
  args: {
    supabaseId: v.string(),
    userId: v.string(),
    content: v.string(),
    description: v.optional(v.string()),
    date: v.string(),
    deadline: v.optional(v.string()),
    category: v.string(),
    completed: v.boolean(),
    completedAt: v.optional(v.string()),
    pinned: v.boolean(),
    sortOrder: v.number(),
    isPublic: v.boolean(),
    publicSlug: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    // This mutation is for data migration only
    // It bypasses normal auth checks

    const noteId = await ctx.db.insert("notes", {
      userId: args.userId,
      content: args.content,
      description: args.description,
      date: args.date,
      deadline: args.deadline,
      category: args.category,
      completed: args.completed,
      completedAt: args.completedAt,
      pinned: args.pinned,
      sortOrder: args.sortOrder,
      isPublic: args.isPublic,
      publicSlug: args.publicSlug,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
    });

    return { noteId, supabaseId: args.supabaseId };
  },
});

// ============================================
// ADDITIONAL QUERIES
// ============================================

export const listDeleted = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.neq(q.field("deletedAt"), undefined))
      .collect();

    // Sort by deletedAt descending
    return notes.sort((a, b) => {
      const dateA = a.deletedAt ? new Date(a.deletedAt).getTime() : 0;
      const dateB = b.deletedAt ? new Date(b.deletedAt).getTime() : 0;
      return dateB - dateA;
    });
  },
});

export const getVersions = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const versions = await ctx.db
      .query("noteVersions")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    return versions.sort((a, b) => b.versionNumber - a.versionNumber);
  },
});

export const getActions = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const actions = await ctx.db
      .query("noteActions")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    return actions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },
});

export const listAllForAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return { notes: [], actions: [] };

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const actions = await ctx.db
      .query("noteActions")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return { notes, actions };
  },
});

// ============================================
// ADDITIONAL MUTATIONS
// ============================================

export const deleteAction = mutation({
  args: { actionId: v.id("noteActions") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const action = await ctx.db.get(args.actionId);
    if (!action || action.userId !== userId) {
      throw new Error("Action not found");
    }

    await ctx.db.delete(args.actionId);
  },
});

export const updateActionReason = mutation({
  args: {
    actionId: v.id("noteActions"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const action = await ctx.db.get(args.actionId);
    if (!action || action.userId !== userId) {
      throw new Error("Action not found");
    }

    await ctx.db.patch(args.actionId, { reason: args.reason });
  },
});

export const togglePublic = mutation({
  args: {
    id: v.id("notes"),
    makePublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    if (args.makePublic) {
      const slug = Math.random().toString(36).substring(2, 14);
      await ctx.db.patch(args.id, {
        isPublic: true,
        publicSlug: slug,
        updatedAt: new Date().toISOString(),
      });
      return slug;
    } else {
      await ctx.db.patch(args.id, {
        isPublic: false,
        publicSlug: undefined,
        updatedAt: new Date().toISOString(),
      });
      return null;
    }
  },
});

export const permanentDelete = mutation({
  args: { id: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.id);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    // Delete related data
    const versions = await ctx.db
      .query("noteVersions")
      .withIndex("by_note", (q) => q.eq("noteId", args.id))
      .collect();
    for (const version of versions) {
      await ctx.db.delete(version._id);
    }

    const actions = await ctx.db
      .query("noteActions")
      .withIndex("by_note", (q) => q.eq("noteId", args.id))
      .collect();
    for (const action of actions) {
      await ctx.db.delete(action._id);
    }

    const labels = await ctx.db
      .query("noteLabels")
      .withIndex("by_note", (q) => q.eq("noteId", args.id))
      .collect();
    for (const label of labels) {
      await ctx.db.delete(label._id);
    }

    const comments = await ctx.db
      .query("noteComments")
      .withIndex("by_note", (q) => q.eq("noteId", args.id))
      .collect();
    for (const comment of comments) {
      await ctx.db.delete(comment._id);
    }

    const assignees = await ctx.db
      .query("noteAssignees")
      .withIndex("by_note", (q) => q.eq("noteId", args.id))
      .collect();
    for (const assignee of assignees) {
      await ctx.db.delete(assignee._id);
    }

    // Delete the note
    await ctx.db.delete(args.id);
  },
});

export const permanentDeleteAll = mutation({
  args: { ids: v.array(v.id("notes")) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    for (const id of args.ids) {
      const note = await ctx.db.get(id);
      if (!note || note.userId !== userId) continue;

      // Delete related data
      const versions = await ctx.db
        .query("noteVersions")
        .withIndex("by_note", (q) => q.eq("noteId", id))
        .collect();
      for (const version of versions) {
        await ctx.db.delete(version._id);
      }

      const actions = await ctx.db
        .query("noteActions")
        .withIndex("by_note", (q) => q.eq("noteId", id))
        .collect();
      for (const action of actions) {
        await ctx.db.delete(action._id);
      }

      const labels = await ctx.db
        .query("noteLabels")
        .withIndex("by_note", (q) => q.eq("noteId", id))
        .collect();
      for (const label of labels) {
        await ctx.db.delete(label._id);
      }

      const comments = await ctx.db
        .query("noteComments")
        .withIndex("by_note", (q) => q.eq("noteId", id))
        .collect();
      for (const comment of comments) {
        await ctx.db.delete(comment._id);
      }

      const assignees = await ctx.db
        .query("noteAssignees")
        .withIndex("by_note", (q) => q.eq("noteId", id))
        .collect();
      for (const assignee of assignees) {
        await ctx.db.delete(assignee._id);
      }

      // Delete the note
      await ctx.db.delete(id);
    }
  },
});
