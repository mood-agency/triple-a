import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
  onEdit: (commentId: string, content: string) => void
  onDelete: (commentId: string) => void
}

export function CommentThread({
  thread,
  onEdit,
  onDelete,
}: CommentThreadProps) {
  const { t, i18n } = useTranslation()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

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
    <>
      {thread.comments.map((comment) => (
        <div key={comment.id} className="group flex items-start gap-2">
          {editingId === comment.id ? (
            <div className="flex-1 space-y-2">
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
              <p className="flex-1 text-sm whitespace-pre-wrap">{comment.content}</p>
              <span className="text-[10px] text-muted-foreground/60 shrink-0 pt-0.5">
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
                    className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 shrink-0"
                  >
                    <MoreHorizontal className="h-3 w-3" />
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
            </>
          )}
        </div>
      ))}
    </>
  )
}
