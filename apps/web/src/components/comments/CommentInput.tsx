import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface CommentInputProps {
  onSubmit: (content: string) => void
  placeholder?: string
  autoFocus?: boolean
  defaultExpanded?: boolean
}

export function CommentInput({
  onSubmit,
  placeholder,
  autoFocus = false,
  defaultExpanded = false,
}: CommentInputProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || autoFocus)

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim())
      setContent('')
      // Keep expanded — don't collapse after submit
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      setIsExpanded(false)
      setContent('')
    }
  }

  if (!isExpanded) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-muted-foreground"
        onClick={() => setIsExpanded(true)}
      >
        <MessageSquarePlus className="h-4 w-4 mr-2" />
        {t('comments.addComment')}
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || t('comments.writeComment')}
        className="min-h-[80px] text-sm"
        autoFocus
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t('comments.pressCtrlEnterToSubmit')}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsExpanded(false)
              setContent('')
            }}
          >
            {t('comments.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!content.trim()}>
            {t('comments.comment')}
          </Button>
        </div>
      </div>
    </div>
  )
}
