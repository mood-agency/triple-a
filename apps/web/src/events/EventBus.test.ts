import { describe, it, expect, beforeEach, vi } from 'vitest'
import { EventBus } from './EventBus'

// Create a fresh instance for each test (don't use the singleton)
let bus: EventBus

beforeEach(() => {
  bus = new EventBus()
})

describe('EventBus', () => {
  // ---------------------------------------------------------------------------
  // subscribe / emit
  // ---------------------------------------------------------------------------
  describe('subscribe and emit', () => {
    it('should deliver events to subscribers', () => {
      const handler = vi.fn()
      bus.subscribe('note:created', handler)

      bus.emit('note:created', {
        noteId: 'n-1',
        content: 'Test',
        category: 'todo',
        projectId: null,
      })

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'note:created',
          payload: {
            noteId: 'n-1',
            content: 'Test',
            category: 'todo',
            projectId: null,
          },
          source: 'ui',
        })
      )
    })

    it('should include timestamp and correlationId', () => {
      const handler = vi.fn()
      bus.subscribe('note:deleted', handler)

      const before = Date.now()
      bus.emit('note:deleted', { noteId: 'n-1', reason: 'user' })
      const after = Date.now()

      const event = handler.mock.calls[0][0]
      expect(event.timestamp).toBeGreaterThanOrEqual(before)
      expect(event.timestamp).toBeLessThanOrEqual(after)
      expect(event.correlationId).toBeDefined()
      expect(typeof event.correlationId).toBe('string')
    })

    it('should respect the source parameter', () => {
      const handler = vi.fn()
      bus.subscribe('note:updated', handler)

      bus.emit('note:updated', { noteId: 'n-1' }, 'realtime')

      expect(handler.mock.calls[0][0].source).toBe('realtime')
    })

    it('should default source to ui', () => {
      const handler = vi.fn()
      bus.subscribe('note:completed', handler)

      bus.emit('note:completed', {
        noteId: 'n-1',
        completed: true,
        completedAt: '2026-02-06T12:00:00Z',
      })

      expect(handler.mock.calls[0][0].source).toBe('ui')
    })

    it('should support multiple handlers for the same event', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      bus.subscribe('note:pinned', handler1)
      bus.subscribe('note:pinned', handler2)

      bus.emit('note:pinned', { noteId: 'n-1', pinned: true })

      expect(handler1).toHaveBeenCalledOnce()
      expect(handler2).toHaveBeenCalledOnce()
    })

    it('should not call handlers for different event types', () => {
      const createdHandler = vi.fn()
      const deletedHandler = vi.fn()
      bus.subscribe('note:created', createdHandler)
      bus.subscribe('note:deleted', deletedHandler)

      bus.emit('note:created', {
        noteId: 'n-1',
        content: 'Test',
        category: 'todo',
        projectId: null,
      })

      expect(createdHandler).toHaveBeenCalledOnce()
      expect(deletedHandler).not.toHaveBeenCalled()
    })

    it('should not fail when emitting with no subscribers', () => {
      expect(() => {
        bus.emit('note:created', {
          noteId: 'n-1',
          content: 'Test',
          category: 'todo',
          projectId: null,
        })
      }).not.toThrow()
    })
  })

  // ---------------------------------------------------------------------------
  // unsubscribe
  // ---------------------------------------------------------------------------
  describe('unsubscribe', () => {
    it('should stop receiving events after unsubscribe', () => {
      const handler = vi.fn()
      const unsub = bus.subscribe('note:created', handler)

      bus.emit('note:created', {
        noteId: 'n-1',
        content: 'First',
        category: 'todo',
        projectId: null,
      })
      expect(handler).toHaveBeenCalledOnce()

      unsub()

      bus.emit('note:created', {
        noteId: 'n-2',
        content: 'Second',
        category: 'todo',
        projectId: null,
      })
      expect(handler).toHaveBeenCalledOnce() // still only 1 call
    })

    it('should only unsubscribe the specific handler', () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      const unsub1 = bus.subscribe('note:pinned', handler1)
      bus.subscribe('note:pinned', handler2)

      unsub1()

      bus.emit('note:pinned', { noteId: 'n-1', pinned: true })

      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledOnce()
    })
  })

  // ---------------------------------------------------------------------------
  // subscribeMany
  // ---------------------------------------------------------------------------
  describe('subscribeMany', () => {
    it('should subscribe to multiple event types', () => {
      const handler = vi.fn()
      bus.subscribeMany(['note:created', 'note:deleted'], handler)

      bus.emit('note:created', {
        noteId: 'n-1',
        content: 'Test',
        category: 'todo',
        projectId: null,
      })
      bus.emit('note:deleted', { noteId: 'n-2', reason: 'user' })

      expect(handler).toHaveBeenCalledTimes(2)
    })

    it('should unsubscribe from all event types at once', () => {
      const handler = vi.fn()
      const unsub = bus.subscribeMany(['note:created', 'note:deleted'], handler)

      unsub()

      bus.emit('note:created', {
        noteId: 'n-1',
        content: 'Test',
        category: 'todo',
        projectId: null,
      })
      bus.emit('note:deleted', { noteId: 'n-2', reason: 'user' })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  // ---------------------------------------------------------------------------
  // Event log
  // ---------------------------------------------------------------------------
  describe('event log', () => {
    it('should record emitted events', () => {
      bus.emit('note:created', {
        noteId: 'n-1',
        content: 'Test',
        category: 'todo',
        projectId: null,
      })
      bus.emit('note:deleted', { noteId: 'n-2', reason: 'user' })

      const log = bus.getEventLog()
      expect(log).toHaveLength(2)
      expect(log[0].type).toBe('note:created')
      expect(log[1].type).toBe('note:deleted')
    })

    it('should filter events by type', () => {
      bus.emit('note:created', {
        noteId: 'n-1',
        content: 'Test',
        category: 'todo',
        projectId: null,
      })
      bus.emit('note:deleted', { noteId: 'n-2', reason: 'user' })
      bus.emit('note:created', {
        noteId: 'n-3',
        content: 'Another',
        category: 'todo',
        projectId: null,
      })

      const created = bus.getEventsByType('note:created')
      expect(created).toHaveLength(2)
    })

    it('should clear the log', () => {
      bus.emit('note:created', {
        noteId: 'n-1',
        content: 'Test',
        category: 'todo',
        projectId: null,
      })

      bus.clearLog()

      expect(bus.getEventLog()).toHaveLength(0)
    })

    it('should return event by correlationId', () => {
      const event = bus.emit('note:pinned', { noteId: 'n-1', pinned: true })

      const found = bus.getEventsByCorrelationId(event.correlationId)
      expect(found).toHaveLength(1)
      expect(found[0].type).toBe('note:pinned')
    })
  })

  // ---------------------------------------------------------------------------
  // Subscriber count and clear
  // ---------------------------------------------------------------------------
  describe('subscriber management', () => {
    it('should track subscriber count', () => {
      expect(bus.getSubscriberCount('note:created')).toBe(0)

      const unsub1 = bus.subscribe('note:created', vi.fn())
      expect(bus.getSubscriberCount('note:created')).toBe(1)

      bus.subscribe('note:created', vi.fn())
      expect(bus.getSubscriberCount('note:created')).toBe(2)

      unsub1()
      expect(bus.getSubscriberCount('note:created')).toBe(1)
    })

    it('should report hasSubscribers correctly', () => {
      expect(bus.hasSubscribers('note:created')).toBe(false)

      const unsub = bus.subscribe('note:created', vi.fn())
      expect(bus.hasSubscribers('note:created')).toBe(true)

      unsub()
      expect(bus.hasSubscribers('note:created')).toBe(false)
    })

    it('should clear all handlers and log', () => {
      bus.subscribe('note:created', vi.fn())
      bus.subscribe('note:deleted', vi.fn())
      bus.emit('note:created', {
        noteId: 'n-1',
        content: 'Test',
        category: 'todo',
        projectId: null,
      })

      bus.clear()

      expect(bus.getSubscriberCount('note:created')).toBe(0)
      expect(bus.getSubscriberCount('note:deleted')).toBe(0)
      expect(bus.getEventLog()).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // Error handling
  // ---------------------------------------------------------------------------
  describe('error handling', () => {
    it('should not break other handlers when one throws', () => {
      const errorHandler = vi.fn(() => {
        throw new Error('Handler crashed')
      })
      const goodHandler = vi.fn()

      bus.subscribe('note:created', errorHandler)
      bus.subscribe('note:created', goodHandler)

      // Suppress console.error for this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      bus.emit('note:created', {
        noteId: 'n-1',
        content: 'Test',
        category: 'todo',
        projectId: null,
      })

      expect(goodHandler).toHaveBeenCalledOnce()
      spy.mockRestore()
    })

    it('should handle async handler errors gracefully', async () => {
      const asyncHandler = vi.fn(async () => {
        throw new Error('Async error')
      })

      bus.subscribe('note:updated', asyncHandler)

      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Should not throw
      expect(() => {
        bus.emit('note:updated', { noteId: 'n-1' })
      }).not.toThrow()

      // Wait for async handler to settle
      await new Promise(resolve => setTimeout(resolve, 10))

      spy.mockRestore()
    })
  })

  // ---------------------------------------------------------------------------
  // createEvent
  // ---------------------------------------------------------------------------
  describe('createEvent', () => {
    it('should create an event without publishing', () => {
      const handler = vi.fn()
      bus.subscribe('note:created', handler)

      const event = bus.createEvent('note:created', {
        noteId: 'n-1',
        content: 'Test',
        category: 'todo',
        projectId: null,
      }, 'command')

      // Should NOT have been published
      expect(handler).not.toHaveBeenCalled()

      // Event should have all fields
      expect(event.type).toBe('note:created')
      expect(event.source).toBe('command')
      expect(event.timestamp).toBeDefined()
      expect(event.correlationId).toBeDefined()
    })
  })
})
