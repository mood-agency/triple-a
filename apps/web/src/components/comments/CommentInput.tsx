import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface CommentInputProps {
  onSubmit: (content: string) => void
  placeholder?: string
  autoFocus?: boolean
}

export function CommentInput({
  onSubmit,
  placeholder,
  autoFocus = false,
}: CommentInputProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')
  const [isExpanded, setIsExpanded] = useState(autoFocus)

  const handleSubmit = () => {
    if (content.trim()) {
      onSubmit(content.trim())
      setContent('')
      setIsExpanded(false)
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
        {t('addComment')}
      </Button>
    )
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || t('writeComment')}
        className="min-h-[80px] text-sm"
        autoFocus
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {t('pressCtrlEnterToSubmit')}
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
            {t('cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={!content.trim()}>
            {t('comment')}
          </Button>
        </div>
      </div>
    </div>
  )
}
