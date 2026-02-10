import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, MessageSquare, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Textarea } from '@/components/ui/textarea'
import type { NoteCommentThread } from '@triple-a/types'

interface CommentThreadProps {
  thread: NoteCommentThread
  onReply: (content: string) => void
  onEdit: (commentId: string, content: string) => void
  onDelete: (commentId: string) => void
  onResolve: (resolved: boolean) => void
}

export function CommentThread({
  thread,
  onReply,
  onEdit,
  onDelete,
  onResolve,
}: CommentThreadProps) {
  const { t, i18n } = useTranslation()
  const [isReplying, setIsReplying] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const handleReply = () => {
    if (replyContent.trim()) {
      onReply(replyContent.trim())
      setReplyContent('')
      setIsReplying(false)
    }
  }

  const handleEdit = (commentId: string) => {
    if (editContent.trim()) {
      onEdit(commentId, editContent.trim())
      setEditingId(null)
      setEditContent('')
    }
  }

  const startEditing = (commentId: string, content: string) => {
    setEditingId(commentId)
    setEditContent(content)
  }

  return (
    <div className={`rounded-lg border p-3 space-y-3 ${thread.resolved ? 'opacity-60' : ''}`}>
      {/* Thread header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          <span>
            {thread.comments.length} {thread.comments.length === 1 ? t('comments.comment') : t('comments.comments')}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => onResolve(!thread.resolved)}
        >
          {thread.resolved ? (
            <>
              <X className="h-3 w-3 mr-1" />
              {t('comments.unresolve')}
            </>
          ) : (
            <>
              <Check className="h-3 w-3 mr-1" />
              {t('comments.resolve')}
            </>
          )}
        </Button>
      </div>

      {/* Comments */}
      <div className="space-y-2">
        {thread.comments.map((comment) => (
          <div key={comment.id} className="group relative">
            {editingId === comment.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[60px] text-sm"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleEdit(comment.id)}>
                    {t('comments.save')}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingId(null)}
                  >
                    {t('comments.cancel')}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-muted-foreground">
                    {new Date(comment.created_at).toLocaleDateString(i18n.language, {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => startEditing(comment.id, comment.content)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        {t('comments.edit')}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onDelete(comment.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        {t('comments.delete')}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Reply section */}
      {isReplying ? (
        <div className="space-y-2 pt-2 border-t">
          <Textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder={t('comments.writeReply')}
            className="min-h-[60px] text-sm"
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleReply}>
              {t('comments.reply')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsReplying(false)
                setReplyContent('')
              }}
            >
              {t('comments.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => setIsReplying(true)}
        >
          {t('comments.addReply')}
        </Button>
      )}
    </div>
  )
}
