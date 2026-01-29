import { describe, it, expect } from 'vitest'
import { decodeHtmlEntities, parseJsonResponse, extractEmail } from '../../lib/server-helpers.js'

describe('decodeHtmlEntities', () => {
  it('decodes &amp;', () => {
    expect(decodeHtmlEntities('A &amp; B')).toBe('A & B')
  })

  it('decodes &lt; and &gt;', () => {
    expect(decodeHtmlEntities('&lt;div&gt;')).toBe('<div>')
  })

  it('decodes &quot;', () => {
    expect(decodeHtmlEntities('He said &quot;hello&quot;')).toBe('He said "hello"')
  })

  it('decodes &#39; (numeric apostrophe)', () => {
    expect(decodeHtmlEntities('it&#39;s')).toBe("it's")
  })

  it('decodes &apos;', () => {
    expect(decodeHtmlEntities("it&apos;s")).toBe("it's")
  })

  it('decodes numeric character references', () => {
    expect(decodeHtmlEntities('&#65;')).toBe('A') // ASCII 65 = 'A'
  })

  it('decodes multiple entities in one string', () => {
    expect(decodeHtmlEntities('&lt;a&gt; &amp; &quot;b&quot;')).toBe('<a> & "b"')
  })

  it('returns plain text unchanged', () => {
    expect(decodeHtmlEntities('Hello World')).toBe('Hello World')
  })

  it('handles empty string', () => {
    expect(decodeHtmlEntities('')).toBe('')
  })
})

describe('parseJsonResponse', () => {
  it('parses raw JSON string', () => {
    const input = '{"summary":"Test","keyPoints":["a"],"topics":["b"]}'
    const result = parseJsonResponse(input)
    expect(result.summary).toBe('Test')
    expect(result.keyPoints).toEqual(['a'])
    expect(result.topics).toEqual(['b'])
  })

  it('extracts JSON from markdown code block', () => {
    const input = '```json\n{"summary":"Test","keyPoints":[],"topics":[]}\n```'
    const result = parseJsonResponse(input)
    expect(result.summary).toBe('Test')
  })

  it('extracts JSON from code block without json tag', () => {
    const input = '```\n{"summary":"Test","keyPoints":[],"topics":[]}\n```'
    const result = parseJsonResponse(input)
    expect(result.summary).toBe('Test')
  })

  it('returns fallback for invalid JSON', () => {
    const input = 'This is not valid JSON at all'
    const result = parseJsonResponse(input)
    expect(result.summary).toBe(input)
    expect(result.keyPoints).toEqual([])
    expect(result.topics).toEqual([])
  })

  it('handles JSON with whitespace', () => {
    const input = '  {"summary":"Spaced","keyPoints":[],"topics":[]}  '
    const result = parseJsonResponse(input)
    expect(result.summary).toBe('Spaced')
  })

  it('handles code block with surrounding text', () => {
    const input = 'Here is the result:\n```json\n{"summary":"Result","keyPoints":[],"topics":[]}\n```\nDone.'
    const result = parseJsonResponse(input)
    expect(result.summary).toBe('Result')
  })
})

describe('extractEmail', () => {
  it('extracts email from bracketed format', () => {
    expect(extractEmail('John Doe <john@example.com>')).toBe('john@example.com')
  })

  it('extracts bare email address', () => {
    expect(extractEmail('john@example.com')).toBe('john@example.com')
  })

  it('lowercases email', () => {
    expect(extractEmail('JOHN@EXAMPLE.COM')).toBe('john@example.com')
  })

  it('lowercases bracketed email', () => {
    expect(extractEmail('John <JOHN@Example.COM>')).toBe('john@example.com')
  })

  it('returns null for null input', () => {
    expect(extractEmail(null)).toBeNull()
  })

  it('returns null for undefined input', () => {
    expect(extractEmail(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(extractEmail('')).toBeNull()
  })

  it('returns null for plain name without email', () => {
    expect(extractEmail('John Doe')).toBeNull()
  })

  it('handles email with subdomain', () => {
    expect(extractEmail('user@mail.example.com')).toBe('user@mail.example.com')
  })

  it('handles bracketed email with display name containing special chars', () => {
    expect(extractEmail('"Doe, John" <john@example.com>')).toBe('john@example.com')
  })

  it('returns null for whitespace-padded bare email (regex requires exact match)', () => {
    // Note: the regex uses ^ and $ anchors, so whitespace causes no match.
    // Bracketed format still works with surrounding whitespace.
    expect(extractEmail('  john@example.com  ')).toBeNull()
  })

  it('handles whitespace around bracketed email', () => {
    expect(extractEmail('  John <john@example.com>  ')).toBe('john@example.com')
  })
})
