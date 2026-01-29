import { describe, it, expect } from 'vitest'
import { parseTextWithLinks, containsUrl, extractUrls } from '../linkify'

describe('parseTextWithLinks', () => {
  it('returns empty array for empty string', () => {
    expect(parseTextWithLinks('')).toEqual([])
  })

  it('returns empty array for null/undefined', () => {
    expect(parseTextWithLinks(null as unknown as string)).toEqual([])
    expect(parseTextWithLinks(undefined as unknown as string)).toEqual([])
  })

  it('returns single text segment for text without URLs', () => {
    const result = parseTextWithLinks('Hello, world!')
    expect(result).toEqual([{ type: 'text', value: 'Hello, world!' }])
  })

  it('parses single URL in text', () => {
    const result = parseTextWithLinks('Check https://example.com for more')
    expect(result).toEqual([
      { type: 'text', value: 'Check ' },
      { type: 'link', value: 'https://example.com' },
      { type: 'text', value: ' for more' },
    ])
  })

  it('parses URL at the start of text', () => {
    const result = parseTextWithLinks('https://example.com is great')
    expect(result).toEqual([
      { type: 'link', value: 'https://example.com' },
      { type: 'text', value: ' is great' },
    ])
  })

  it('parses URL at the end of text', () => {
    const result = parseTextWithLinks('Visit https://example.com')
    expect(result).toEqual([
      { type: 'text', value: 'Visit ' },
      { type: 'link', value: 'https://example.com' },
    ])
  })

  it('parses multiple URLs', () => {
    const result = parseTextWithLinks('See https://a.com and https://b.com')
    expect(result).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'https://a.com' },
      { type: 'text', value: ' and ' },
      { type: 'link', value: 'https://b.com' },
    ])
  })

  it('handles URL-only text', () => {
    const result = parseTextWithLinks('https://example.com')
    expect(result).toEqual([{ type: 'link', value: 'https://example.com' }])
  })

  it('parses http URLs', () => {
    const result = parseTextWithLinks('Check http://example.com')
    expect(result).toEqual([
      { type: 'text', value: 'Check ' },
      { type: 'link', value: 'http://example.com' },
    ])
  })

  it('parses URLs with paths', () => {
    const result = parseTextWithLinks('See https://example.com/path/to/page')
    expect(result).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'https://example.com/path/to/page' },
    ])
  })

  it('parses URLs with query parameters', () => {
    const result = parseTextWithLinks('Link: https://example.com?foo=bar&baz=qux')
    expect(result).toEqual([
      { type: 'text', value: 'Link: ' },
      { type: 'link', value: 'https://example.com?foo=bar&baz=qux' },
    ])
  })

  it('parses URLs with hash fragments', () => {
    const result = parseTextWithLinks('Goto https://example.com#section')
    expect(result).toEqual([
      { type: 'text', value: 'Goto ' },
      { type: 'link', value: 'https://example.com#section' },
    ])
  })

  it('handles URLs with port numbers', () => {
    const result = parseTextWithLinks('Dev: https://localhost:3000/app')
    expect(result).toEqual([
      { type: 'text', value: 'Dev: ' },
      { type: 'link', value: 'https://localhost:3000/app' },
    ])
  })

  it('stops URL at trailing punctuation', () => {
    const result = parseTextWithLinks('Visit https://example.com.')
    expect(result).toEqual([
      { type: 'text', value: 'Visit ' },
      { type: 'link', value: 'https://example.com' },
      { type: 'text', value: '.' },
    ])
  })

  it('stops URL at trailing comma', () => {
    const result = parseTextWithLinks('See https://a.com, https://b.com')
    expect(result).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'link', value: 'https://a.com' },
      { type: 'text', value: ', ' },
      { type: 'link', value: 'https://b.com' },
    ])
  })

  it('handles consecutive calls correctly (regex state reset)', () => {
    const result1 = parseTextWithLinks('https://first.com')
    const result2 = parseTextWithLinks('https://second.com')

    expect(result1).toEqual([{ type: 'link', value: 'https://first.com' }])
    expect(result2).toEqual([{ type: 'link', value: 'https://second.com' }])
  })

  it('does not match non-URLs', () => {
    const result = parseTextWithLinks('email@example.com is not a URL')
    expect(result).toEqual([{ type: 'text', value: 'email@example.com is not a URL' }])
  })

  it('does not match ftp:// URLs', () => {
    const result = parseTextWithLinks('Check ftp://example.com')
    expect(result).toEqual([{ type: 'text', value: 'Check ftp://example.com' }])
  })
})

describe('containsUrl', () => {
  it('returns false for empty string', () => {
    expect(containsUrl('')).toBe(false)
  })

  it('returns false for text without URLs', () => {
    expect(containsUrl('Hello, world!')).toBe(false)
  })

  it('returns true for text with https URL', () => {
    expect(containsUrl('Visit https://example.com')).toBe(true)
  })

  it('returns true for text with http URL', () => {
    expect(containsUrl('Visit http://example.com')).toBe(true)
  })

  it('returns false for text with only email', () => {
    expect(containsUrl('Contact me@example.com')).toBe(false)
  })

  it('handles consecutive calls correctly (regex state reset)', () => {
    expect(containsUrl('https://example.com')).toBe(true)
    expect(containsUrl('no url here')).toBe(false)
    expect(containsUrl('https://another.com')).toBe(true)
  })
})

describe('extractUrls', () => {
  it('returns empty array for empty string', () => {
    expect(extractUrls('')).toEqual([])
  })

  it('returns empty array for text without URLs', () => {
    expect(extractUrls('Hello, world!')).toEqual([])
  })

  it('extracts single URL', () => {
    expect(extractUrls('Visit https://example.com today')).toEqual(['https://example.com'])
  })

  it('extracts multiple URLs', () => {
    expect(extractUrls('See https://a.com and https://b.com')).toEqual([
      'https://a.com',
      'https://b.com',
    ])
  })

  it('extracts URL with path', () => {
    expect(extractUrls('Go to https://example.com/page/1')).toEqual([
      'https://example.com/page/1',
    ])
  })

  it('extracts URL with query string', () => {
    expect(extractUrls('Link: https://example.com?id=123')).toEqual([
      'https://example.com?id=123',
    ])
  })

  it('handles consecutive calls correctly (regex state reset)', () => {
    expect(extractUrls('https://first.com')).toEqual(['https://first.com'])
    expect(extractUrls('https://second.com')).toEqual(['https://second.com'])
  })
})
