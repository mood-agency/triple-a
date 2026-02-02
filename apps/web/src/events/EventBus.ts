import type {
  DomainEvent,
  EventMap,
  EventType,
  EventHandler,
  EventSource,
  UnsubscribeFn,
} from './types';

const MAX_LOG_SIZE = 1000;
const SLOW_HANDLER_THRESHOLD_MS = 50;

interface HandlerInfo {
  handler: EventHandler<DomainEvent>;
  name: string;
  subscribedAt: string;
}

class EventBus {
  private handlers: Map<string, Set<HandlerInfo>> = new Map();
  private eventLog: DomainEvent[] = [];

  /**
   * Subscribe to an event type with a handler
   * @returns Unsubscribe function
   */
  subscribe<K extends EventType>(
    eventType: K,
    handler: EventHandler<EventMap[K]>,
    handlerName?: string
  ): UnsubscribeFn {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    // Try to get a meaningful name for the handler
    const name = handlerName || handler.name || this.getCallerInfo() || 'anonymous';

    const handlerInfo: HandlerInfo = {
      handler: handler as EventHandler<DomainEvent>,
      name,
      subscribedAt: new Error().stack?.split('\n')[3]?.trim() || 'unknown',
    };

    this.handlers.get(eventType)!.add(handlerInfo);

    return () => {
      this.handlers.get(eventType)?.delete(handlerInfo);
    };
  }

  /**
   * Try to extract caller info from stack trace (dev only)
   */
  private getCallerInfo(): string | undefined {
    if (!import.meta.env.DEV) return undefined;
    try {
      const stack = new Error().stack;
      if (!stack) return undefined;
      // Look for the component/hook that called subscribe
      const lines = stack.split('\n');
      for (const line of lines) {
        if (line.includes('use') || line.includes('Component') || line.includes('.tsx')) {
          const match = line.match(/at\s+(\w+)/);
          if (match) return match[1];
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
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
      const totalStart = performance.now();

      typeHandlers.forEach((handlerInfo) => {
        const start = performance.now();
        try {
          const result = handlerInfo.handler(event);
          // Handle async handlers - log errors but don't block
          if (result instanceof Promise) {
            const asyncStart = performance.now();
            result
              .then(() => {
                if (import.meta.env.DEV) {
                  const asyncElapsed = performance.now() - asyncStart;
                  if (asyncElapsed > SLOW_HANDLER_THRESHOLD_MS) {
                    console.warn(
                      `[EventBus] ⚠️ Slow async handler for "${event.type}": ${asyncElapsed.toFixed(1)}ms`,
                      `\n  Handler: ${handlerInfo.name}`,
                      `\n  Subscribed at: ${handlerInfo.subscribedAt}`
                    );
                  }
                }
              })
              .catch((error) => {
                console.error(`[EventBus] Async error handling ${event.type}:`, error);
              });
          }
        } catch (error) {
          console.error(`[EventBus] Error handling ${event.type}:`, error);
        } finally {
          if (import.meta.env.DEV) {
            const elapsed = performance.now() - start;
            if (elapsed > SLOW_HANDLER_THRESHOLD_MS) {
              console.warn(
                `[EventBus] ⚠️ Slow sync handler for "${event.type}": ${elapsed.toFixed(1)}ms`,
                `\n  Handler: ${handlerInfo.name}`,
                `\n  Subscribed at: ${handlerInfo.subscribedAt}`
              );
            }
          }
        }
      });

      if (import.meta.env.DEV) {
        const totalElapsed = performance.now() - totalStart;
        if (totalElapsed > SLOW_HANDLER_THRESHOLD_MS) {
          console.warn(
            `[EventBus] ⚠️ Total time for "${event.type}": ${totalElapsed.toFixed(1)}ms (${typeHandlers.size} handlers)`
          );
        }
      }
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

  /**
   * Get all registered handlers for debugging (dev only)
   */
  getRegisteredHandlers(): Record<string, { name: string; subscribedAt: string }[]> {
    const result: Record<string, { name: string; subscribedAt: string }[]> = {};
    this.handlers.forEach((handlerInfos, eventType) => {
      result[eventType] = Array.from(handlerInfos).map((info) => ({
        name: info.name,
        subscribedAt: info.subscribedAt,
      }));
    });
    return result;
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Export class for testing
export { EventBus };
