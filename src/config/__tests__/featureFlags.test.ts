import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getFeatureFlags, getFlag, setFlag } from '../featureFlags'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    _store: store,
    _reset: () => {
      store = {}
    },
  }
})()

describe('featureFlags', () => {
  beforeEach(() => {
    localStorageMock._reset()
    vi.stubGlobal('localStorage', localStorageMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getFlag', () => {
    it('returns default value when no flag is stored', () => {
      expect(getFlag('tinyBaseSync')).toBe(true)
    })

    it('returns true when stored value is "true"', () => {
      localStorageMock.setItem('ff_tinyBaseSync', 'true')
      expect(getFlag('tinyBaseSync')).toBe(true)
    })

    it('returns false when stored value is "false"', () => {
      localStorageMock.setItem('ff_tinyBaseSync', 'false')
      expect(getFlag('tinyBaseSync')).toBe(false)
    })

    it('uses correct storage prefix', () => {
      getFlag('tinyBaseSync')
      expect(localStorageMock.getItem).toHaveBeenCalledWith('ff_tinyBaseSync')
    })

    it('returns default when localStorage throws', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('Storage error')
        },
      })

      expect(getFlag('tinyBaseSync')).toBe(true)
    })
  })

  describe('setFlag', () => {
    it('stores true as string "true"', () => {
      setFlag('tinyBaseSync', true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('ff_tinyBaseSync', 'true')
    })

    it('stores false as string "false"', () => {
      setFlag('tinyBaseSync', false)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('ff_tinyBaseSync', 'false')
    })

    it('uses correct storage prefix', () => {
      setFlag('tinyBaseSync', true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('ff_tinyBaseSync', 'true')
    })

    it('does not throw when localStorage throws', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.stubGlobal('localStorage', {
        setItem: () => {
          throw new Error('Storage error')
        },
      })

      expect(() => setFlag('tinyBaseSync', true)).not.toThrow()
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('getFeatureFlags', () => {
    it('returns object with all flags', () => {
      const flags = getFeatureFlags()
      expect(flags).toHaveProperty('tinyBaseSync')
    })

    it('returns default values when nothing stored', () => {
      const flags = getFeatureFlags()
      expect(flags.tinyBaseSync).toBe(true)
    })

    it('returns stored values', () => {
      localStorageMock.setItem('ff_tinyBaseSync', 'false')
      const flags = getFeatureFlags()
      expect(flags.tinyBaseSync).toBe(false)
    })
  })

  describe('integration', () => {
    it('setFlag followed by getFlag returns correct value', () => {
      setFlag('tinyBaseSync', false)
      expect(getFlag('tinyBaseSync')).toBe(false)

      setFlag('tinyBaseSync', true)
      expect(getFlag('tinyBaseSync')).toBe(true)
    })

    it('flags persist in localStorage', () => {
      setFlag('tinyBaseSync', false)

      // Verify it was stored
      expect(localStorageMock.getItem('ff_tinyBaseSync')).toBe('false')
    })
  })
})
