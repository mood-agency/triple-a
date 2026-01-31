import { describe, it, expect, beforeEach, vi } from 'vitest'
import { parseNaturalDate, parseNaturalDateDetailed } from './naturalDateParser'

describe('naturalDateParser', () => {
  // Use a fixed reference date for consistent testing
  const referenceDate = new Date('2026-02-15T12:00:00')

  describe('parseNaturalDate', () => {
    it('should return null for empty string', () => {
      const result = parseNaturalDate('')

      expect(result).toBeNull()
    })

    it('should return null for whitespace-only string', () => {
      const result = parseNaturalDate('   ')

      expect(result).toBeNull()
    })

    it('should parse "tomorrow" relative to reference date', () => {
      const result = parseNaturalDate('tomorrow', referenceDate)

      expect(result).toBeInstanceOf(Date)
      expect(result?.getDate()).toBe(16) // Day after reference date
      expect(result?.getMonth()).toBe(1) // February (0-indexed)
    })

    it('should parse "today"', () => {
      const result = parseNaturalDate('today', referenceDate)

      expect(result).toBeInstanceOf(Date)
      expect(result?.getDate()).toBe(15)
    })

    it('should parse "yesterday"', () => {
      const result = parseNaturalDate('yesterday', referenceDate)

      expect(result).toBeInstanceOf(Date)
      expect(result?.getDate()).toBe(14)
    })

    it('should parse "next week"', () => {
      const result = parseNaturalDate('next week', referenceDate)

      expect(result).toBeInstanceOf(Date)
      // Should be roughly 7 days from reference
      const daysDiff = Math.floor((result!.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24))
      expect(daysDiff).toBeGreaterThanOrEqual(6)
      expect(daysDiff).toBeLessThanOrEqual(8)
    })

    it('should parse "in 3 days"', () => {
      const result = parseNaturalDate('in 3 days', referenceDate)

      expect(result).toBeInstanceOf(Date)
      expect(result?.getDate()).toBe(18) // 3 days after Feb 15
    })

    it('should parse specific date like "March 1"', () => {
      const result = parseNaturalDate('March 1', referenceDate)

      expect(result).toBeInstanceOf(Date)
      expect(result?.getMonth()).toBe(2) // March (0-indexed)
      expect(result?.getDate()).toBe(1)
    })

    it('should parse "next Friday"', () => {
      const result = parseNaturalDate('next Friday', referenceDate)

      expect(result).toBeInstanceOf(Date)
      // Should be a Friday
      expect(result?.getDay()).toBe(5) // Friday is day 5
    })

    it('should parse time expressions like "3pm"', () => {
      const result = parseNaturalDate('3pm', referenceDate)

      expect(result).toBeInstanceOf(Date)
      expect(result?.getHours()).toBe(15) // 3pm = 15:00
    })

    it('should parse combined date and time "tomorrow at 3pm"', () => {
      const result = parseNaturalDate('tomorrow at 3pm', referenceDate)

      expect(result).toBeInstanceOf(Date)
      expect(result?.getDate()).toBe(16)
      expect(result?.getHours()).toBe(15)
    })

    it('should use current date when no reference date provided', () => {
      const result = parseNaturalDate('tomorrow')

      expect(result).toBeInstanceOf(Date)
      // Should be tomorrow from now
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      expect(result?.getDate()).toBe(tomorrow.getDate())
    })

    it('should return null for unparseable text', () => {
      const result = parseNaturalDate('asdfghjkl', referenceDate)

      expect(result).toBeNull()
    })
  })

  describe('parseNaturalDateDetailed', () => {
    it('should return null for empty string', () => {
      const result = parseNaturalDateDetailed('')

      expect(result).toBeNull()
    })

    it('should return null for whitespace-only string', () => {
      const result = parseNaturalDateDetailed('   ')

      expect(result).toBeNull()
    })

    it('should parse single date with start only', () => {
      const result = parseNaturalDateDetailed('tomorrow', referenceDate)

      expect(result).not.toBeNull()
      expect(result?.start).toBeInstanceOf(Date)
      expect(result?.start?.getDate()).toBe(16)
      expect(result?.end).toBeNull()
      expect(result?.text).toBe('tomorrow')
    })

    it('should parse date range with start and end', () => {
      const result = parseNaturalDateDetailed('from Monday to Friday', referenceDate)

      expect(result).not.toBeNull()
      expect(result?.start).toBeInstanceOf(Date)
      expect(result?.end).toBeInstanceOf(Date)
      expect(result?.start?.getDay()).toBe(1) // Monday
      expect(result?.end?.getDay()).toBe(5) // Friday
    })

    it('should extract matched text', () => {
      const result = parseNaturalDateDetailed('meeting tomorrow at 3pm with John', referenceDate)

      expect(result).not.toBeNull()
      expect(result?.text).toContain('tomorrow')
      expect(result?.start).toBeInstanceOf(Date)
    })

    it('should handle time ranges', () => {
      const result = parseNaturalDateDetailed('tomorrow from 9am to 5pm', referenceDate)

      expect(result).not.toBeNull()
      expect(result?.start).toBeInstanceOf(Date)
      expect(result?.end).toBeInstanceOf(Date)
      expect(result?.start?.getHours()).toBe(9)
      expect(result?.end?.getHours()).toBe(17) // 5pm = 17:00
    })

    it('should use reference date when provided', () => {
      const result = parseNaturalDateDetailed('tomorrow', referenceDate)

      expect(result?.start?.getDate()).toBe(16) // Day after reference
    })

    it('should return null for unparseable text', () => {
      const result = parseNaturalDateDetailed('xyz123', referenceDate)

      expect(result).toBeNull()
    })

    it('should handle "next week" with date context', () => {
      const result = parseNaturalDateDetailed('next week', referenceDate)

      expect(result).not.toBeNull()
      expect(result?.start).toBeInstanceOf(Date)
      expect(result?.text).toBe('next week')
    })

    it('should parse multiple dates and return first match', () => {
      const result = parseNaturalDateDetailed('tomorrow and next week', referenceDate)

      expect(result).not.toBeNull()
      expect(result?.start).toBeInstanceOf(Date)
      // Should match the first date expression
      expect(result?.start?.getDate()).toBe(16) // tomorrow
    })
  })

  describe('Integration - common use cases', () => {
    it('should handle typical task deadline input', () => {
      const inputs = [
        'tomorrow',
        'next Monday',
        'in 2 weeks',
        'March 15',
        'tomorrow at 3pm',
      ]

      inputs.forEach(input => {
        const result = parseNaturalDate(input, referenceDate)
        expect(result).toBeInstanceOf(Date)
      })
    })

    it('should handle meeting date ranges', () => {
      const input = 'Monday to Friday'
      const result = parseNaturalDateDetailed(input, referenceDate)

      expect(result).not.toBeNull()
      expect(result?.start).toBeInstanceOf(Date)
      expect(result?.end).toBeInstanceOf(Date)
    })

    it('should extract date from natural text', () => {
      const input = 'Call client tomorrow at 2pm'
      const result = parseNaturalDateDetailed(input, referenceDate)

      expect(result).not.toBeNull()
      expect(result?.start).toBeInstanceOf(Date)
      expect(result?.start?.getDate()).toBe(16)
      expect(result?.start?.getHours()).toBe(14)
    })
  })
})
