import type {
  YouTubeVideoMetadata,
  YouTubeCaptionTrack,
  TranscriptionResult,
  SummarizationResult,
  YouTubeImportError,
  YouTubeImportErrorCode,
} from '@/types/youtube'
import { extractVideoId, isValidYouTubeUrl } from '@/utils/youtubeUtils'
import { fetchWithRetry } from '@/lib/fetchWithRetry'

/**
 * Get the API base URL (same origin in production, or configurable for dev)
 */
function getApiBaseUrl(): string {
  // In production, API is served from the same origin
  // In development, you can set VITE_API_URL if needed
  return import.meta.env.VITE_API_URL || ''
}

/**
 * Check if YouTube import feature is available
 * Now always available since API is part of the same server
 */
export function isYouTubeImportAvailable(): boolean {
  return true
}

/**
 * Create an error object
 */
function createError(
  code: YouTubeImportError['code'],
  message: string,
  retryAfter?: number
): YouTubeImportError {
  return { code, message, retryAfter }
}

/**
 * Call an API endpoint
 */
async function callApi<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const baseUrl = getApiBaseUrl()
  const url = `${baseUrl}/api/${endpoint}`

  try {
    const response = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      // Check for specific error codes
      if (response.status === 429 || data?.code === 'RATE_LIMITED') {
        throw createError('RATE_LIMITED', data?.error || 'Rate limit exceeded. Please try again later.')
      }

      const errorCode = (data?.code || 'UNKNOWN_ERROR') as YouTubeImportErrorCode
      throw createError(errorCode, data?.error || `Failed to call ${endpoint}`)
    }

    return data as T
  } catch (error) {
    if ((error as YouTubeImportError).code) {
      throw error
    }
    console.error(`API ${endpoint} error:`, error)
    throw createError('NETWORK_ERROR', (error as Error).message || `Failed to call ${endpoint}`)
  }
}

/**
 * Fetch video metadata from YouTube
 */
export async function getVideoMetadata(url: string): Promise<YouTubeVideoMetadata> {
  // Validate URL first
  if (!isValidYouTubeUrl(url)) {
    throw createError('INVALID_URL', 'Invalid YouTube URL')
  }

  const videoId = extractVideoId(url)
  if (!videoId) {
    throw createError('INVALID_URL', 'Could not extract video ID from URL')
  }

  return callApi<YouTubeVideoMetadata>('youtube-metadata', { videoId })
}

/**
 * Get available caption tracks for a video
 */
export async function getCaptionTracks(videoId: string): Promise<YouTubeCaptionTrack[]> {
  const response = await callApi<{ tracks: YouTubeCaptionTrack[] }>(
    'youtube-captions',
    { videoId, action: 'list' }
  )

  return response.tracks || []
}

/**
 * Get transcription for a video
 */
export async function getTranscription(
  videoId: string,
  languageCode?: string
): Promise<TranscriptionResult> {
  return callApi<TranscriptionResult>('youtube-captions', {
    videoId,
    action: 'get',
    languageCode,
  })
}

/**
 * Generate a summary from transcription text
 */
export async function summarizeTranscription(
  text: string,
  videoTitle?: string,
  language: string = 'es'
): Promise<SummarizationResult> {
  return callApi<SummarizationResult>('summarize', {
    text,
    videoTitle,
    language,
  })
}

/**
 * Full import workflow: metadata -> captions -> optional summary
 */
export async function importFromYouTube(
  url: string,
  options: {
    includeSummary?: boolean
    captionLanguage?: string
    language?: string
  } = {}
): Promise<{
  metadata: YouTubeVideoMetadata
  transcription: TranscriptionResult
  summary?: SummarizationResult
}> {
  // Step 1: Get video metadata
  const metadata = await getVideoMetadata(url)

  // Step 2: Get transcription
  const transcription = await getTranscription(metadata.videoId, options.captionLanguage)

  // Step 3: Optionally generate summary
  let summary: SummarizationResult | undefined
  if (options.includeSummary) {
    summary = await summarizeTranscription(
      transcription.text,
      metadata.title,
      options.language || 'es'
    )
  }

  return {
    metadata,
    transcription,
    summary,
  }
}

export const YouTubeService = {
  isAvailable: isYouTubeImportAvailable,
  getVideoMetadata,
  getCaptionTracks,
  getTranscription,
  summarizeTranscription,
  importFromYouTube,
}

export default YouTubeService
