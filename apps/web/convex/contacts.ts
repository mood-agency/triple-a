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

    const contacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    return contacts.sort((a, b) => {
      const nameA = `${a.name} ${a.lastname || ""}`.toLowerCase();
      const nameB = `${b.name} ${b.lastname || ""}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  },
});

export const get = query({
  args: { id: v.id("contacts") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return null;

    const contact = await ctx.db.get(args.id);
    if (!contact || contact.userId !== userId) return null;

    return contact;
  },
});

export const getAssigneesForNote = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const noteAssignees = await ctx.db
      .query("noteAssignees")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    const contacts = await Promise.all(
      noteAssignees.map((na) => ctx.db.get(na.contactId))
    );

    return contacts.filter(
      (c): c is NonNullable<typeof c> => c !== null && !c.deletedAt
    );
  },
});

/**
 * Get assignees for a public note (no auth required)
 * Only works if the note is public
 */
export const getPublicAssigneesForNote = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    // Verify the note is public
    const note = await ctx.db.get(args.noteId);
    if (!note || !note.isPublic || note.deletedAt) return [];

    const noteAssignees = await ctx.db
      .query("noteAssignees")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    const contacts = await Promise.all(
      noteAssignees.map((na) => ctx.db.get(na.contactId))
    );

    return contacts
      .filter((c): c is NonNullable<typeof c> => c !== null && !c.deletedAt)
      .map((c) => ({ name: c.name, lastname: c.lastname }));
  },
});

/**
 * Get all assignees for all notes of the current user
 * Returns a map of noteId -> contacts
 * More efficient than calling getAssigneesForNote for each note
 */
export const getAllNoteAssignees = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return {};

    // Get all note-assignee associations for this user
    const allNoteAssignees = await ctx.db
      .query("noteAssignees")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get all contacts for this user (cached)
    const allContacts = await ctx.db
      .query("contacts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .collect();

    const contactsMap = new Map(allContacts.map((c) => [c._id, c]));

    // Build result map: noteId -> contacts[]
    const result: Record<string, typeof allContacts> = {};

    for (const na of allNoteAssignees) {
      const contact = contactsMap.get(na.contactId);
      if (contact) {
        if (!result[na.noteId]) {
          result[na.noteId] = [];
        }
        result[na.noteId].push(contact);
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
    lastname: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = new Date().toISOString();

    const contactId = await ctx.db.insert("contacts", {
      userId,
      name: args.name,
      lastname: args.lastname,
      email: args.email,
      phone: args.phone,
      createdAt: now,
      updatedAt: now,
    });

    return contactId;
  },
});

export const update = mutation({
  args: {
    id: v.id("contacts"),
    name: v.optional(v.string()),
    lastname: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const contact = await ctx.db.get(args.id);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (args.name !== undefined) updates.name = args.name;
    if (args.lastname !== undefined) updates.lastname = args.lastname;
    if (args.email !== undefined) updates.email = args.email;
    if (args.phone !== undefined) updates.phone = args.phone;

    await ctx.db.patch(args.id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("contacts") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const contact = await ctx.db.get(args.id);
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    // Soft delete
    await ctx.db.patch(args.id, {
      deletedAt: new Date().toISOString(),
    });

    // Remove all note-assignee associations
    const noteAssignees = await ctx.db
      .query("noteAssignees")
      .withIndex("by_contact", (q) => q.eq("contactId", args.id))
      .collect();

    for (const na of noteAssignees) {
      await ctx.db.delete(na._id);
    }
  },
});

export const addToNote = mutation({
  args: {
    noteId: v.id("notes"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify ownership
    const note = await ctx.db.get(args.noteId);
    const contact = await ctx.db.get(args.contactId);

    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }
    if (!contact || contact.userId !== userId) {
      throw new Error("Contact not found");
    }

    // Check if already exists
    const existing = await ctx.db
      .query("noteAssignees")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .filter((q) => q.eq(q.field("contactId"), args.contactId))
      .first();

    if (existing) return existing._id;

    return await ctx.db.insert("noteAssignees", {
      noteId: args.noteId,
      contactId: args.contactId,
      userId,
      createdAt: new Date().toISOString(),
    });
  },
});

export const removeFromNote = mutation({
  args: {
    noteId: v.id("notes"),
    contactId: v.id("contacts"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const noteAssignee = await ctx.db
      .query("noteAssignees")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .filter((q) => q.eq(q.field("contactId"), args.contactId))
      .first();

    if (noteAssignee && noteAssignee.userId === userId) {
      await ctx.db.delete(noteAssignee._id);
    }
  },
});

export const setAssigneesForNote = mutation({
  args: {
    noteId: v.id("notes"),
    contactIds: v.array(v.id("contacts")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    // Remove all existing assignees
    const existingAssignees = await ctx.db
      .query("noteAssignees")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    for (const na of existingAssignees) {
      await ctx.db.delete(na._id);
    }

    // Add new assignees
    const now = new Date().toISOString();
    for (const contactId of args.contactIds) {
      await ctx.db.insert("noteAssignees", {
        noteId: args.noteId,
        contactId,
        userId,
        createdAt: now,
      });
    }
  },
});
