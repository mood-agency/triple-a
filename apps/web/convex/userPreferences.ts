import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// ============================================
// QUERIES
// ============================================

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const prefs = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (!prefs) {
      // Return defaults if no preferences exist
      return {
        userId,
        showSidebar: false,
        autoSync: true,
        compactTaskView: false,
        viewMode: "list",
        autoSaveInterval: 3,
      };
    }

    return prefs;
  },
});

// ============================================
// MUTATIONS
// ============================================

export const upsert = mutation({
  args: {
    showSidebar: v.optional(v.boolean()),
    autoSync: v.optional(v.boolean()),
    compactTaskView: v.optional(v.boolean()),
    viewMode: v.optional(v.string()),
    beeperToken: v.optional(v.string()),
    fixedNoteId: v.optional(v.id("notes")),
    activeProjectId: v.optional(v.id("projects")),
    autoSaveInterval: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = new Date().toISOString();

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      // Update existing preferences
      const updates: Record<string, unknown> = { updatedAt: now };

      if (args.showSidebar !== undefined) updates.showSidebar = args.showSidebar;
      if (args.autoSync !== undefined) updates.autoSync = args.autoSync;
      if (args.compactTaskView !== undefined)
        updates.compactTaskView = args.compactTaskView;
      if (args.viewMode !== undefined) updates.viewMode = args.viewMode;
      if (args.beeperToken !== undefined)
        updates.beeperToken = args.beeperToken;
      if (args.fixedNoteId !== undefined)
        updates.fixedNoteId = args.fixedNoteId;
      if (args.activeProjectId !== undefined)
        updates.activeProjectId = args.activeProjectId;
      if (args.autoSaveInterval !== undefined)
        updates.autoSaveInterval = args.autoSaveInterval;

      await ctx.db.patch(existing._id, updates);
      return existing._id;
    } else {
      // Create new preferences
      return await ctx.db.insert("userPreferences", {
        userId,
        showSidebar: args.showSidebar ?? false,
        autoSync: args.autoSync ?? true,
        compactTaskView: args.compactTaskView ?? false,
        viewMode: args.viewMode ?? "list",
        beeperToken: args.beeperToken,
        fixedNoteId: args.fixedNoteId,
        activeProjectId: args.activeProjectId,
        autoSaveInterval: args.autoSaveInterval ?? 3,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const updateSidebar = mutation({
  args: { showSidebar: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        showSidebar: args.showSidebar,
        updatedAt: new Date().toISOString(),
      });
    } else {
      const now = new Date().toISOString();
      await ctx.db.insert("userPreferences", {
        userId,
        showSidebar: args.showSidebar,
        autoSync: true,
        compactTaskView: false,
        viewMode: "list",
        autoSaveInterval: 3,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

export const updateActiveProject = mutation({
  args: { activeProjectId: v.optional(v.id("projects")) },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userPreferences")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        activeProjectId: args.activeProjectId,
        updatedAt: new Date().toISOString(),
      });
    } else {
      const now = new Date().toISOString();
      await ctx.db.insert("userPreferences", {
        userId,
        showSidebar: false,
        autoSync: true,
        compactTaskView: false,
        viewMode: "list",
        activeProjectId: args.activeProjectId,
        autoSaveInterval: 3,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});
