import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCursorPosition, getFontString } from '../cursorUtils'

// Mock canvas context for testing
function createMockCanvasContext(widthFn: (text: string) => number) {
  return {
    font: '',
    measureText: vi.fn((text: string) => ({
      width: widthFn(text),
    })),
  }
}

describe('getCursorPosition', () => {
  beforeEach(() => {
    // Mock document.createElement to return a mock canvas
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        // Each character is 10px wide
        const ctx = createMockCanvasContext((text) => text.length * 10)
        return {
          getContext: vi.fn().mockReturnValue(ctx),
        } as unknown as HTMLCanvasElement
      }
      return document.createElement(tagName)
    })
  })

  it('returns 0 for empty text', () => {
    expect(getCursorPosition('', '16px sans-serif', 50)).toBe(0)
  })

  it('returns 0 for click at position 0', () => {
    expect(getCursorPosition('Hello', '16px sans-serif', 0)).toBe(0)
  })

  it('returns 0 for negative click position', () => {
    expect(getCursorPosition('Hello', '16px sans-serif', -10)).toBe(0)
  })

  it('returns text length for click past end', () => {
    // 'Hello' = 5 chars * 10px = 50px wide
    expect(getCursorPosition('Hello', '16px sans-serif', 100)).toBe(5)
  })

  it('returns text length for click exactly at end', () => {
    // 'Hello' = 5 chars * 10px = 50px wide
    expect(getCursorPosition('Hello', '16px sans-serif', 50)).toBe(5)
  })

  it('returns correct position for click in middle', () => {
    // 'Hello' = 5 chars, each 10px
    // Click at 25px is between char 2 (20px) and char 3 (30px)
    // 25px is closer to 30px (5px away) vs 20px (5px away) - tie goes to previous
    expect(getCursorPosition('Hello', '16px sans-serif', 25)).toBe(2)
  })

  it('returns position closer to next char when click is past midpoint', () => {
    // Click at 26px: closer to 30px (4px) than 20px (6px)
    expect(getCursorPosition('Hello', '16px sans-serif', 26)).toBe(3)
  })

  it('returns position closer to previous char when click is before midpoint', () => {
    // Click at 24px: closer to 20px (4px) than 30px (6px)
    expect(getCursorPosition('Hello', '16px sans-serif', 24)).toBe(2)
  })

  it('returns 1 for click in first character region', () => {
    // Click at 8px: closer to 10px (2px) than 0px (8px)
    expect(getCursorPosition('Hello', '16px sans-serif', 8)).toBe(1)
  })

  it('handles single character text', () => {
    // 'A' = 1 char * 10px = 10px
    expect(getCursorPosition('A', '16px sans-serif', 5)).toBe(0) // Before midpoint
    expect(getCursorPosition('A', '16px sans-serif', 6)).toBe(1) // After midpoint
  })
})

describe('getCursorPosition with variable-width fonts', () => {
  beforeEach(() => {
    // Mock with variable width: 'W' = 15px, others = 5px
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        const ctx = createMockCanvasContext((text) => {
          let width = 0
          for (const char of text) {
            width += char === 'W' ? 15 : 5
          }
          return width
        })
        return {
          getContext: vi.fn().mockReturnValue(ctx),
        } as unknown as HTMLCanvasElement
      }
      return document.createElement(tagName)
    })
  })

  it('handles variable width characters', () => {
    // 'WaW' = 15 + 5 + 15 = 35px
    // Click at 17px: after 'W' (15px), before 'Wa' (20px)
    // 17px is closer to 15px (2px) than 20px (3px)
    expect(getCursorPosition('WaW', '16px sans-serif', 17)).toBe(1)
  })
})

describe('getCursorPosition edge cases', () => {
  beforeEach(() => {
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        const ctx = createMockCanvasContext((text) => text.length * 10)
        return {
          getContext: vi.fn().mockReturnValue(ctx),
        } as unknown as HTMLCanvasElement
      }
      return document.createElement(tagName)
    })
  })

  it('handles null canvas context', () => {
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return {
          getContext: vi.fn().mockReturnValue(null),
        } as unknown as HTMLCanvasElement
      }
      return document.createElement(tagName)
    })

    expect(getCursorPosition('Hello', '16px sans-serif', 25)).toBe(0)
  })
})

describe('getFontString', () => {
  it('combines font properties into string', () => {
    const style = {
      fontWeight: 'bold',
      fontSize: '16px',
      fontFamily: 'Arial, sans-serif',
    } as CSSStyleDeclaration

    expect(getFontString(style)).toBe('bold 16px Arial, sans-serif')
  })

  it('handles normal weight', () => {
    const style = {
      fontWeight: '400',
      fontSize: '14px',
      fontFamily: 'Helvetica',
    } as CSSStyleDeclaration

    expect(getFontString(style)).toBe('400 14px Helvetica')
  })

  it('handles numeric weight values', () => {
    const style = {
      fontWeight: '700',
      fontSize: '18px',
      fontFamily: 'Georgia',
    } as CSSStyleDeclaration

    expect(getFontString(style)).toBe('700 18px Georgia')
  })
})
