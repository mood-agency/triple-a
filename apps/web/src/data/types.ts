import type { Note, NoteCategory, Label, NoteVersion, NoteAction } from '@/types/note';
import type { Contact } from '@/types/contact';

// Realtime event types
export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface RealtimeEvent<T = unknown> {
  type: RealtimeEventType;
  table: string;
  old: T | null;
  new: T | null;
}

// Filter types
export interface NoteFilters {
  date?: string;
  projectId?: string | null;
  completed?: boolean;
  includeDeleted?: boolean;
}

// Create/Update data types
export interface CreateNoteData {
  content: string;
  category: NoteCategory;
  date?: string;
  description?: string | null;
  deadline?: string | null;
  projectId?: string | null;
  pinned?: boolean;
  sortOrder?: number;
  afterNoteId?: string; // For positioning
}

export interface UpdateNoteData {
  content?: string;
  category?: NoteCategory;
  description?: string | null;
  deadline?: string | null;
  projectId?: string | null;
  date?: string;
}

export interface CreateLabelData {
  name: string;
  color: string;
}

export interface UpdateLabelData {
  name?: string;
  color?: string;
}

export interface CreateContactData {
  name: string;
  lastname: string;
  phone?: string;
  email?: string;
}

export interface UpdateContactData {
  name?: string;
  lastname?: string;
  phone?: string;
  email?: string;
}

// Note Repository Interface
export interface INoteRepository {
  // Queries
  getAll(filters?: NoteFilters): Promise<Note[]>;
  getById(id: string): Promise<Note | null>;
  getVersions(noteId: string): Promise<NoteVersion[]>;
  getActions(noteId: string): Promise<NoteAction[]>;

  // Commands
  create(data: CreateNoteData): Promise<Note>;
  createAfter(afterNoteId: string, data: CreateNoteData): Promise<Note>;
  update(id: string, data: UpdateNoteData): Promise<void>;
  delete(id: string, reason: string): Promise<void>;
  restore(id: string): Promise<void>;
  toggleCompleted(id: string, completed: boolean): Promise<void>;
  togglePinned(id: string, pinned: boolean): Promise<void>;
  reorder(noteIds: string[]): Promise<void>;
  postpone(id: string, newDate: string, reason?: string): Promise<void>;

  // Realtime
  subscribe(callback: (event: RealtimeEvent<Note>) => void): () => void;
}

// Label Repository Interface
export interface ILabelRepository {
  // Queries
  getAll(): Promise<Label[]>;
  getById(id: string): Promise<Label | null>;
  getLabelsForNote(noteId: string): Promise<Label[]>;
  getNoteLabelsMap(): Promise<Map<string, Label[]>>;

  // Commands
  create(data: CreateLabelData): Promise<Label>;
  update(id: string, data: UpdateLabelData): Promise<void>;
  delete(id: string): Promise<void>;
  addToNote(noteId: string, labelId: string): Promise<void>;
  removeFromNote(noteId: string, labelId: string): Promise<void>;
  createAndAddToNote(noteId: string, data: CreateLabelData): Promise<Label>;

  // Realtime
  subscribe(callback: (event: RealtimeEvent<Label>) => void): () => void;
  subscribeNoteLabels(callback: (event: RealtimeEvent) => void): () => void;
}

// Assignee (Contact) Repository Interface
export interface IAssigneeRepository {
  // Queries
  getAll(): Promise<Contact[]>;
  getById(id: string): Promise<Contact | null>;
  getAssigneesForNote(noteId: string): Promise<Contact[]>;
  getNoteAssigneesMap(): Promise<Map<string, Contact[]>>;

  // Commands
  create(data: CreateContactData): Promise<Contact>;
  update(id: string, data: UpdateContactData): Promise<void>;
  delete(id: string): Promise<void>;
  addToNote(noteId: string, contactId: string): Promise<void>;
  removeFromNote(noteId: string, contactId: string): Promise<void>;
  setNoteAssignees(noteId: string, contactIds: string[]): Promise<void>;

  // Realtime
  subscribe(callback: (event: RealtimeEvent<Contact>) => void): () => void;
  subscribeNoteAssignees(callback: (event: RealtimeEvent) => void): () => void;
}

// Repository collection type
export interface Repositories {
  notes: INoteRepository;
  labels: ILabelRepository;
  assignees: IAssigneeRepository;
}
