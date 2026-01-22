import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type {
  YouTubeVideoMetadata,
  YouTubeCaptionTrack,
  TranscriptionResult,
  SummarizationResult,
  YouTubeImportError,
} from '@/types/youtube'
import { extractVideoId, isValidYouTubeUrl } from '@/utils/youtubeUtils'

/**
 * Check if YouTube import feature is available
 */
export function isYouTubeImportAvailable(): boolean {
  return isSupabaseConfigured()
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
 * Get the current session token for authenticated requests
 */
async function getAuthToken(): Promise<string> {
  if (!supabase) {
    throw createError('NOT_CONFIGURED', 'Supabase is not configured')
  }

  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session) {
    throw createError('NOT_CONFIGURED', 'User is not authenticated')
  }

  return session.access_token
}

/**
 * Call a Supabase Edge Function
 */
async function callEdgeFunction<T>(
  functionName: string,
  body: Record<string, unknown>
): Promise<T> {
  if (!supabase) {
    throw createError('NOT_CONFIGURED', 'Supabase is not configured')
  }

  const token = await getAuthToken()

  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  if (error) {
    console.error(`Edge function ${functionName} error:`, error)

    // Check for specific error codes
    if (error.message?.includes('rate limit')) {
      throw createError('RATE_LIMITED', 'Rate limit exceeded. Please try again later.')
    }

    throw createError(
      'NETWORK_ERROR',
      error.message || `Failed to call ${functionName}`
    )
  }

  // Check for error in response data
  if (data?.error) {
    const errorCode = data.code || 'UNKNOWN_ERROR'
    throw createError(errorCode as YouTubeImportError['code'], data.error)
  }

  return data as T
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

  return callEdgeFunction<YouTubeVideoMetadata>('youtube-metadata', { videoId })
}

/**
 * Get available caption tracks for a video
 */
export async function getCaptionTracks(videoId: string): Promise<YouTubeCaptionTrack[]> {
  const response = await callEdgeFunction<{ tracks: YouTubeCaptionTrack[] }>(
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
  return callEdgeFunction<TranscriptionResult>('youtube-captions', {
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
  return callEdgeFunction<SummarizationResult>('summarize', {
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
