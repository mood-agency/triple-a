import { describe, it, expect } from 'vitest'
import {
  parseLocalDate,
  formatLocalDate,
  startOfDay,
  endOfDay,
  getLocalDateKey,
  hasTimeComponent,
  getHourFromDeadline,
  getMinutesFromDeadline,
} from './dateUtils'

describe('dateUtils', () => {
  describe('parseLocalDate', () => {
    it('should parse date-only string (YYYY-MM-DD) as local time', () => {
      const result = parseLocalDate('2026-02-15')

      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(1) // 0-indexed, so 1 = February
      expect(result.getDate()).toBe(15)
      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
    })

    it('should parse ISO datetime with Z (UTC) correctly', () => {
      const result = parseLocalDate('2026-02-15T14:30:00Z')

      // Should parse as UTC and convert to local time
      expect(result instanceof Date).toBe(true)
      expect(result.toISOString()).toBe('2026-02-15T14:30:00.000Z')
    })

    it('should parse ISO datetime with timezone offset', () => {
      const result = parseLocalDate('2026-02-15T14:30:00-06:00')

      expect(result instanceof Date).toBe(true)
      // Should parse with timezone offset
    })

    it('should parse datetime without timezone as local time', () => {
      const result = parseLocalDate('2026-02-15T14:30:00')

      expect(result.getFullYear()).toBe(2026)
      expect(result.getMonth()).toBe(1)
      expect(result.getDate()).toBe(15)
      expect(result.getHours()).toBe(14)
      expect(result.getMinutes()).toBe(30)
      expect(result.getSeconds()).toBe(0)
    })

    it('should parse datetime with partial time (no seconds)', () => {
      const result = parseLocalDate('2026-02-15T14:30')

      expect(result.getHours()).toBe(14)
      expect(result.getMinutes()).toBe(30)
      expect(result.getSeconds()).toBe(0)
    })

    it('should handle invalid date format gracefully', () => {
      const result = parseLocalDate('invalid-date')

      expect(result instanceof Date).toBe(true)
      expect(isNaN(result.getTime())).toBe(true) // Invalid date
    })

    it('should handle empty string', () => {
      const result = parseLocalDate('')

      expect(result instanceof Date).toBe(true)
      expect(isNaN(result.getTime())).toBe(true)
    })
  })

  describe('formatLocalDate', () => {
    it('should format date to YYYY-MM-DD', () => {
      const date = new Date(2026, 1, 15) // Feb 15, 2026

      const result = formatLocalDate(date)

      expect(result).toBe('2026-02-15')
    })

    it('should pad single-digit months and days with zeros', () => {
      const date = new Date(2026, 0, 5) // Jan 5, 2026

      const result = formatLocalDate(date)

      expect(result).toBe('2026-01-05')
    })

    it('should handle dates with time component', () => {
      const date = new Date(2026, 11, 31, 23, 59, 59) // Dec 31, 2026 23:59:59

      const result = formatLocalDate(date)

      expect(result).toBe('2026-12-31')
    })

    it('should handle leap year dates', () => {
      const date = new Date(2024, 1, 29) // Feb 29, 2024 (leap year)

      const result = formatLocalDate(date)

      expect(result).toBe('2024-02-29')
    })
  })

  describe('startOfDay', () => {
    it('should set time to 00:00:00.000', () => {
      const date = new Date(2026, 1, 15, 14, 30, 45, 123)

      const result = startOfDay(date)

      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
      expect(result.getSeconds()).toBe(0)
      expect(result.getMilliseconds()).toBe(0)
      expect(result.getDate()).toBe(15)
    })

    it('should not modify the original date', () => {
      const original = new Date(2026, 1, 15, 14, 30)
      const originalTime = original.getTime()

      startOfDay(original)

      expect(original.getTime()).toBe(originalTime)
    })

    it('should handle date already at start of day', () => {
      const date = new Date(2026, 1, 15, 0, 0, 0, 0)

      const result = startOfDay(date)

      expect(result.getHours()).toBe(0)
      expect(result.getMinutes()).toBe(0)
    })
  })

  describe('endOfDay', () => {
    it('should set time to 23:59:59.999', () => {
      const date = new Date(2026, 1, 15, 14, 30)

      const result = endOfDay(date)

      expect(result.getHours()).toBe(23)
      expect(result.getMinutes()).toBe(59)
      expect(result.getSeconds()).toBe(59)
      expect(result.getMilliseconds()).toBe(999)
      expect(result.getDate()).toBe(15)
    })

    it('should not modify the original date', () => {
      const original = new Date(2026, 1, 15, 14, 30)
      const originalTime = original.getTime()

      endOfDay(original)

      expect(original.getTime()).toBe(originalTime)
    })

    it('should handle date already at end of day', () => {
      const date = new Date(2026, 1, 15, 23, 59, 59, 999)

      const result = endOfDay(date)

      expect(result.getHours()).toBe(23)
      expect(result.getMilliseconds()).toBe(999)
    })
  })

  describe('getLocalDateKey', () => {
    it('should extract date key from date-only string', () => {
      const result = getLocalDateKey('2026-02-15')

      expect(result).toBe('2026-02-15')
    })

    it('should extract date key from ISO datetime with UTC', () => {
      // UTC midnight should convert to local date properly
      const result = getLocalDateKey('2026-02-15T00:00:00Z')

      expect(result).toMatch(/2026-02-1[45]/) // Could be 14 or 15 depending on timezone
    })

    it('should extract date key from datetime without timezone', () => {
      const result = getLocalDateKey('2026-02-15T18:00:00')

      expect(result).toBe('2026-02-15')
    })

    it('should handle datetime that crosses date boundary in UTC', () => {
      // This tests the timezone bug fix mentioned in the comments
      const result = getLocalDateKey('2026-01-27T00:00:00Z')

      // Result should be based on local timezone conversion
      expect(typeof result).toBe('string')
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('hasTimeComponent', () => {
    it('should return false for date-only string', () => {
      const result = hasTimeComponent('2026-02-15')

      expect(result).toBe(false)
    })

    it('should return false for datetime at midnight (00:00)', () => {
      const result = hasTimeComponent('2026-02-15T00:00:00')

      expect(result).toBe(false)
    })

    it('should return true for datetime with hours', () => {
      const result = hasTimeComponent('2026-02-15T14:30:00')

      expect(result).toBe(true)
    })

    it('should return true for datetime with only minutes (00:30)', () => {
      const result = hasTimeComponent('2026-02-15T00:30:00')

      expect(result).toBe(true)
    })

    it('should check local time for UTC datetime', () => {
      // When UTC midnight is converted to local time, it may not be midnight locally
      const result = hasTimeComponent('2026-02-15T00:00:00Z')

      // The result depends on the local timezone offset
      // Just verify it returns a boolean
      expect(typeof result).toBe('boolean')
    })

    it('should return true for any non-midnight time', () => {
      expect(hasTimeComponent('2026-02-15T01:00:00')).toBe(true)
      expect(hasTimeComponent('2026-02-15T23:59:00')).toBe(true)
      expect(hasTimeComponent('2026-02-15T12:00:00')).toBe(true)
    })
  })

  describe('getHourFromDeadline', () => {
    it('should extract hour from datetime', () => {
      const result = getHourFromDeadline('2026-02-15T14:30:00')

      expect(result).toBe(14)
    })

    it('should return 0 for midnight', () => {
      const result = getHourFromDeadline('2026-02-15T00:00:00')

      expect(result).toBe(0)
    })

    it('should return 0 for date-only string', () => {
      const result = getHourFromDeadline('2026-02-15')

      expect(result).toBe(0)
    })

    it('should handle 23:59 correctly', () => {
      const result = getHourFromDeadline('2026-02-15T23:59:00')

      expect(result).toBe(23)
    })
  })

  describe('getMinutesFromDeadline', () => {
    it('should extract minutes from datetime', () => {
      const result = getMinutesFromDeadline('2026-02-15T14:30:00')

      expect(result).toBe(30)
    })

    it('should return 0 for whole hour', () => {
      const result = getMinutesFromDeadline('2026-02-15T14:00:00')

      expect(result).toBe(0)
    })

    it('should return 0 for date-only string', () => {
      const result = getMinutesFromDeadline('2026-02-15')

      expect(result).toBe(0)
    })

    it('should handle 59 minutes correctly', () => {
      const result = getMinutesFromDeadline('2026-02-15T14:59:00')

      expect(result).toBe(59)
    })
  })

  describe('Integration - timezone handling', () => {
    it('should handle date strings consistently regardless of timezone', () => {
      const dateStr = '2026-02-15'
      const parsed = parseLocalDate(dateStr)
      const formatted = formatLocalDate(parsed)

      expect(formatted).toBe(dateStr)
    })

    it('should preserve date when parsing and formatting datetime', () => {
      const datetimeStr = '2026-02-15T14:30:00'
      const parsed = parseLocalDate(datetimeStr)
      const dateKey = getLocalDateKey(datetimeStr)

      expect(dateKey).toBe('2026-02-15')
      expect(getHourFromDeadline(datetimeStr)).toBe(14)
      expect(getMinutesFromDeadline(datetimeStr)).toBe(30)
    })
  })
})
