import { useState, useCallback } from 'react'
import { initialYouTubeImportState, type YouTubeImportState, type YouTubeImportError } from '@/types/youtube'
import {
  isYouTubeImportAvailable,
  getVideoMetadata,
  getCaptionTracks,
  getTranscription,
  summarizeTranscription,
} from '@/services/YouTubeService'
import { extractVideoId } from '@/utils/youtubeUtils'

export interface UseYouTubeImportReturn {
  state: YouTubeImportState
  isAvailable: boolean
  fetchVideo: (url: string) => Promise<void>
  selectCaptionTrack: (trackId: string) => void
  fetchTranscription: () => Promise<void>
  generateSummary: () => Promise<void>
  reset: () => void
  getFormattedContent: () => { content: string; description: string | null }
}

export function useYouTubeImport(): UseYouTubeImportReturn {
  const [state, setState] = useState<YouTubeImportState>(initialYouTubeImportState)

  const isAvailable = isYouTubeImportAvailable()

  /**
   * Fetch video metadata and available caption tracks
   */
  const fetchVideo = useCallback(async (url: string) => {
    setState((prev) => ({
      ...prev,
      status: 'fetching-metadata',
      error: null,
    }))

    try {
      // Fetch metadata
      const metadata = await getVideoMetadata(url)

      setState((prev) => ({
        ...prev,
        metadata,
        status: 'fetching-captions',
      }))

      // Fetch available caption tracks
      const videoId = extractVideoId(url)
      if (!videoId) {
        throw { code: 'INVALID_URL', message: 'Invalid YouTube URL' } as YouTubeImportError
      }

      const captionTracks = await getCaptionTracks(videoId)

      // Select default track or first available
      const defaultTrack =
        captionTracks.find((t) => t.isDefault) || captionTracks[0]

      if (captionTracks.length === 0) {
        setState((prev) => ({
          ...prev,
          captionTracks: [],
          selectedCaptionTrackId: null,
          status: 'error',
          error: {
            code: 'NO_CAPTIONS',
            message: 'No hay subtítulos disponibles para este video',
          },
        }))
        return
      }

      setState((prev) => ({
        ...prev,
        captionTracks,
        selectedCaptionTrackId: defaultTrack?.language || null,
        status: 'ready',
      }))
    } catch (error) {
      console.error('Error fetching video:', error)
      const importError = error as YouTubeImportError
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: {
          code: importError.code || 'UNKNOWN_ERROR',
          message: importError.message || 'Error desconocido al obtener el video',
        },
      }))
    }
  }, [])

  /**
   * Select a caption track
   */
  const selectCaptionTrack = useCallback((trackId: string) => {
    setState((prev) => ({
      ...prev,
      selectedCaptionTrackId: trackId,
      transcription: null, // Reset transcription when track changes
    }))
  }, [])

  /**
   * Fetch transcription for selected caption track
   */
  const fetchTranscription = useCallback(async () => {
    const { metadata, selectedCaptionTrackId, captionTracks } = state

    if (!metadata || !selectedCaptionTrackId) {
      return
    }

    setState((prev) => ({
      ...prev,
      status: 'fetching-captions',
      error: null,
    }))

    try {
      const transcription = await getTranscription(
        metadata.videoId,
        selectedCaptionTrackId
      )

      // Get language name from track
      const track = captionTracks.find((t) => t.language === selectedCaptionTrackId)
      if (track) {
        transcription.languageName = track.languageName
      }

      setState((prev) => ({
        ...prev,
        transcription,
        status: 'ready',
      }))
    } catch (error) {
      console.error('Error fetching transcription:', error)
      const importError = error as YouTubeImportError
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: {
          code: importError.code || 'CAPTION_FETCH_FAILED',
          message: importError.message || 'Error al obtener la transcripción',
        },
      }))
    }
  }, [state])

  /**
   * Generate AI summary from transcription
   */
  const generateSummary = useCallback(async () => {
    const { metadata, transcription } = state

    if (!transcription) {
      return
    }

    setState((prev) => ({
      ...prev,
      status: 'summarizing',
      error: null,
    }))

    try {
      const summary = await summarizeTranscription(
        transcription.text,
        metadata?.title,
        'es' // Default to Spanish
      )

      setState((prev) => ({
        ...prev,
        summary,
        status: 'ready',
      }))
    } catch (error) {
      console.error('Error generating summary:', error)
      const importError = error as YouTubeImportError
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: {
          code: importError.code || 'SUMMARY_FAILED',
          message: importError.message || 'Error al generar el resumen',
        },
      }))
    }
  }, [state])

  /**
   * Reset state to initial
   */
  const reset = useCallback(() => {
    setState(initialYouTubeImportState)
  }, [])

  /**
   * Get formatted content for creating a note
   */
  const getFormattedContent = useCallback((): {
    content: string
    description: string | null
  } => {
    const { metadata, transcription, summary } = state

    if (!metadata) {
      return { content: '', description: null }
    }

    const content = `📺 ${metadata.title}`
    const descriptionParts: string[] = []

    // Video metadata
    const videoUrl = `https://www.youtube.com/watch?v=${metadata.videoId}`
    descriptionParts.push(`**Video:** [${metadata.title}](${videoUrl})`)
    descriptionParts.push(`**Canal:** ${metadata.channelName}`)

    // Format duration
    const durationMatch = metadata.duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (durationMatch) {
      const hours = parseInt(durationMatch[1] || '0', 10)
      const minutes = parseInt(durationMatch[2] || '0', 10)
      const seconds = parseInt(durationMatch[3] || '0', 10)
      const durationStr =
        hours > 0
          ? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          : `${minutes}:${seconds.toString().padStart(2, '0')}`
      descriptionParts.push(`**Duración:** ${durationStr}`)
    }

    descriptionParts.push('')

    // Summary section
    if (summary) {
      descriptionParts.push('## Resumen')
      descriptionParts.push(summary.summary)
      descriptionParts.push('')

      if (summary.keyPoints && summary.keyPoints.length > 0) {
        descriptionParts.push('### Puntos clave')
        summary.keyPoints.forEach((point) => {
          descriptionParts.push(`- ${point}`)
        })
        descriptionParts.push('')
      }

      if (summary.topics && summary.topics.length > 0) {
        descriptionParts.push(`**Temas:** ${summary.topics.join(', ')}`)
        descriptionParts.push('')
      }
    }

    // Transcription section
    if (transcription) {
      descriptionParts.push('---')
      descriptionParts.push('')
      descriptionParts.push('## Transcripción')
      descriptionParts.push(
        `*Idioma: ${transcription.languageName}${transcription.isAutoGenerated ? ' (auto-generado)' : ''}*`
      )
      descriptionParts.push('')
      descriptionParts.push(transcription.text)
    }

    const description = descriptionParts.join('\n')

    return {
      content,
      description: description || null,
    }
  }, [state])

  return {
    state,
    isAvailable,
    fetchVideo,
    selectCaptionTrack,
    fetchTranscription,
    generateSummary,
    reset,
    getFormattedContent,
  }
}

export default useYouTubeImport
