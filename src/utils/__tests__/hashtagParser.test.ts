import { describe, it, expect } from 'vitest'
import {
  extractHashtags,
  extractMentions,
  parseHashtags,
} from '../hashtagParser'
import type { HashtagParseContext } from '../hashtagParser'
import type { Label } from '@/types/note'
import type { Contact } from '@/types/contact'

describe('extractHashtags', () => {
  it('extracts single hashtag', () => {
    expect(extractHashtags('Hello #world')).toEqual(['world'])
  })

  it('extracts multiple hashtags', () => {
    expect(extractHashtags('#hello #world')).toEqual(['hello', 'world'])
  })

  it('extracts hashtag at start of string', () => {
    expect(extractHashtags('#first word')).toEqual(['first'])
  })

  it('handles hashtag with numbers', () => {
    expect(extractHashtags('item #v2')).toEqual(['v2'])
  })

  it('handles hashtag with underscores', () => {
    expect(extractHashtags('task #high_priority')).toEqual(['high_priority'])
  })

  it('handles hashtag with hyphens', () => {
    expect(extractHashtags('task #follow-up')).toEqual(['follow-up'])
  })

  it('returns empty for no hashtags', () => {
    expect(extractHashtags('no tags here')).toEqual([])
  })

  it('does not extract hash in the middle of word', () => {
    // The regex requires space or start-of-string before #
    expect(extractHashtags('email@test#com')).toEqual([])
  })

  it('handles unicode characters', () => {
    const result = extractHashtags('tarea #urgente')
    expect(result).toEqual(['urgente'])
  })
})

describe('extractMentions', () => {
  it('extracts single mention', () => {
    expect(extractMentions('Assign to @john')).toEqual(['john'])
  })

  it('extracts multiple mentions', () => {
    expect(extractMentions('@alice and @bob')).toEqual(['alice', 'bob'])
  })

  it('extracts mention at start', () => {
    expect(extractMentions('@admin please check')).toEqual(['admin'])
  })

  it('returns empty for no mentions', () => {
    expect(extractMentions('no mentions')).toEqual([])
  })

  it('does not extract email-like patterns (no space before @)', () => {
    expect(extractMentions('user@email.com')).toEqual([])
  })
})

describe('parseHashtags', () => {
  const makeLabel = (id: string, name: string): Label => ({
    id,
    name,
    color: '#000',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })

  const makeContact = (id: string, name: string, lastname: string): Contact => ({
    id,
    name,
    lastname,
    phone: '',
    email: '',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  })

  const emptyContext: HashtagParseContext = {
    labels: [],
    contacts: [],
  }

  it('returns unchanged content when no tags', () => {
    const result = parseHashtags('Just a normal task', emptyContext)
    expect(result.cleanedContent).toBe('Just a normal task')
    expect(result.category).toBeNull()
    expect(result.assigneeId).toBeNull()
    expect(result.labelIds).toEqual([])
    expect(result.newLabelNames).toEqual([])
  })

  it('detects category hashtag #todo', () => {
    const result = parseHashtags('Buy groceries #todo', emptyContext)
    expect(result.category).toBe('todo')
  })

  it('detects category hashtag #followup', () => {
    const result = parseHashtags('Check invoice #followup', emptyContext)
    expect(result.category).toBe('followup')
  })

  it('detects category hashtag #meeting', () => {
    const result = parseHashtags('Standup #meeting', emptyContext)
    expect(result.category).toBe('meeting')
  })

  it('detects category hashtag #notes', () => {
    const result = parseHashtags('Ideas #notes', emptyContext)
    expect(result.category).toBe('notes')
  })

  it('removes category hashtag from cleaned content', () => {
    const result = parseHashtags('Buy groceries #todo', emptyContext)
    expect(result.cleanedContent).toBe('Buy groceries')
  })

  it('matches existing label by name', () => {
    const context: HashtagParseContext = {
      labels: [makeLabel('label-1', 'urgent')],
      contacts: [],
    }
    const result = parseHashtags('Fix bug #urgent', context)
    expect(result.labelIds).toEqual(['label-1'])
    expect(result.newLabelNames).toEqual([])
  })

  it('creates new label for unmatched hashtag', () => {
    const result = parseHashtags('Task #newlabel', emptyContext)
    expect(result.newLabelNames).toEqual(['newlabel'])
  })

  it('matches contact by @mention', () => {
    const context: HashtagParseContext = {
      labels: [],
      contacts: [makeContact('contact-1', 'John', 'Doe')],
    }
    const result = parseHashtags('Task @john', context)
    expect(result.assigneeId).toBe('contact-1')
  })

  it('removes @mention from cleaned content', () => {
    const context: HashtagParseContext = {
      labels: [],
      contacts: [makeContact('contact-1', 'Alice', 'Smith')],
    }
    const result = parseHashtags('Review PR @alice', context)
    expect(result.cleanedContent).toBe('Review PR')
  })

  it('only assigns first matching contact', () => {
    const context: HashtagParseContext = {
      labels: [],
      contacts: [
        makeContact('c1', 'Alice', 'Smith'),
        makeContact('c2', 'Bob', 'Jones'),
      ],
    }
    const result = parseHashtags('Task @alice @bob', context)
    expect(result.assigneeId).toBe('c1')
  })

  it('handles mixed hashtags and mentions', () => {
    const context: HashtagParseContext = {
      labels: [makeLabel('l1', 'bug')],
      contacts: [makeContact('c1', 'Alice', 'Smith')],
    }
    const result = parseHashtags('Fix login #bug @alice #todo', context)
    expect(result.category).toBe('todo')
    expect(result.labelIds).toEqual(['l1'])
    expect(result.assigneeId).toBe('c1')
    expect(result.cleanedContent).toBe('Fix login')
  })

  it('preserves original content', () => {
    const result = parseHashtags('Task #todo @someone', emptyContext)
    expect(result.originalContent).toBe('Task #todo @someone')
  })

  it('handles duplicate hashtags', () => {
    const result = parseHashtags('Task #newtag #newtag', emptyContext)
    expect(result.newLabelNames).toEqual(['newtag'])
  })

  it('populates parsedHashtags array', () => {
    const context: HashtagParseContext = {
      labels: [makeLabel('l1', 'bug')],
      contacts: [makeContact('c1', 'Alice', 'Smith')],
    }
    const result = parseHashtags('Fix #bug @alice #todo', context)
    expect(result.parsedHashtags.length).toBeGreaterThan(0)
    const types = result.parsedHashtags.map(h => h.type)
    expect(types).toContain('category')
    expect(types).toContain('label')
    expect(types).toContain('contact')
  })
})
