import type { NoteCategory } from '@/types/note';

/**
 * NoteEventBus - Event-driven architecture for note operations
 *
 * This service decouples the editor (BlockNote) from persistence (Convex).
 * The editor emits events, and a separate persistence service subscribes
 * to handle database operations.
 *
 * Benefits:
 * - Separation of concerns: Editor doesn't know about database
 * - Testability: Can test editor without database
 * - Flexibility: Easy to add debouncing, batching, offline queue
 * - Single responsibility: Each component does one thing
 */

// Event types for note operations
export type NoteEvent =
  | {
      type: 'NOTE_CONTENT_CHANGED';
      noteId: string;
      content: string;
      category?: NoteCategory;
      description?: string | null;
    }
  | {
      type: 'NOTE_CREATE_REQUESTED';
      afterNoteId: string;
      tempBlockId: string;
      category: NoteCategory;
      deadline?: string | null;
      labelIds?: string[];
      assigneeId?: string | null;
    }
  | {
      type: 'NOTE_CREATED';
      tempBlockId: string;
      noteId: string;
    }
  | {
      type: 'NOTE_DELETE_REQUESTED';
      noteId: string;
      reason: string;
    }
  | {
      type: 'NOTE_COMPLETED_TOGGLED';
      noteId: string;
      completed: boolean;
    }
  | {
      type: 'NOTE_PIN_TOGGLED';
      noteId: string;
    }
  | {
      type: 'NOTE_FIX_IN_SIDEBAR_TOGGLED';
      noteId: string;
    }
  | {
      type: 'NOTE_LABEL_ADDED';
      noteId: string;
      labelId: string;
    }
  | {
      type: 'NOTE_LABEL_CREATED_AND_ADDED';
      noteId: string;
      labelName: string;
    }
  | {
      type: 'NOTE_ASSIGNEE_ADDED';
      noteId: string;
      contactId: string;
    }
  | {
      type: 'NOTE_SELECTED';
      noteId: string;
    }
  | {
      type: 'NAVIGATE_TO_DESCRIPTION';
      noteId: string;
    }
  | {
      type: 'BLOCK_MARKED_PENDING';
      blockId: string;
    }
  | {
      type: 'FLUSH_PENDING_SAVES';
    };

type EventListener = (event: NoteEvent) => void;
type EventType = NoteEvent['type'];

class NoteEventBusImpl {
  private listeners = new Map<EventType | '*', Set<EventListener>>();

  /**
   * Emit an event to all subscribers
   */
  emit(event: NoteEvent): void {
    // Notify specific listeners
    const typeListeners = this.listeners.get(event.type);
    if (typeListeners) {
      typeListeners.forEach(listener => listener(event));
    }

    // Notify wildcard listeners (listen to all events)
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach(listener => listener(event));
    }
  }

  /**
   * Subscribe to a specific event type
   */
  on(type: EventType, listener: EventListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  /**
   * Subscribe to all events
   */
  onAll(listener: EventListener): () => void {
    if (!this.listeners.has('*')) {
      this.listeners.set('*', new Set());
    }
    this.listeners.get('*')!.add(listener);

    return () => {
      this.listeners.get('*')?.delete(listener);
    };
  }

  /**
   * Subscribe to multiple event types
   */
  onMany(types: EventType[], listener: EventListener): () => void {
    const unsubscribes = types.map(type => this.on(type, listener));
    return () => unsubscribes.forEach(unsub => unsub());
  }

  /**
   * Remove all listeners (useful for testing)
   */
  clear(): void {
    this.listeners.clear();
  }
}

// Singleton instance
export const noteEventBus = new NoteEventBusImpl();

// Debug helper - enable in development
export function enableEventBusDebug(): () => void {
  return noteEventBus.onAll((event) => {
    console.log('[NoteEventBus]', event.type, event);
  });
}
