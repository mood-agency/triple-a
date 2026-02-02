import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { auth } from "./auth";

// ============================================
// FILE STORAGE
// ============================================

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.storage.generateUploadUrl();
  },
});

export const getFileUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

export const saveAttachment = mutation({
  args: {
    noteId: v.id("notes"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify note ownership
    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found");
    }

    // Validate file type
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(args.fileType)) {
      throw new Error("File type not allowed");
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (args.fileSize > maxSize) {
      throw new Error("File too large (max 10MB)");
    }

    const attachmentId = await ctx.db.insert("noteAttachments", {
      noteId: args.noteId,
      userId,
      storageId: args.storageId,
      fileName: args.fileName,
      fileType: args.fileType,
      fileSize: args.fileSize,
      createdAt: new Date().toISOString(),
    });

    return attachmentId;
  },
});

export const getAttachments = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const attachments = await ctx.db
      .query("noteAttachments")
      .withIndex("by_note", (q) => q.eq("noteId", args.noteId))
      .collect();

    // Get URLs for all attachments
    const withUrls = await Promise.all(
      attachments.map(async (att) => ({
        ...att,
        url: await ctx.storage.getUrl(att.storageId),
      }))
    );

    return withUrls;
  },
});

export const deleteAttachment = mutation({
  args: { id: v.id("noteAttachments") },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const attachment = await ctx.db.get(args.id);
    if (!attachment || attachment.userId !== userId) {
      throw new Error("Attachment not found");
    }

    // Delete from storage
    await ctx.storage.delete(attachment.storageId);

    // Delete metadata
    await ctx.db.delete(args.id);
  },
});

// ============================================
// HELPER QUERIES
// ============================================

export const isImageFile = query({
  args: { fileType: v.string() },
  handler: async (_ctx, args) => {
    return args.fileType.startsWith("image/");
  },
});

export const getFileTypeLabel = query({
  args: { fileType: v.string() },
  handler: async (_ctx, args) => {
    const labels: Record<string, string> = {
      "image/png": "PNG Image",
      "image/jpeg": "JPEG Image",
      "image/gif": "GIF Image",
      "image/webp": "WebP Image",
      "application/pdf": "PDF Document",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "Word Document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "Excel Spreadsheet",
    };

    return labels[args.fileType] || "File";
  },
});
