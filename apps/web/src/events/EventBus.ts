import type {
  DomainEvent,
  EventMap,
  EventType,
  EventHandler,
  EventSource,
  UnsubscribeFn,
} from './types';

const MAX_LOG_SIZE = 1000;

class EventBus {
  private handlers: Map<string, Set<EventHandler<DomainEvent>>> = new Map();
  private eventLog: DomainEvent[] = [];

  /**
   * Subscribe to an event type with a handler
   * @returns Unsubscribe function
   */
  subscribe<K extends EventType>(
    eventType: K,
    handler: EventHandler<EventMap[K]>
  ): UnsubscribeFn {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as EventHandler<DomainEvent>);

    return () => {
      this.handlers.get(eventType)?.delete(handler as EventHandler<DomainEvent>);
    };
  }

  /**
   * Subscribe to multiple event types with a single handler
   * @returns Unsubscribe function that removes all subscriptions
   */
  subscribeMany<K extends EventType>(
    eventTypes: K[],
    handler: EventHandler<EventMap[K]>
  ): UnsubscribeFn {
    const unsubscribes = eventTypes.map((type) => this.subscribe(type, handler));
    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }

  /**
   * Publish an event to all subscribers
   */
  publish<E extends DomainEvent>(event: E): void {
    // Add to event log for debugging
    this.eventLog.push(event);
    if (this.eventLog.length > MAX_LOG_SIZE) {
      this.eventLog.shift();
    }

    // Log in development
    if (import.meta.env.DEV) {
      console.debug(`[EventBus] ${event.type}`, event.payload);
    }

    // Dispatch to handlers
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      typeHandlers.forEach((handler) => {
        try {
          const result = handler(event);
          // Handle async handlers - log errors but don't block
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error(`[EventBus] Async error handling ${event.type}:`, error);
            });
          }
        } catch (error) {
          console.error(`[EventBus] Error handling ${event.type}:`, error);
        }
      });
    }
  }

  /**
   * Create and publish an event in one call
   */
  emit<K extends EventType>(
    type: K,
    payload: EventMap[K]['payload'],
    source: EventSource = 'ui'
  ): EventMap[K] {
    const event = this.createEvent(type, payload, source);
    this.publish(event);
    return event;
  }

  /**
   * Create an event with timestamp and correlation ID
   */
  createEvent<K extends EventType>(
    type: K,
    payload: EventMap[K]['payload'],
    source: EventSource
  ): EventMap[K] {
    return {
      type,
      payload,
      timestamp: Date.now(),
      source,
      correlationId: crypto.randomUUID(),
    } as EventMap[K];
  }

  /**
   * Get recent events for debugging
   */
  getEventLog(): readonly DomainEvent[] {
    return this.eventLog;
  }

  /**
   * Get events filtered by type
   */
  getEventsByType<K extends EventType>(type: K): EventMap[K][] {
    return this.eventLog.filter((e) => e.type === type) as EventMap[K][];
  }

  /**
   * Get events filtered by correlation ID (for tracing related events)
   */
  getEventsByCorrelationId(correlationId: string): DomainEvent[] {
    return this.eventLog.filter((e) => e.correlationId === correlationId);
  }

  /**
   * Clear all subscriptions and event log (for testing)
   */
  clear(): void {
    this.handlers.clear();
    this.eventLog = [];
  }

  /**
   * Clear only the event log (for memory management)
   */
  clearLog(): void {
    this.eventLog = [];
  }

  /**
   * Get count of subscribers for an event type
   */
  getSubscriberCount(eventType: EventType): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * Check if there are any subscribers for an event type
   */
  hasSubscribers(eventType: EventType): boolean {
    return this.getSubscriberCount(eventType) > 0;
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Export class for testing
export { EventBus };
