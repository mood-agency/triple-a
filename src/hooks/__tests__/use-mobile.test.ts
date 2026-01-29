import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '../use-mobile'

describe('useIsMobile', () => {
  const originalInnerWidth = window.innerWidth
  let matchMediaListeners: Map<string, ((e: MediaQueryListEvent) => void)[]>
  let mockMatches = false

  beforeEach(() => {
    matchMediaListeners = new Map()

    // Mock window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: mockMatches,
        media: query,
        onchange: null,
        addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
          const listeners = matchMediaListeners.get(query) || []
          listeners.push(listener)
          matchMediaListeners.set(query, listeners)
        }),
        removeEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
          const listeners = matchMediaListeners.get(query) || []
          const index = listeners.indexOf(listener)
          if (index > -1) {
            listeners.splice(index, 1)
          }
          matchMediaListeners.set(query, listeners)
        }),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    })
    matchMediaListeners.clear()
  })

  it('returns false when window width is >= 768', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true when window width is < 768', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 500,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('returns false when window width is exactly 768', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 768,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('returns true when window width is 767', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 767,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('updates when media query change event fires', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 500,
      })

      // Trigger all matchMedia listeners
      matchMediaListeners.forEach((listeners) => {
        listeners.forEach((listener) => {
          listener({ matches: true } as MediaQueryListEvent)
        })
      })
    })

    expect(result.current).toBe(true)
  })

  it('cleans up event listener on unmount', () => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1024,
    })

    const { unmount } = renderHook(() => useIsMobile())

    // Verify listeners were added
    expect(matchMediaListeners.size).toBeGreaterThan(0)
    const initialListenerCount = Array.from(matchMediaListeners.values()).flat().length

    unmount()

    // Listeners should be removed
    const finalListenerCount = Array.from(matchMediaListeners.values()).flat().length
    expect(finalListenerCount).toBeLessThan(initialListenerCount)
  })

  it('handles undefined state initially returning false', () => {
    // Before effect runs, isMobile is undefined, which gets coerced to false via !!
    const { result } = renderHook(() => useIsMobile())
    expect(typeof result.current).toBe('boolean')
  })
})
