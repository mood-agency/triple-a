import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnlineStatus } from '../useOnlineStatus'

describe('useOnlineStatus', () => {
  const originalNavigatorOnLine = navigator.onLine
  let onlineValue = true

  beforeEach(() => {
    onlineValue = true
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      get: () => onlineValue,
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: originalNavigatorOnLine,
    })
  })

  it('returns initial online status from navigator.onLine', () => {
    onlineValue = true
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(true)
  })

  it('returns false when initially offline', () => {
    onlineValue = false
    const { result } = renderHook(() => useOnlineStatus())
    expect(result.current).toBe(false)
  })

  it('updates to true when online event fires', () => {
    onlineValue = false
    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })

    expect(result.current).toBe(true)
  })

  it('updates to false when offline event fires', () => {
    onlineValue = true
    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result.current).toBe(false)
  })

  it('handles multiple status changes', () => {
    onlineValue = true
    const { result } = renderHook(() => useOnlineStatus())

    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)

    act(() => {
      window.dispatchEvent(new Event('online'))
    })
    expect(result.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(result.current).toBe(false)
  })

  it('cleans up event listeners on unmount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useOnlineStatus())

    expect(addEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(addEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    expect(removeEventListenerSpy).toHaveBeenCalledWith('offline', expect.any(Function))

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('does not update state after unmount', () => {
    const { result, unmount } = renderHook(() => useOnlineStatus())

    unmount()

    // This should not cause any errors (no state update on unmounted component)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    // Result should remain the last value before unmount
    expect(result.current).toBe(true)
  })

  it('multiple hook instances work independently', () => {
    const { result: result1 } = renderHook(() => useOnlineStatus())
    const { result: result2 } = renderHook(() => useOnlineStatus())

    expect(result1.current).toBe(true)
    expect(result2.current).toBe(true)

    act(() => {
      window.dispatchEvent(new Event('offline'))
    })

    expect(result1.current).toBe(false)
    expect(result2.current).toBe(false)
  })
})
