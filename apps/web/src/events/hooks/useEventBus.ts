import { useEffect, useCallback, useRef } from 'react';
import { eventBus } from '../EventBus';
import type { EventMap, EventType, EventHandler, EventSource, DomainEvent } from '../types';

/**
 * Hook to publish events to the event bus
 */
export function useEventBus() {
  const publish = useCallback(<E extends DomainEvent>(event: E) => {
    eventBus.publish(event);
  }, []);

  const emit = useCallback(
    <K extends EventType>(
      type: K,
      payload: EventMap[K]['payload'],
      source: EventSource = 'ui'
    ) => {
      return eventBus.emit(type, payload, source);
    },
    []
  );

  const createEvent = useCallback(
    <K extends EventType>(
      type: K,
      payload: EventMap[K]['payload'],
      source: EventSource = 'ui'
    ) => {
      return eventBus.createEvent(type, payload, source);
    },
    []
  );

  return { publish, emit, createEvent };
}

/**
 * Hook to subscribe to a single event type
 * Automatically unsubscribes on unmount
 */
export function useEventSubscription<K extends EventType>(
  eventType: K,
  handler: EventHandler<EventMap[K]>
) {
  // Use ref to always have latest handler without re-subscribing
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrappedHandler: EventHandler<EventMap[K]> = (event) => {
      handlerRef.current(event);
    };

    const unsubscribe = eventBus.subscribe(eventType, wrappedHandler);
    return unsubscribe;
  }, [eventType]);
}

/**
 * Hook to subscribe to multiple event types with a single handler
 * Automatically unsubscribes on unmount
 */
export function useEventSubscriptionMany<K extends EventType>(
  eventTypes: K[],
  handler: EventHandler<EventMap[K]>
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const wrappedHandler: EventHandler<EventMap[K]> = (event) => {
      handlerRef.current(event);
    };

    const unsubscribe = eventBus.subscribeMany(eventTypes, wrappedHandler);
    return unsubscribe;
  }, [JSON.stringify(eventTypes)]);
}

/**
 * Hook to get recent events (for debugging)
 */
export function useEventLog() {
  return {
    getLog: () => eventBus.getEventLog(),
    getByType: <K extends EventType>(type: K) => eventBus.getEventsByType(type),
    getByCorrelationId: (id: string) => eventBus.getEventsByCorrelationId(id),
    clear: () => eventBus.clearLog(),
  };
}
