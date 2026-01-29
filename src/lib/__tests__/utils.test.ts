import { describe, it, expect } from 'vitest'
import { cn, getInitials } from '../utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('handles undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
  })

  it('merges tailwind classes correctly', () => {
    // twMerge should resolve conflicting classes
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles object syntax', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('handles array syntax', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
  })

  it('handles mixed inputs', () => {
    expect(cn('foo', { bar: true }, ['baz', 'qux'])).toBe('foo bar baz qux')
  })

  it('handles empty inputs', () => {
    expect(cn()).toBe('')
  })

  it('merges conflicting tailwind utilities', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
    expect(cn('bg-white', 'bg-black')).toBe('bg-black')
    expect(cn('m-2', 'm-4')).toBe('m-4')
  })

  it('keeps non-conflicting utilities', () => {
    expect(cn('text-red-500', 'bg-blue-500')).toBe('text-red-500 bg-blue-500')
    expect(cn('px-2', 'py-4')).toBe('px-2 py-4')
  })

  it('handles complex tailwind merges', () => {
    expect(cn('hover:text-red-500', 'hover:text-blue-500')).toBe('hover:text-blue-500')
    expect(cn('md:px-2', 'md:px-4')).toBe('md:px-4')
  })
})

describe('getInitials', () => {
  it('returns first letter of first name when no last name', () => {
    expect(getInitials('John')).toBe('J')
  })

  it('returns first letters of first and last name', () => {
    expect(getInitials('John', 'Doe')).toBe('JD')
  })

  it('handles lowercase names', () => {
    expect(getInitials('john', 'doe')).toBe('JD')
  })

  it('handles mixed case names', () => {
    expect(getInitials('jOHN', 'dOE')).toBe('JD')
  })

  it('trims whitespace from first name', () => {
    expect(getInitials('  John  ')).toBe('J')
  })

  it('trims whitespace from last name', () => {
    expect(getInitials('John', '  Doe  ')).toBe('JD')
  })

  it('handles empty last name', () => {
    expect(getInitials('John', '')).toBe('J')
  })

  it('handles whitespace-only last name', () => {
    expect(getInitials('John', '   ')).toBe('J')
  })

  it('handles undefined last name', () => {
    expect(getInitials('John', undefined)).toBe('J')
  })

  it('handles single character names', () => {
    expect(getInitials('J', 'D')).toBe('JD')
  })

  it('handles accented characters', () => {
    expect(getInitials('José', 'García')).toBe('JG')
  })

  it('handles names with spaces (uses first letter only)', () => {
    // Only first character of first name is used
    expect(getInitials('Mary Jane', 'Watson')).toBe('MW')
  })

  it('returns empty string for empty first name', () => {
    expect(getInitials('')).toBe('')
  })

  it('returns last initial only for whitespace first name', () => {
    expect(getInitials('   ', 'Doe')).toBe('D')
  })
})
