import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Auth tables (from @convex-dev/auth)
  ...authTables,

  // ============================================
  // CORE DATA TABLES
  // ============================================

  notes: defineTable({
    userId: v.string(),
    content: v.string(),
    description: v.optional(v.string()),
    date: v.string(), // YYYY-MM-DD
    deadline: v.optional(v.string()),
    category: v.string(), // todo, event, meeting, reminder, note
    completed: v.boolean(),
    completedAt: v.optional(v.string()),
    pinned: v.boolean(),
    sortOrder: v.number(),
    projectId: v.optional(v.id("projects")),
    isPublic: v.boolean(),
    publicSlug: v.optional(v.string()),
    deletedAt: v.optional(v.string()),
    deletedReason: v.optional(v.string()),
    gcalEventId: v.optional(v.string()),
    // Timestamps
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_date", ["userId", "date"])
    .index("by_user_project", ["userId", "projectId"])
    .index("by_public_slug", ["publicSlug"])
    .index("by_user_deleted", ["userId", "deletedAt"]),

  labels: defineTable({
    userId: v.string(),
    name: v.string(),
    color: v.string(),
    deletedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),

  projects: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    status: v.string(), // active, archived, completed
    sortOrder: v.number(),
    gcalAccountId: v.optional(v.string()),
    gcalCalendarId: v.optional(v.string()),
    deletedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"]),

  contacts: defineTable({
    userId: v.string(),
    name: v.string(),
    lastname: v.optional(v.string()),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    deletedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),

  // ============================================
  // JUNCTION TABLES (Many-to-Many)
  // ============================================

  noteLabels: defineTable({
    noteId: v.id("notes"),
    labelId: v.id("labels"),
    userId: v.string(),
    createdAt: v.string(),
  })
    .index("by_note", ["noteId"])
    .index("by_label", ["labelId"])
    .index("by_user", ["userId"]),

  noteAssignees: defineTable({
    noteId: v.id("notes"),
    contactId: v.id("contacts"),
    userId: v.string(),
    createdAt: v.string(),
  })
    .index("by_note", ["noteId"])
    .index("by_contact", ["contactId"])
    .index("by_user", ["userId"]),

  // ============================================
  // HISTORY & VERSIONING
  // ============================================

  noteVersions: defineTable({
    noteId: v.id("notes"),
    userId: v.string(),
    content: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    completed: v.boolean(),
    versionNumber: v.number(),
    createdAt: v.string(),
  })
    .index("by_note", ["noteId"])
    .index("by_user", ["userId"]),

  noteActions: defineTable({
    noteId: v.id("notes"),
    userId: v.string(),
    actionType: v.string(), // postponed, completed, reopened, etc.
    newDate: v.optional(v.string()),
    previousDate: v.optional(v.string()),
    reason: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_note", ["noteId"])
    .index("by_user", ["userId"]),

  noteComments: defineTable({
    noteId: v.id("notes"),
    userId: v.string(),
    threadId: v.optional(v.id("noteComments")), // For replies
    content: v.string(),
    blockId: v.optional(v.string()), // For inline comments
    resolved: v.boolean(),
    deletedAt: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_note", ["noteId"])
    .index("by_thread", ["threadId"])
    .index("by_block", ["noteId", "blockId"]),

  // ============================================
  // USER CONFIGURATION
  // ============================================

  userPreferences: defineTable({
    userId: v.string(),
    showSidebar: v.boolean(),
    autoSync: v.boolean(),
    compactTaskView: v.boolean(),
    viewMode: v.string(), // list, kanban, calendar
    beeperToken: v.optional(v.string()),
    fixedNoteId: v.optional(v.id("notes")),
    activeProjectId: v.optional(v.id("projects")),
    autoSaveInterval: v.number(), // seconds
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),

  // ============================================
  // GOOGLE CALENDAR INTEGRATION
  // ============================================

  googleCalendarAccounts: defineTable({
    userId: v.string(),
    email: v.string(),
    displayName: v.optional(v.string()),
    accessToken: v.string(),
    refreshToken: v.string(),
    tokenExpiresAt: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),

  googleCalendarConfig: defineTable({
    userId: v.string(),
    enabled: v.boolean(),
    calendarsToSync: v.array(v.string()),
    defaultCategory: v.string(),
    lastSyncAt: v.optional(v.string()),
    syncIntervalMinutes: v.number(),
    createdAt: v.string(),
    updatedAt: v.string(),
  }).index("by_user", ["userId"]),

  googleCalendarEvents: defineTable({
    userId: v.string(),
    gcalEventId: v.string(),
    gcalCalendarId: v.string(),
    localNoteId: v.optional(v.id("notes")),
    etag: v.optional(v.string()),
    eventStatus: v.string(),
    lastSyncedAt: v.string(),
    createdAt: v.string(),
  })
    .index("by_user", ["userId"])
    .index("by_gcal_event", ["gcalEventId"])
    .index("by_note", ["localNoteId"]),

  // ============================================
  // FILE STORAGE METADATA
  // ============================================

  noteAttachments: defineTable({
    noteId: v.id("notes"),
    userId: v.string(),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileType: v.string(),
    fileSize: v.number(),
    createdAt: v.string(),
  })
    .index("by_note", ["noteId"])
    .index("by_user", ["userId"]),
});
