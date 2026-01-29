// Note types
export type {
  NoteCategory,
  SyncStatus,
  ChangelogActionType,
  Note,
  NoteHistory,
  NoteVersion,
  NoteAction,
  Label,
  NoteLabel,
  NoteAssignee,
  ExportData,
  ImportResult,
} from './note';

// API types - use wildcard export to handle const + type with same name
export * from './api';

// Contact types
export type { Contact, ContactInput } from './contact';

// Project types
export type { ProjectStatus, Project, ProjectInput } from './project';

// Sync types
export type {
  SyncOperation,
  SyncTable,
  PendingSyncOperation,
  SyncConnectionStatus,
  SyncState,
  SyncContextState,
  SyncConflict,
  ConflictResolution,
} from './sync';

// YouTube types
export type {
  YouTubeVideoMetadata,
  YouTubeCaptionTrack,
  TranscriptionResult,
  TranscriptionSegment,
  SummarizationResult,
  YouTubeImportOptions,
  YouTubeImportStatus,
  YouTubeImportState,
  YouTubeImportErrorCode,
  YouTubeImportError,
} from './youtube';

export { initialYouTubeImportState } from './youtube';

// Comment types
export type {
  NoteComment,
  NoteCommentInput,
  NoteCommentThread,
} from './comment';

// Google Calendar types
export type {
  GCalEvent,
  GCalCalendar,
  GCalConfig,
  GCalEventMapping,
  GCalSyncStatus,
  GCalConnectionStatus,
  GCalCalendarsResponse,
  GCalEventsResponse,
  GCalEventsRequest,
  GCalSyncResult,
  GCalCreateEventRequest,
  GCalCreateEventResponse,
  GCalAccount,
  GCalCalendarWithAccount,
} from './googleCalendar';
