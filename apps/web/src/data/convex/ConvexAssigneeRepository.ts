import type { ConvexReactClient } from 'convex/react';
import type { Contact } from '@/types/contact';
import type {
  IAssigneeRepository,
  CreateContactData,
  UpdateContactData,
  RealtimeEvent,
} from '../types';

/**
 * Convex implementation of the Assignee (Contact) Repository
 *
 * This repository uses Convex's real-time database for contact/assignee operations.
 * All methods interact with Convex queries and mutations.
 */
export class ConvexAssigneeRepository implements IAssigneeRepository {
  constructor(_convex: ConvexReactClient, _userId: string) {
    // Properties stored when Convex is implemented
  }

  // ============================================
  // QUERIES
  // ============================================

  async getAll(): Promise<Contact[]> {
    // TODO: Implement with Convex query
    // return await this.convex.query(api.contacts.getAll, { userId: this.userId });
    throw new Error('ConvexAssigneeRepository.getAll() not implemented');
  }

  async getById(_id: string): Promise<Contact | null> {
    // TODO: Implement with Convex query
    // return await this.convex.query(api.contacts.getById, { id });
    throw new Error('ConvexAssigneeRepository.getById() not implemented');
  }

  async getAssigneesForNote(_noteId: string): Promise<Contact[]> {
    // TODO: Implement with Convex query
    // return await this.convex.query(api.contacts.getAssigneesForNote, { noteId });
    throw new Error('ConvexAssigneeRepository.getAssigneesForNote() not implemented');
  }

  async getNoteAssigneesMap(): Promise<Map<string, Contact[]>> {
    // TODO: Implement with Convex query
    // const data = await this.convex.query(api.contacts.getNoteAssigneesMap, { userId: this.userId });
    // return new Map(Object.entries(data));
    throw new Error('ConvexAssigneeRepository.getNoteAssigneesMap() not implemented');
  }

  // ============================================
  // COMMANDS
  // ============================================

  async create(_data: CreateContactData): Promise<Contact> {
    // TODO: Implement with Convex mutation
    // return await this.convex.mutation(api.contacts.create, {
    //   userId: this.userId,
    //   ...data,
    // });
    throw new Error('ConvexAssigneeRepository.create() not implemented');
  }

  async update(_id: string, _data: UpdateContactData): Promise<void> {
    // TODO: Implement with Convex mutation
    // await this.convex.mutation(api.contacts.update, { id, ...data });
    throw new Error('ConvexAssigneeRepository.update() not implemented');
  }

  async delete(_id: string): Promise<void> {
    // TODO: Implement with Convex mutation
    // await this.convex.mutation(api.contacts.delete, { id });
    throw new Error('ConvexAssigneeRepository.delete() not implemented');
  }

  async addToNote(_noteId: string, _contactId: string): Promise<void> {
    // TODO: Implement with Convex mutation
    // await this.convex.mutation(api.contacts.addToNote, { noteId, contactId });
    throw new Error('ConvexAssigneeRepository.addToNote() not implemented');
  }

  async removeFromNote(_noteId: string, _contactId: string): Promise<void> {
    // TODO: Implement with Convex mutation
    // await this.convex.mutation(api.contacts.removeFromNote, { noteId, contactId });
    throw new Error('ConvexAssigneeRepository.removeFromNote() not implemented');
  }

  async setNoteAssignees(_noteId: string, _contactIds: string[]): Promise<void> {
    // TODO: Implement with Convex mutation (replace all assignees)
    // await this.convex.mutation(api.contacts.setNoteAssignees, { noteId, contactIds });
    throw new Error('ConvexAssigneeRepository.setNoteAssignees() not implemented');
  }

  // ============================================
  // REALTIME
  // ============================================

  subscribe(_callback: (event: RealtimeEvent<Contact>) => void): () => void {
    // TODO: Implement with Convex real-time subscription
    console.warn('ConvexAssigneeRepository.subscribe() not implemented - using no-op');
    return () => {};
  }

  subscribeNoteAssignees(_callback: (event: RealtimeEvent) => void): () => void {
    // TODO: Implement with Convex real-time subscription for note_assignees junction table
    console.warn('ConvexAssigneeRepository.subscribeNoteAssignees() not implemented - using no-op');
    return () => {};
  }
}
