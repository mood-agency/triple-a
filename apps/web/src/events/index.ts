// Core
export { eventBus, EventBus } from './EventBus';

// Types
export type {
  DomainEvent,
  EventSource,
  EventMap,
  EventType,
  EventHandler,
  UnsubscribeFn,
  AppEvent,
  // Note events
  NoteCreatedEvent,
  NoteUpdatedEvent,
  NoteDeletedEvent,
  NoteCompletedEvent,
  NotePinnedEvent,
  NoteFixedInSidebarEvent,
  NoteReorderedEvent,
  // Label events
  LabelAddedToNoteEvent,
  LabelRemovedFromNoteEvent,
  LabelCreatedAndAddedEvent,
  // Assignee events
  AssigneeAddedEvent,
  AssigneeRemovedEvent,
  // Editor events
  EditorFocusLostEvent,
  EditorNavigateToDescriptionEvent,
  EditorCreateNoteAfterEvent,
  EditorSelectNoteEvent,
  EditorSaveSuccessEvent,
  // Timeline events
  TimelineCreateTaskEvent,
} from './types';

// Hooks
export {
  useEventBus,
  useEventSubscription,
  useEventSubscriptionMany,
  useEventLog,
} from './hooks/useEventBus';
