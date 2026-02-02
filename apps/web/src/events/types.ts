import type { NoteCategory } from '@/types/note';

// Base event interface
export interface DomainEvent<T = unknown> {
  readonly type: string;
  readonly payload: T;
  readonly timestamp: number;
  readonly source: EventSource;
  readonly correlationId: string;
}

export type EventSource = 'ui' | 'realtime' | 'command';

// Note Events
export interface NoteCreatedEvent
  extends DomainEvent<{
    noteId: string;
    content: string;
    category: NoteCategory;
    projectId: string | null;
  }> {
  type: 'note:created';
}

export interface NoteUpdatedEvent
  extends DomainEvent<{
    noteId: string;
    content?: string;
    category?: NoteCategory;
    description?: string | null;
  }> {
  type: 'note:updated';
}

export interface NoteDeletedEvent
  extends DomainEvent<{
    noteId: string;
    reason: string;
  }> {
  type: 'note:deleted';
}

export interface NoteCompletedEvent
  extends DomainEvent<{
    noteId: string;
    completed: boolean;
    completedAt: string | null;
  }> {
  type: 'note:completed';
}

export interface NotePinnedEvent
  extends DomainEvent<{
    noteId: string;
    pinned: boolean;
  }> {
  type: 'note:pinned';
}

export interface NoteFixedInSidebarEvent
  extends DomainEvent<{
    noteId: string;
    fixedInSidebar: boolean;
  }> {
  type: 'note:fixedInSidebar';
}

export interface NoteReorderedEvent
  extends DomainEvent<{
    noteIds: string[];
  }> {
  type: 'note:reordered';
}

// Label Events
export interface LabelAddedToNoteEvent
  extends DomainEvent<{
    noteId: string;
    labelId: string;
    labelName: string;
    labelColor: string;
  }> {
  type: 'label:addedToNote';
}

export interface LabelRemovedFromNoteEvent
  extends DomainEvent<{
    noteId: string;
    labelId: string;
  }> {
  type: 'label:removedFromNote';
}

export interface LabelCreatedAndAddedEvent
  extends DomainEvent<{
    noteId: string;
    labelName: string;
  }> {
  type: 'label:createdAndAdded';
}

// Assignee Events
export interface AssigneeAddedEvent
  extends DomainEvent<{
    noteId: string;
    contactId: string;
  }> {
  type: 'assignee:added';
}

export interface AssigneeRemovedEvent
  extends DomainEvent<{
    noteId: string;
    contactId: string;
  }> {
  type: 'assignee:removed';
}

// Editor/UI Events (replacing notepad:* CustomEvents)
export interface EditorFocusLostEvent
  extends DomainEvent<{
    noteId: string;
  }> {
  type: 'editor:focusLost';
}

export interface EditorNavigateToDescriptionEvent
  extends DomainEvent<{
    noteId: string;
  }> {
  type: 'editor:navigateToDescription';
}

export interface EditorCreateNoteAfterEvent
  extends DomainEvent<{
    afterNoteId: string;
    newNoteId?: string;
    category?: NoteCategory;
    content?: string;
  }> {
  type: 'editor:createNoteAfter';
}

export interface EditorSelectNoteEvent
  extends DomainEvent<{
    noteId: string;
  }> {
  type: 'editor:selectNote';
}

export interface EditorSaveSuccessEvent
  extends DomainEvent<{
    savedCount: number;
  }> {
  type: 'editor:saveSuccess';
}

// Timeline Events (replacing hourDivider:* CustomEvents)
export interface TimelineCreateTaskEvent
  extends DomainEvent<{
    hour: number;
    date: string;
  }> {
  type: 'timeline:createTask';
}

// Union type for all events
export type AppEvent =
  | NoteCreatedEvent
  | NoteUpdatedEvent
  | NoteDeletedEvent
  | NoteCompletedEvent
  | NotePinnedEvent
  | NoteFixedInSidebarEvent
  | NoteReorderedEvent
  | LabelAddedToNoteEvent
  | LabelRemovedFromNoteEvent
  | LabelCreatedAndAddedEvent
  | AssigneeAddedEvent
  | AssigneeRemovedEvent
  | EditorFocusLostEvent
  | EditorNavigateToDescriptionEvent
  | EditorCreateNoteAfterEvent
  | EditorSelectNoteEvent
  | EditorSaveSuccessEvent
  | TimelineCreateTaskEvent;

// Type-safe event map for subscribe/publish
export type EventMap = {
  'note:created': NoteCreatedEvent;
  'note:updated': NoteUpdatedEvent;
  'note:deleted': NoteDeletedEvent;
  'note:completed': NoteCompletedEvent;
  'note:pinned': NotePinnedEvent;
  'note:fixedInSidebar': NoteFixedInSidebarEvent;
  'note:reordered': NoteReorderedEvent;
  'label:addedToNote': LabelAddedToNoteEvent;
  'label:removedFromNote': LabelRemovedFromNoteEvent;
  'label:createdAndAdded': LabelCreatedAndAddedEvent;
  'assignee:added': AssigneeAddedEvent;
  'assignee:removed': AssigneeRemovedEvent;
  'editor:focusLost': EditorFocusLostEvent;
  'editor:navigateToDescription': EditorNavigateToDescriptionEvent;
  'editor:createNoteAfter': EditorCreateNoteAfterEvent;
  'editor:selectNote': EditorSelectNoteEvent;
  'editor:saveSuccess': EditorSaveSuccessEvent;
  'timeline:createTask': TimelineCreateTaskEvent;
};

export type EventType = keyof EventMap;

// Handler type
export type EventHandler<E extends DomainEvent> = (event: E) => void | Promise<void>;

// Unsubscribe function type
export type UnsubscribeFn = () => void;
