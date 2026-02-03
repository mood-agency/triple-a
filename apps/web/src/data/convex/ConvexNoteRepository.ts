import type { ConvexReactClient } from 'convex/react';
import type { Note, NoteVersion, NoteAction } from '@/types/note';
import type {
  INoteRepository,
  NoteFilters,
  CreateNoteData,
  UpdateNoteData,
  RealtimeEvent,
} from '../types';

/**
 * Convex implementation of the Note Repository
 *
 * This repository uses Convex's real-time database for note operations.
 * All methods interact with Convex queries and mutations.
 */
export class ConvexNoteRepository implements INoteRepository {
  private convex: ConvexReactClient;
  private userId: string;
  private projectId: string | null;
  private date: string;

  constructor(
    convex: ConvexReactClient,
    userId: string,
    projectId: string | null = null,
    date: string
  ) {
    this.convex = convex;
    this.userId = userId;
    this.projectId = projectId;
    this.date = date;
  }

  // ============================================
  // QUERIES
  // ============================================

  async getAll(_filters?: NoteFilters): Promise<Note[]> {
    // TODO: Implement with Convex query
    // return await this.convex.query(api.notes.getAll, {
    //   userId: this.userId,
    //   projectId: this.projectId,
    //   date: filters?.date ?? this.date,
    //   completed: filters?.completed,
    //   includeDeleted: filters?.includeDeleted,
    // });
    throw new Error('ConvexNoteRepository.getAll() not implemented');
  }

  async getById(_id: string): Promise<Note | null> {
    // TODO: Implement with Convex query
    // return await this.convex.query(api.notes.getById, { id });
    throw new Error('ConvexNoteRepository.getById() not implemented');
  }

  async getVersions(_noteId: string): Promise<NoteVersion[]> {
    // TODO: Implement with Convex query
    // return await this.convex.query(api.notes.getVersions, { noteId });
    throw new Error('ConvexNoteRepository.getVersions() not implemented');
  }

  async getActions(_noteId: string): Promise<NoteAction[]> {
    // TODO: Implement with Convex query
    // return await this.convex.query(api.notes.getActions, { noteId });
    throw new Error('ConvexNoteRepository.getActions() not implemented');
  }

  // ============================================
  // COMMANDS
  // ============================================

  async create(_data: CreateNoteData): Promise<Note> {
    // TODO: Implement with Convex mutation
    // return await this.convex.mutation(api.notes.create, {
    //   userId: this.userId,
    //   projectId: this.projectId,
    //   date: this.date,
    //   ...data,
    // });
    throw new Error('ConvexNoteRepository.create() not implemented');
  }

  async createAfter(_afterNoteId: string, _data: CreateNoteData): Promise<Note> {
    // TODO: Implement with Convex mutation
    // return await this.convex.mutation(api.notes.createAfter, {
    //   userId: this.userId,
    //   afterNoteId,
    //   ...data,
    // });
    throw new Error('ConvexNoteRepository.createAfter() not implemented');
  }

  async update(_id: string, _data: UpdateNoteData): Promise<void> {
    // TODO: Implement with Convex mutation
    // await this.convex.mutation(api.notes.update, { id, ...data });
    throw new Error('ConvexNoteRepository.update() not implemented');
  }

  async delete(_id: string, _reason: string): Promise<void> {
    // TODO: Implement with Convex mutation (soft delete)
    // await this.convex.mutation(api.notes.softDelete, { id, reason });
    throw new Error('ConvexNoteRepository.delete() not implemented');
  }

  async restore(_id: string): Promise<void> {
    // TODO: Implement with Convex mutation
    // await this.convex.mutation(api.notes.restore, { id });
    throw new Error('ConvexNoteRepository.restore() not implemented');
  }

  async toggleCompleted(_id: string, _completed: boolean): Promise<void> {
    // TODO: Implement with Convex mutation
    // await this.convex.mutation(api.notes.toggleCompleted, { id, completed });
    throw new Error('ConvexNoteRepository.toggleCompleted() not implemented');
  }

  async togglePinned(_id: string, _pinned: boolean): Promise<void> {
    // TODO: Implement with Convex mutation
    // await this.convex.mutation(api.notes.togglePinned, { id, pinned });
    throw new Error('ConvexNoteRepository.togglePinned() not implemented');
  }

  async reorder(_noteIds: string[]): Promise<void> {
    // TODO: Implement with Convex mutation
    // await this.convex.mutation(api.notes.reorder, { noteIds });
    throw new Error('ConvexNoteRepository.reorder() not implemented');
  }

  async postpone(_id: string, _newDate: string, _reason?: string): Promise<void> {
    // TODO: Implement with Convex mutation
    // await this.convex.mutation(api.notes.postpone, { id, newDate, reason });
    throw new Error('ConvexNoteRepository.postpone() not implemented');
  }

  // ============================================
  // REALTIME
  // ============================================

  subscribe(_callback: (event: RealtimeEvent<Note>) => void): () => void {
    // TODO: Implement with Convex real-time subscription
    // Convex provides automatic real-time updates through useQuery hooks
    // For imperative subscriptions, you might need a different approach
    //
    // Example with Convex's watch API:
    // const unsubscribe = this.convex.watchQuery(
    //   api.notes.getAll,
    //   { userId: this.userId, projectId: this.projectId, date: this.date },
    //   {
    //     onUpdate: (notes) => {
    //       // Diff with previous state to determine INSERT/UPDATE/DELETE
    //       callback({ type: 'UPDATE', table: 'notes', old: null, new: note });
    //     },
    //   }
    // );
    // return unsubscribe;

    console.warn('ConvexNoteRepository.subscribe() not implemented - using no-op');
    return () => {}; // No-op unsubscribe
  }
}
