import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useAutoSave } from '../useAutoSave'

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not call onSave when value equals originalValue', () => {
    const onSave = vi.fn()
    renderHook(() =>
      useAutoSave({
        value: 'test',
        originalValue: 'test',
        onSave,
      })
    )

    vi.advanceTimersByTime(5000)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onSave after debounce period when value differs', async () => {
    const onSave = vi.fn()
    renderHook(() =>
      useAutoSave({
        value: 'changed',
        originalValue: 'original',
        onSave,
        debounceMs: 1000,
      })
    )

    expect(onSave).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onSave).toHaveBeenCalledWith('changed')
  })

  it('uses default debounce of 3000ms', () => {
    const onSave = vi.fn()
    renderHook(() =>
      useAutoSave({
        value: 'changed',
        originalValue: 'original',
        onSave,
      })
    )

    act(() => {
      vi.advanceTimersByTime(2999)
    })
    expect(onSave).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onSave).toHaveBeenCalledWith('changed')
  })

  it('cancels pending save when value returns to original', () => {
    const onSave = vi.fn()
    const { rerender } = renderHook(
      ({ value }) =>
        useAutoSave({
          value,
          originalValue: 'original',
          onSave,
          debounceMs: 1000,
        }),
      { initialProps: { value: 'changed' } }
    )

    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Value returns to original
    rerender({ value: 'original' })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onSave).not.toHaveBeenCalled()
  })

  it('resets timer on rapid changes', () => {
    const onSave = vi.fn()
    const { rerender } = renderHook(
      ({ value }) =>
        useAutoSave({
          value,
          originalValue: 'original',
          onSave,
          debounceMs: 1000,
        }),
      { initialProps: { value: 'change1' } }
    )

    act(() => {
      vi.advanceTimersByTime(500)
    })

    rerender({ value: 'change2' })

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onSave).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(onSave).toHaveBeenCalledWith('change2')
  })

  it('does not save when disabled', () => {
    const onSave = vi.fn()
    renderHook(() =>
      useAutoSave({
        value: 'changed',
        originalValue: 'original',
        onSave,
        debounceMs: 1000,
        enabled: false,
      })
    )

    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(onSave).not.toHaveBeenCalled()
  })

  describe('handleBlur', () => {
    it('flushes pending save immediately on blur', () => {
      const onSave = vi.fn()
      const { result } = renderHook(() =>
        useAutoSave({
          value: 'changed',
          originalValue: 'original',
          onSave,
          debounceMs: 5000,
        })
      )

      expect(onSave).not.toHaveBeenCalled()

      act(() => {
        result.current.handleBlur()
      })

      expect(onSave).toHaveBeenCalledWith('changed')
    })

    it('does not call onSave on blur when no pending save', () => {
      const onSave = vi.fn()
      const { result } = renderHook(() =>
        useAutoSave({
          value: 'same',
          originalValue: 'same',
          onSave,
        })
      )

      act(() => {
        result.current.handleBlur()
      })

      expect(onSave).not.toHaveBeenCalled()
    })

    it('clears timeout on blur', () => {
      const onSave = vi.fn()
      const { result } = renderHook(() =>
        useAutoSave({
          value: 'changed',
          originalValue: 'original',
          onSave,
          debounceMs: 1000,
        })
      )

      act(() => {
        result.current.handleBlur()
      })

      // First call from handleBlur
      expect(onSave).toHaveBeenCalledTimes(1)

      // Advance past original debounce - should not call again
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(onSave).toHaveBeenCalledTimes(1)
    })
  })

  describe('beforeunload', () => {
    it('saves pending changes on beforeunload', () => {
      const onSave = vi.fn()
      renderHook(() =>
        useAutoSave({
          value: 'changed',
          originalValue: 'original',
          onSave,
          debounceMs: 5000,
        })
      )

      // Trigger beforeunload
      window.dispatchEvent(new Event('beforeunload'))

      expect(onSave).toHaveBeenCalledWith('changed')
    })
  })

  describe('unmount', () => {
    it('saves pending changes on unmount', () => {
      const onSave = vi.fn()
      const { unmount } = renderHook(() =>
        useAutoSave({
          value: 'changed',
          originalValue: 'original',
          onSave,
          debounceMs: 5000,
        })
      )

      unmount()

      expect(onSave).toHaveBeenCalledWith('changed')
    })

    it('does not save on unmount when no pending changes', () => {
      const onSave = vi.fn()
      const { unmount } = renderHook(() =>
        useAutoSave({
          value: 'same',
          originalValue: 'same',
          onSave,
        })
      )

      unmount()

      expect(onSave).not.toHaveBeenCalled()
    })
  })

  it('uses updated onSave callback', () => {
    const onSave1 = vi.fn()
    const onSave2 = vi.fn()

    const { rerender } = renderHook(
      ({ onSave }) =>
        useAutoSave({
          value: 'changed',
          originalValue: 'original',
          onSave,
          debounceMs: 1000,
        }),
      { initialProps: { onSave: onSave1 } }
    )

    // Change onSave callback mid-debounce
    rerender({ onSave: onSave2 })

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onSave1).not.toHaveBeenCalled()
    expect(onSave2).toHaveBeenCalledWith('changed')
  })

  it('works with non-string values', () => {
    const onSave = vi.fn()
    renderHook(() =>
      useAutoSave({
        value: { count: 5 },
        originalValue: { count: 0 },
        onSave,
        debounceMs: 1000,
      })
    )

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(onSave).toHaveBeenCalledWith({ count: 5 })
  })

  it('handles zero debounce time', () => {
    const onSave = vi.fn()
    renderHook(() =>
      useAutoSave({
        value: 'changed',
        originalValue: 'original',
        onSave,
        debounceMs: 0,
      })
    )

    act(() => {
      vi.advanceTimersByTime(0)
    })

    expect(onSave).toHaveBeenCalledWith('changed')
  })
})
