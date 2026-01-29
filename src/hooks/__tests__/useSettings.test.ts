import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// Mock the useUserPreferences hook since it requires Supabase
vi.mock('../useUserPreferences', () => ({
  useUserPreferences: vi.fn(),
}))

// Import after mocking
import { useSettings } from '../useSettings'
import type { AppSettings } from '../useSettings'

describe('useSettings', () => {
  const SETTINGS_KEY = 'app-settings'

  const DEFAULT_SETTINGS: AppSettings = {
    autoSync: true,
    showSidebar: false,
    fixedNoteId: null,
    viewMode: 'list',
    beeperToken: null,
    compactTaskView: false,
    activeProjectId: null,
    autoSaveInterval: 3,
  }

  beforeEach(() => {
    localStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('returns default settings when no stored settings exist', () => {
    const { result } = renderHook(() => useSettings())

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('loads settings from localStorage', () => {
    const storedSettings = {
      autoSync: false,
      showSidebar: true,
      viewMode: 'calendar',
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(storedSettings))

    const { result } = renderHook(() => useSettings())

    expect(result.current.settings.autoSync).toBe(false)
    expect(result.current.settings.showSidebar).toBe(true)
    expect(result.current.settings.viewMode).toBe('calendar')
    // Defaults for non-stored values
    expect(result.current.settings.compactTaskView).toBe(false)
  })

  it('merges stored settings with defaults', () => {
    const partialSettings = { autoSync: false }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(partialSettings))

    const { result } = renderHook(() => useSettings())

    expect(result.current.settings.autoSync).toBe(false)
    expect(result.current.settings.showSidebar).toBe(false) // default
    expect(result.current.settings.autoSaveInterval).toBe(3) // default
  })

  it('updateSettings updates specific settings', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSettings({ showSidebar: true })
    })

    expect(result.current.settings.showSidebar).toBe(true)
    // Other settings remain unchanged
    expect(result.current.settings.autoSync).toBe(true)
  })

  it('updateSettings can update multiple settings', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSettings({
        showSidebar: true,
        viewMode: 'calendar',
        autoSaveInterval: 5,
      })
    })

    expect(result.current.settings.showSidebar).toBe(true)
    expect(result.current.settings.viewMode).toBe('calendar')
    expect(result.current.settings.autoSaveInterval).toBe(5)
  })

  it('saves settings to localStorage on change', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSettings({ showSidebar: true })
    })

    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    expect(stored.showSidebar).toBe(true)
  })

  it('handles fixedNoteId setting', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSettings({ fixedNoteId: 'note-123' })
    })

    expect(result.current.settings.fixedNoteId).toBe('note-123')

    act(() => {
      result.current.updateSettings({ fixedNoteId: null })
    })

    expect(result.current.settings.fixedNoteId).toBeNull()
  })

  it('handles beeperToken setting', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSettings({ beeperToken: 'token-abc' })
    })

    expect(result.current.settings.beeperToken).toBe('token-abc')
  })

  it('handles activeProjectId setting', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSettings({ activeProjectId: 'project-456' })
    })

    expect(result.current.settings.activeProjectId).toBe('project-456')
  })

  it('handles compactTaskView toggle', () => {
    const { result } = renderHook(() => useSettings())

    expect(result.current.settings.compactTaskView).toBe(false)

    act(() => {
      result.current.updateSettings({ compactTaskView: true })
    })

    expect(result.current.settings.compactTaskView).toBe(true)
  })

  it('handles invalid JSON in localStorage gracefully', () => {
    localStorage.setItem(SETTINGS_KEY, 'not valid json')

    const { result } = renderHook(() => useSettings())

    // Should fall back to defaults
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('handles localStorage getItem throwing', () => {
    const originalGetItem = localStorage.getItem
    localStorage.getItem = vi.fn().mockImplementation(() => {
      throw new Error('Storage error')
    })

    const { result } = renderHook(() => useSettings())

    // Should fall back to defaults
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)

    localStorage.getItem = originalGetItem
  })

  it('handles localStorage setItem throwing', () => {
    const originalSetItem = localStorage.setItem
    localStorage.setItem = vi.fn().mockImplementation(() => {
      throw new Error('Storage full')
    })

    const { result } = renderHook(() => useSettings())

    // Should not throw, just log error
    act(() => {
      result.current.updateSettings({ showSidebar: true })
    })

    // Settings should still update in memory
    expect(result.current.settings.showSidebar).toBe(true)

    localStorage.setItem = originalSetItem
  })

  it('preserves settings across multiple updates', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSettings({ showSidebar: true })
    })
    act(() => {
      result.current.updateSettings({ autoSync: false })
    })
    act(() => {
      result.current.updateSettings({ viewMode: 'calendar' })
    })

    expect(result.current.settings.showSidebar).toBe(true)
    expect(result.current.settings.autoSync).toBe(false)
    expect(result.current.settings.viewMode).toBe('calendar')
  })

  it('validates viewMode values', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ viewMode: 'list' }))
    const { result: result1 } = renderHook(() => useSettings())
    expect(result1.current.settings.viewMode).toBe('list')

    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ viewMode: 'calendar' }))
    const { result: result2 } = renderHook(() => useSettings())
    expect(result2.current.settings.viewMode).toBe('calendar')
  })

  it('handles autoSaveInterval of 0 (disabled)', () => {
    const { result } = renderHook(() => useSettings())

    act(() => {
      result.current.updateSettings({ autoSaveInterval: 0 })
    })

    expect(result.current.settings.autoSaveInterval).toBe(0)
  })
})
