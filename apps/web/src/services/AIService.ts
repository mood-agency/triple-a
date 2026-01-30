import { fetchWithRetry } from '@/lib/fetchWithRetry'
import type { AIProvider } from '@/hooks/useSettings'

export interface AIProcessRequest {
  content: string
  prompt: string
  provider: AIProvider
  model: string
  apiKey: string
}

export interface AIProcessResponse {
  generatedContent: string
  provider: AIProvider
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
  }
}

export interface AIError {
  code: 'INVALID_REQUEST' | 'NO_API_KEY' | 'INVALID_API_KEY' | 'INVALID_PROVIDER' | 'RATE_LIMIT' | 'PROCESSING_FAILED' | 'NETWORK_ERROR'
  message: string
}

/**
 * Get the API base URL (same origin in production, or configurable for dev)
 */
function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_URL || ''
}

/**
 * Create an error object
 */
function createError(code: AIError['code'], message: string): AIError {
  return { code, message }
}

/**
 * Process note content with AI (supports multiple providers)
 */
export async function processNoteWithAI(
  request: AIProcessRequest
): Promise<AIProcessResponse> {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}/api/ai-process`

  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    const data = await response.json()

    if (!response.ok) {
      if (response.status === 401 || data?.code === 'INVALID_API_KEY') {
        throw createError('INVALID_API_KEY', data?.error || 'Invalid API key')
      }

      if (response.status === 429 || data?.code === 'RATE_LIMIT') {
        throw createError('RATE_LIMIT', data?.error || 'Rate limit exceeded')
      }

      if (data?.code === 'NO_API_KEY') {
        throw createError('NO_API_KEY', data?.error || 'API key required')
      }

      if (data?.code === 'INVALID_PROVIDER') {
        throw createError('INVALID_PROVIDER', data?.error || 'Invalid provider')
      }

      throw createError('PROCESSING_FAILED', data?.error || 'Failed to process with AI')
    }

    return data as AIProcessResponse
  } catch (error) {
    if ((error as AIError).code) {
      throw error
    }
    console.error('AI API error:', error)
    throw createError('NETWORK_ERROR', (error as Error).message || 'Network error')
  }
}

export const AIService = {
  processNoteWithAI,
}
