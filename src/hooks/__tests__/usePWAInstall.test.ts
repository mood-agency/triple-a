import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePWAInstall } from '../usePWAInstall'

describe('usePWAInstall', () => {
  const originalMatchMedia = window.matchMedia
  let mockMatchMedia: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: mockMatchMedia,
    })
  })

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    })
    vi.restoreAllMocks()
  })

  it('returns canInstall false when not installed and no prompt available', () => {
    const { result } = renderHook(() => usePWAInstall())

    expect(result.current.canInstall).toBe(false)
    expect(result.current.isInstalled).toBe(false)
  })

  it('detects standalone mode as installed', () => {
    mockMatchMedia.mockReturnValue({
      matches: true,
      media: '(display-mode: standalone)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })

    const { result } = renderHook(() => usePWAInstall())

    expect(result.current.isInstalled).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('detects iOS standalone mode as installed', () => {
    const originalNavigator = window.navigator
    Object.defineProperty(window, 'navigator', {
      configurable: true,
      writable: true,
      value: { ...originalNavigator, standalone: true },
    })

    const { result } = renderHook(() => usePWAInstall())

    expect(result.current.isInstalled).toBe(true)

    Object.defineProperty(window, 'navigator', {
      configurable: true,
      writable: true,
      value: originalNavigator,
    })
  })

  it('captures beforeinstallprompt event', () => {
    const { result } = renderHook(() => usePWAInstall())

    expect(result.current.canInstall).toBe(false)

    // Simulate beforeinstallprompt event
    const mockPromptEvent = {
      preventDefault: vi.fn(),
      prompt: vi.fn().mockResolvedValue(undefined),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    }

    act(() => {
      const event = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
      }
      Object.assign(event, mockPromptEvent)
      window.dispatchEvent(event)
    })

    expect(result.current.canInstall).toBe(true)
  })

  it('promptInstall returns false when no prompt available', async () => {
    const { result } = renderHook(() => usePWAInstall())

    const installResult = await result.current.promptInstall()

    expect(installResult).toBe(false)
  })

  it('promptInstall triggers prompt and returns true on accept', async () => {
    const mockPrompt = vi.fn().mockResolvedValue(undefined)
    const mockUserChoice = Promise.resolve({ outcome: 'accepted' as const })

    const { result } = renderHook(() => usePWAInstall())

    // Simulate beforeinstallprompt
    act(() => {
      const event = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
      }
      Object.assign(event, {
        preventDefault: vi.fn(),
        prompt: mockPrompt,
        userChoice: mockUserChoice,
      })
      window.dispatchEvent(event)
    })

    expect(result.current.canInstall).toBe(true)

    let installResult: boolean
    await act(async () => {
      installResult = await result.current.promptInstall()
    })

    expect(mockPrompt).toHaveBeenCalled()
    expect(installResult!).toBe(true)
    expect(result.current.isInstalled).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('promptInstall returns false on dismiss', async () => {
    const mockPrompt = vi.fn().mockResolvedValue(undefined)
    const mockUserChoice = Promise.resolve({ outcome: 'dismissed' as const })

    const { result } = renderHook(() => usePWAInstall())

    // Simulate beforeinstallprompt
    act(() => {
      const event = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
      }
      Object.assign(event, {
        preventDefault: vi.fn(),
        prompt: mockPrompt,
        userChoice: mockUserChoice,
      })
      window.dispatchEvent(event)
    })

    let installResult: boolean
    await act(async () => {
      installResult = await result.current.promptInstall()
    })

    expect(installResult!).toBe(false)
    expect(result.current.isInstalled).toBe(false)
  })

  it('handles appinstalled event', () => {
    const { result } = renderHook(() => usePWAInstall())

    // First, simulate having a prompt
    act(() => {
      const event = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
      }
      Object.assign(event, {
        preventDefault: vi.fn(),
        prompt: vi.fn(),
        userChoice: Promise.resolve({ outcome: 'accepted' as const }),
      })
      window.dispatchEvent(event)
    })

    expect(result.current.canInstall).toBe(true)

    // Simulate app installed
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })

    expect(result.current.isInstalled).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('cleans up event listeners on unmount', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => usePWAInstall())

    expect(addSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function))

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function))
    expect(removeSpy).toHaveBeenCalledWith('appinstalled', expect.any(Function))

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('handles prompt error gracefully', async () => {
    const mockPrompt = vi.fn().mockRejectedValue(new Error('Prompt failed'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { result } = renderHook(() => usePWAInstall())

    // Simulate beforeinstallprompt
    act(() => {
      const event = new Event('beforeinstallprompt') as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
      }
      Object.assign(event, {
        preventDefault: vi.fn(),
        prompt: mockPrompt,
        userChoice: Promise.resolve({ outcome: 'accepted' as const }),
      })
      window.dispatchEvent(event)
    })

    let installResult: boolean
    await act(async () => {
      installResult = await result.current.promptInstall()
    })

    expect(installResult!).toBe(false)
    expect(consoleSpy).toHaveBeenCalledWith('Error prompting PWA install:', expect.any(Error))

    consoleSpy.mockRestore()
  })
})
