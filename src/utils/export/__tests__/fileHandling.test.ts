import { describe, it, expect } from 'vitest'
import { readFileAsJson } from '../fileHandling'

describe('readFileAsJson', () => {
  it('reads and parses valid JSON file', async () => {
    const jsonData = { name: 'Test', value: 123 }
    const file = new File([JSON.stringify(jsonData)], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toEqual(jsonData)
  })

  it('rejects on invalid JSON', async () => {
    const file = new File(['not valid json'], 'test.json', { type: 'application/json' })

    await expect(readFileAsJson(file)).rejects.toThrow('Invalid JSON file')
  })

  it('handles empty JSON object', async () => {
    const file = new File(['{}'], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toEqual({})
  })

  it('handles empty JSON array', async () => {
    const file = new File(['[]'], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toEqual([])
  })

  it('handles nested JSON structure', async () => {
    const complexData = {
      users: [
        { id: 1, name: 'Alice', settings: { theme: 'dark' } },
        { id: 2, name: 'Bob', settings: { theme: 'light' } },
      ],
      metadata: {
        version: '1.0',
        exportedAt: '2024-01-01',
      },
    }
    const file = new File([JSON.stringify(complexData)], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toEqual(complexData)
  })

  it('handles JSON with special characters', async () => {
    const dataWithSpecialChars = {
      message: 'Hello "world"!\nNew line here',
      emoji: '🎉',
      unicode: '日本語',
    }
    const file = new File([JSON.stringify(dataWithSpecialChars)], 'test.json', {
      type: 'application/json',
    })

    const result = await readFileAsJson(file)
    expect(result).toEqual(dataWithSpecialChars)
  })

  it('handles JSON with null values', async () => {
    const dataWithNull = { value: null, items: [null, 1, null] }
    const file = new File([JSON.stringify(dataWithNull)], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toEqual(dataWithNull)
  })

  it('handles JSON with boolean values', async () => {
    const dataWithBooleans = { active: true, disabled: false }
    const file = new File([JSON.stringify(dataWithBooleans)], 'test.json', {
      type: 'application/json',
    })

    const result = await readFileAsJson(file)
    expect(result).toEqual(dataWithBooleans)
  })

  it('handles JSON primitive number', async () => {
    const file = new File(['42'], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toBe(42)
  })

  it('handles JSON primitive string', async () => {
    const file = new File(['"hello"'], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toBe('hello')
  })

  it('handles truncated JSON', async () => {
    const file = new File(['{"incomplete":'], 'test.json', { type: 'application/json' })

    await expect(readFileAsJson(file)).rejects.toThrow('Invalid JSON file')
  })

  it('handles JSON with numbers', async () => {
    const dataWithNumbers = { integer: 42, float: 3.14, negative: -100, zero: 0 }
    const file = new File([JSON.stringify(dataWithNumbers)], 'test.json', {
      type: 'application/json',
    })

    const result = await readFileAsJson(file)
    expect(result).toEqual(dataWithNumbers)
  })

  it('handles large JSON file', async () => {
    const largeData = {
      items: Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random(),
      })),
    }
    const file = new File([JSON.stringify(largeData)], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toEqual(largeData)
  })

  it('handles empty string as invalid JSON', async () => {
    const file = new File([''], 'test.json', { type: 'application/json' })

    await expect(readFileAsJson(file)).rejects.toThrow('Invalid JSON file')
  })

  it('handles JSON boolean true', async () => {
    const file = new File(['true'], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toBe(true)
  })

  it('handles JSON boolean false', async () => {
    const file = new File(['false'], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toBe(false)
  })

  it('handles JSON null', async () => {
    const file = new File(['null'], 'test.json', { type: 'application/json' })

    const result = await readFileAsJson(file)
    expect(result).toBeNull()
  })
})
