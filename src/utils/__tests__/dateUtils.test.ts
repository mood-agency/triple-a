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
} from '../dateUtils'

describe('parseLocalDate', () => {
  it('parses YYYY-MM-DD as local date', () => {
    const date = parseLocalDate('2026-01-15')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(0) // January is 0
    expect(date.getDate()).toBe(15)
  })

  it('parses date at midnight local time (no time shift)', () => {
    const date = parseLocalDate('2026-02-28')
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
    expect(date.getSeconds()).toBe(0)
  })

  it('parses ISO timestamp with T but no timezone as local time', () => {
    const date = parseLocalDate('2026-01-15T14:30:00')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(0)
    expect(date.getDate()).toBe(15)
    expect(date.getHours()).toBe(14)
    expect(date.getMinutes()).toBe(30)
  })

  it('parses UTC timestamp ending with Z', () => {
    const date = parseLocalDate('2026-01-15T00:00:00Z')
    // This will be converted to local time, so the exact date/hour
    // depends on the timezone the test runs in. Just verify it's a valid date.
    expect(date.getTime()).not.toBeNaN()
  })

  it('parses timestamp with timezone offset', () => {
    const date = parseLocalDate('2026-01-15T12:00:00+05:00')
    expect(date.getTime()).not.toBeNaN()
  })

  it('handles time component with hours and minutes only', () => {
    const date = parseLocalDate('2026-03-10T09:45')
    expect(date.getHours()).toBe(9)
    expect(date.getMinutes()).toBe(45)
  })

  it('falls back to native parsing for unexpected formats', () => {
    const date = parseLocalDate('January 15, 2026')
    expect(date.getTime()).not.toBeNaN()
  })

  it('returns invalid date for garbage input', () => {
    const date = parseLocalDate('not-a-date')
    expect(isNaN(date.getTime())).toBe(true)
  })

  it('correctly handles month boundaries', () => {
    const date = parseLocalDate('2026-12-31')
    expect(date.getMonth()).toBe(11) // December
    expect(date.getDate()).toBe(31)
  })

  it('handles leap year date', () => {
    const date = parseLocalDate('2024-02-29')
    expect(date.getMonth()).toBe(1) // February
    expect(date.getDate()).toBe(29)
  })
})

describe('formatLocalDate', () => {
  it('formats date to YYYY-MM-DD', () => {
    const date = new Date(2026, 0, 15) // Jan 15, 2026
    expect(formatLocalDate(date)).toBe('2026-01-15')
  })

  it('zero-pads single-digit months and days', () => {
    const date = new Date(2026, 2, 5) // March 5
    expect(formatLocalDate(date)).toBe('2026-03-05')
  })

  it('formats December 31 correctly', () => {
    const date = new Date(2026, 11, 31)
    expect(formatLocalDate(date)).toBe('2026-12-31')
  })

  it('roundtrips with parseLocalDate', () => {
    const original = '2026-07-20'
    const parsed = parseLocalDate(original)
    expect(formatLocalDate(parsed)).toBe(original)
  })
})

describe('startOfDay', () => {
  it('sets time to 00:00:00.000', () => {
    const date = new Date(2026, 0, 15, 14, 30, 45, 500)
    const result = startOfDay(date)
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
    expect(result.getMilliseconds()).toBe(0)
  })

  it('does not mutate the original date', () => {
    const date = new Date(2026, 0, 15, 14, 30)
    startOfDay(date)
    expect(date.getHours()).toBe(14)
  })

  it('preserves the date portion', () => {
    const date = new Date(2026, 5, 20, 23, 59, 59)
    const result = startOfDay(date)
    expect(result.getFullYear()).toBe(2026)
    expect(result.getMonth()).toBe(5)
    expect(result.getDate()).toBe(20)
  })
})

describe('endOfDay', () => {
  it('sets time to 23:59:59.999', () => {
    const date = new Date(2026, 0, 15, 0, 0, 0, 0)
    const result = endOfDay(date)
    expect(result.getHours()).toBe(23)
    expect(result.getMinutes()).toBe(59)
    expect(result.getSeconds()).toBe(59)
    expect(result.getMilliseconds()).toBe(999)
  })

  it('does not mutate the original date', () => {
    const date = new Date(2026, 0, 15, 8, 0)
    endOfDay(date)
    expect(date.getHours()).toBe(8)
  })
})

describe('getLocalDateKey', () => {
  it('returns YYYY-MM-DD for date-only string', () => {
    expect(getLocalDateKey('2026-01-15')).toBe('2026-01-15')
  })

  it('returns local date key for datetime string', () => {
    const key = getLocalDateKey('2026-01-15T14:30:00')
    expect(key).toBe('2026-01-15')
  })
})

describe('hasTimeComponent', () => {
  it('returns false for date-only string', () => {
    expect(hasTimeComponent('2026-01-15')).toBe(false)
  })

  it('returns false for midnight datetime', () => {
    expect(hasTimeComponent('2026-01-15T00:00:00')).toBe(false)
  })

  it('returns true for non-midnight time', () => {
    expect(hasTimeComponent('2026-01-15T14:30:00')).toBe(true)
  })

  it('returns true for time with only minutes', () => {
    expect(hasTimeComponent('2026-01-15T00:15:00')).toBe(true)
  })
})

describe('getHourFromDeadline', () => {
  it('returns hour from local datetime', () => {
    expect(getHourFromDeadline('2026-01-15T14:30:00')).toBe(14)
  })

  it('returns 0 for date-only string', () => {
    expect(getHourFromDeadline('2026-01-15')).toBe(0)
  })
})

describe('getMinutesFromDeadline', () => {
  it('returns minutes from local datetime', () => {
    expect(getMinutesFromDeadline('2026-01-15T14:45:00')).toBe(45)
  })

  it('returns 0 for date-only string', () => {
    expect(getMinutesFromDeadline('2026-01-15')).toBe(0)
  })
})
