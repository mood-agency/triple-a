import { describe, it, expect } from 'vitest'
import {
  isValidYouTubeUrl,
  extractVideoId,
  buildVideoUrl,
  buildThumbnailUrl,
  formatDuration,
  truncateText,
  estimateReadingTime,
  cleanTranscriptionText,
} from '../youtubeUtils'

describe('isValidYouTubeUrl', () => {
  it('accepts standard watch URL', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
  })

  it('accepts short URL', () => {
    expect(isValidYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
  })

  it('accepts embed URL', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true)
  })

  it('accepts shorts URL', () => {
    expect(isValidYouTubeUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe(true)
  })

  it('accepts mobile URL', () => {
    expect(isValidYouTubeUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
  })

  it('accepts URL without https', () => {
    expect(isValidYouTubeUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
  })

  it('rejects non-YouTube URLs', () => {
    expect(isValidYouTubeUrl('https://evil.com/watch?v=dQw4w9WgXcQ')).toBe(false)
  })

  it('rejects random strings', () => {
    expect(isValidYouTubeUrl('not a url at all')).toBe(false)
  })

  it('rejects empty string', () => {
    expect(isValidYouTubeUrl('')).toBe(false)
  })
})

describe('extractVideoId', () => {
  it('extracts from standard watch URL', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from short URL', () => {
    expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from embed URL', () => {
    expect(extractVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from shorts URL', () => {
    expect(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extracts from mobile URL', () => {
    expect(extractVideoId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('returns null for non-YouTube URL', () => {
    expect(extractVideoId('https://evil.com/watch?v=dQw4w9WgXcQ')).toBeNull()
  })

  it('returns null for invalid video ID length', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=short')).toBeNull()
  })

  it('handles URLs with extra query params', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe('dQw4w9WgXcQ')
  })

  it('handles video IDs with hyphens and underscores', () => {
    expect(extractVideoId('https://www.youtube.com/watch?v=abc-_efg-12')).toBe('abc-_efg-12')
  })
})

describe('buildVideoUrl', () => {
  it('builds standard watch URL', () => {
    expect(buildVideoUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ')
  })
})

describe('buildThumbnailUrl', () => {
  it('builds high quality thumbnail by default', () => {
    expect(buildThumbnailUrl('dQw4w9WgXcQ')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
  })

  it('builds default quality thumbnail', () => {
    expect(buildThumbnailUrl('dQw4w9WgXcQ', 'default')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg')
  })

  it('builds medium quality thumbnail', () => {
    expect(buildThumbnailUrl('dQw4w9WgXcQ', 'medium')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg')
  })

  it('builds maxres quality thumbnail', () => {
    expect(buildThumbnailUrl('dQw4w9WgXcQ', 'maxres')).toBe('https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg')
  })
})

describe('formatDuration', () => {
  it('formats hours, minutes, seconds', () => {
    expect(formatDuration('PT1H30M45S')).toBe('1:30:45')
  })

  it('formats minutes and seconds only', () => {
    expect(formatDuration('PT10M30S')).toBe('10:30')
  })

  it('formats seconds only', () => {
    expect(formatDuration('PT45S')).toBe('0:45')
  })

  it('formats hours only', () => {
    expect(formatDuration('PT2H')).toBe('2:00:00')
  })

  it('pads single digit minutes with hours', () => {
    expect(formatDuration('PT1H5M3S')).toBe('1:05:03')
  })

  it('pads single digit seconds', () => {
    expect(formatDuration('PT5M3S')).toBe('5:03')
  })

  it('returns original string for invalid format', () => {
    expect(formatDuration('invalid')).toBe('invalid')
  })

  it('handles zero duration', () => {
    expect(formatDuration('PT0S')).toBe('0:00')
  })
})

describe('truncateText', () => {
  it('returns text unchanged if under max length', () => {
    expect(truncateText('short', 100)).toBe('short')
  })

  it('truncates and adds ellipsis', () => {
    expect(truncateText('this is a longer text', 10)).toBe('this is...')
  })

  it('returns text at exact max length unchanged', () => {
    expect(truncateText('exact', 5)).toBe('exact')
  })
})

describe('estimateReadingTime', () => {
  it('returns 1 minute for short text', () => {
    expect(estimateReadingTime('hello world')).toBe(1)
  })

  it('estimates based on 200 words per minute', () => {
    const words = Array(400).fill('word').join(' ')
    expect(estimateReadingTime(words)).toBe(2)
  })

  it('rounds up to nearest minute', () => {
    const words = Array(201).fill('word').join(' ')
    expect(estimateReadingTime(words)).toBe(2)
  })
})

describe('cleanTranscriptionText', () => {
  it('collapses excessive newlines', () => {
    expect(cleanTranscriptionText('a\n\n\n\nb')).toBe('a\n\nb')
  })

  it('collapses multiple spaces', () => {
    expect(cleanTranscriptionText('a   b')).toBe('a b')
  })

  it('trims whitespace', () => {
    expect(cleanTranscriptionText('  hello  ')).toBe('hello')
  })

  it('collapses tabs to single space', () => {
    expect(cleanTranscriptionText("a\t\tb")).toBe('a b')
  })
})
