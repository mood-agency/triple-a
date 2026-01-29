import { describe, it, expect } from 'vitest'
import { parseNaturalDate, parseNaturalDateDetailed } from '../naturalDateParser'

describe('parseNaturalDate', () => {
  it('returns null for empty string', () => {
    expect(parseNaturalDate('')).toBeNull()
  })

  it('returns null for whitespace-only string', () => {
    expect(parseNaturalDate('   ')).toBeNull()
  })

  it('parses "tomorrow"', () => {
    const ref = new Date(2026, 0, 15) // Jan 15, 2026
    const result = parseNaturalDate('tomorrow', ref)
    expect(result).not.toBeNull()
    expect(result!.getDate()).toBe(16)
  })

  it('parses "next friday"', () => {
    const ref = new Date(2026, 0, 12) // Monday Jan 12
    const result = parseNaturalDate('next friday', ref)
    expect(result).not.toBeNull()
    expect(result!.getDay()).toBe(5) // Friday
  })

  it('parses "in 3 days"', () => {
    const ref = new Date(2026, 0, 15)
    const result = parseNaturalDate('in 3 days', ref)
    expect(result).not.toBeNull()
    expect(result!.getDate()).toBe(18)
  })

  it('parses a specific date like "Aug 17"', () => {
    const ref = new Date(2026, 0, 1)
    const result = parseNaturalDate('Aug 17', ref)
    expect(result).not.toBeNull()
    expect(result!.getMonth()).toBe(7) // August
    expect(result!.getDate()).toBe(17)
  })

  it('returns null for nonsense text', () => {
    const result = parseNaturalDate('xyzzy foobar')
    expect(result).toBeNull()
  })
})

describe('parseNaturalDateDetailed', () => {
  it('returns null for empty string', () => {
    expect(parseNaturalDateDetailed('')).toBeNull()
  })

  it('returns null for whitespace string', () => {
    expect(parseNaturalDateDetailed('  ')).toBeNull()
  })

  it('returns object with start date', () => {
    const ref = new Date(2026, 0, 15)
    const result = parseNaturalDateDetailed('tomorrow', ref)
    expect(result).not.toBeNull()
    expect(result!.start).not.toBeNull()
    expect(result!.text).toBe('tomorrow')
  })

  it('returns null for non-date text', () => {
    const result = parseNaturalDateDetailed('random words')
    expect(result).toBeNull()
  })
})
