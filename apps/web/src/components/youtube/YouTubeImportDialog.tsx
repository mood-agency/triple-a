import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  Youtube,
  Loader2,
  ClipboardPaste,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  FileText,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { useYouTubeImport } from '@/hooks/useYouTubeImport'
import type { NoteCategory } from '@/types/note'
import { formatDuration } from '@/utils/youtubeUtils'

interface YouTubeImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (
    content: string,
    description: string | null,
    category: NoteCategory
  ) => void
  defaultCategory?: NoteCategory
}

export function YouTubeImportDialog({
  open,
  onOpenChange,
  onImport,
  defaultCategory = 'notes',
}: YouTubeImportDialogProps) {
  const { t } = useTranslation()
  const {
    state,
    isAvailable,
    fetchVideo,
    selectCaptionTrack,
    fetchTranscription,
    generateSummary,
    reset,
    getFormattedContent,
  } = useYouTubeImport()

  const [url, setUrl] = React.useState('')
  const [includeTranscription, setIncludeTranscription] = React.useState(true)
  const [includeSummary, setIncludeSummary] = React.useState(true)
  const [category, setCategory] = React.useState<NoteCategory>(defaultCategory)

  const handleClose = () => {
    setUrl('')
    setIncludeTranscription(true)
    setIncludeSummary(true)
    setCategory(defaultCategory)
    reset()
    onOpenChange(false)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setUrl(text)
    } catch (error) {
      console.warn('[Clipboard] Access denied or unavailable:', error)
    }
  }

  const handleFetchVideo = async () => {
    if (!url.trim()) return
    await fetchVideo(url.trim())
  }

  const handleFetchTranscription = async () => {
    await fetchTranscription()
  }

  const handleGenerateSummary = async () => {
    // First ensure we have transcription
    if (!state.transcription) {
      await fetchTranscription()
    }
    // Then generate summary
    await generateSummary()
  }

  const handleImport = () => {
    const { content, description } = getFormattedContent()
    if (content) {
      onImport(content, description, category)
      handleClose()
    }
  }

  const isLoading =
    state.status === 'fetching-metadata' ||
    state.status === 'fetching-captions' ||
    state.status === 'summarizing'

  const canImport =
    state.metadata &&
    (state.transcription || state.summary) &&
    !isLoading

  const getStatusText = () => {
    switch (state.status) {
      case 'fetching-metadata':
        return t('youtube.fetchingMetadata')
      case 'fetching-captions':
        return t('youtube.fetchingCaptions')
      case 'summarizing':
        return t('youtube.generatingSummary')
      default:
        return ''
    }
  }

  if (!isAvailable) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-500" />
              {t('youtube.import')}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 py-4 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <p>{t('youtube.noApiKey')}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {t('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            {t('youtube.import')}
          </DialogTitle>
          <DialogDescription>{t('youtube.pasteUrl')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* URL Input */}
          <div className="flex gap-2">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              disabled={isLoading || !!state.metadata}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !state.metadata) {
                  handleFetchVideo()
                }
              }}
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handlePaste}
              disabled={isLoading || !!state.metadata}
              title={t('youtube.pasteUrl')}
            >
              <ClipboardPaste className="h-4 w-4" />
            </Button>
          </div>

          {/* Fetch button (only shown before metadata is loaded) */}
          {!state.metadata && !isLoading && (
            <Button
              onClick={handleFetchVideo}
              disabled={!url.trim()}
              className="w-full"
            >
              {t('youtube.fetchVideo')}
            </Button>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{getStatusText()}</span>
            </div>
          )}

          {/* Error state */}
          {state.error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{state.error.message}</span>
            </div>
          )}

          {/* Video preview */}
          {state.metadata && !isLoading && (
            <div className="space-y-4">
              {/* Thumbnail and info */}
              <div className="flex gap-3">
                <img
                  src={state.metadata.thumbnailUrl}
                  alt={state.metadata.title}
                  className="h-20 w-32 rounded-md object-cover"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm line-clamp-2">
                    {state.metadata.title}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {state.metadata.channelName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('youtube.duration')}: {formatDuration(state.metadata.duration)}
                  </p>
                </div>
              </div>

              {/* Caption language selector */}
              {state.captionTracks.length > 0 && (
                <div className="space-y-2">
                  <Label>{t('youtube.selectLanguage')}</Label>
                  <Select
                    value={state.selectedCaptionTrackId || ''}
                    onValueChange={selectCaptionTrack}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {state.captionTracks.map((track) => (
                        <SelectItem key={track.id} value={track.language}>
                          {track.languageName}
                          {track.kind === 'asr' && ` (${t('youtube.autoGenerated')})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-transcription"
                    checked={includeTranscription}
                    onCheckedChange={(checked) =>
                      setIncludeTranscription(checked === true)
                    }
                  />
                  <Label
                    htmlFor="include-transcription"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <FileText className="h-4 w-4" />
                    {t('youtube.includeTranscription')}
                  </Label>
                  {state.transcription && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-summary"
                    checked={includeSummary}
                    onCheckedChange={(checked) =>
                      setIncludeSummary(checked === true)
                    }
                  />
                  <Label
                    htmlFor="include-summary"
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <Sparkles className="h-4 w-4" />
                    {t('youtube.generateSummary')}
                  </Label>
                  {state.summary && (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  )}
                </div>
              </div>

              {/* Action buttons for fetching content */}
              <div className="flex gap-2">
                {includeTranscription && !state.transcription && (
                  <Button
                    variant="outline"
                    onClick={handleFetchTranscription}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {t('youtube.fetchTranscription')}
                  </Button>
                )}
                {includeSummary && !state.summary && (
                  <Button
                    variant="outline"
                    onClick={handleGenerateSummary}
                    disabled={isLoading}
                    className="flex-1"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('youtube.generateSummaryBtn')}
                  </Button>
                )}
              </div>

              {/* Category selector */}
              <div className="space-y-2">
                <Label>{t('category')}</Label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as NoteCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="notes">{t('notes')}</SelectItem>
                    <SelectItem value="todo">{t('todo')}</SelectItem>
                    <SelectItem value="followup">{t('followup')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleImport} disabled={!canImport}>
            {t('youtube.createNote')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default YouTubeImportDialog
