import { useMemo, useCallback, useEffect, useRef } from 'react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useCreateBlockNote } from '@blocknote/react'
import { en as enLocale, es as esLocale } from '@blocknote/core/locales'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { taskListSchema } from './schema'
import { AssigneeSuggestionMenu } from './menus/AssigneeSuggestionMenu'
import { HashtagSuggestionMenu } from './menus/HashtagSuggestionMenu'
import { useTaskKeyboardShortcuts } from './hooks/useTaskKeyboardShortcuts'
import { notesToBlocks, blockToNoteUpdate } from '@/utils/taskBlockConverter'
import type { Note, NoteCategory, Label } from '@/types/note'
import type { Contact } from '@/types/contact'

import '@blocknote/shadcn/style.css'
import '@blocknote/core/fonts/inter.css'

interface TaskListEditorProps {
  notes: Note[]
  labels: Label[]
  contacts: Contact[]
  noteLabelsCache: Map<string, Label[]>
  noteAssigneesCache: Map<string, Contact[]>
  onEdit: (id: string, content: string, category?: NoteCategory) => void
  onToggleCompleted: (id: string, completed: boolean) => void
  onDelete: (id: string) => void
  onCreateNote: () => void
  onCreateLabel?: (name: string) => void
  className?: string
}

/**
 * BlockNote-based task list editor
 * Each task is a custom TaskItem block with inline chips for labels/assignees
 */
export function TaskListEditor({
  notes,
  labels,
  contacts,
  noteLabelsCache,
  noteAssigneesCache,
  onEdit,
  onToggleCompleted,
  onDelete,
  onCreateNote,
  onCreateLabel,
  className = '',
}: TaskListEditorProps) {
  const { i18n: i18nInstance } = useTranslation()
  const { theme } = useTheme()
  const lastSyncedRef = useRef<string>('')

  // Get BlockNote dictionary based on current language
  const blockNoteDictionary = useMemo(() => {
    const locales: Record<string, typeof enLocale> = {
      en: enLocale,
      es: esLocale,
    }
    return locales[i18nInstance.language] || enLocale
  }, [i18nInstance.language])

  // Resolve theme for BlockNote
  const resolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
  }, [theme])

  // Convert notes to blocks for initial content
  const initialContent = useMemo(() => {
    return notesToBlocks(notes, noteLabelsCache, noteAssigneesCache)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only on mount

  // Create the BlockNote editor
  const editor = useCreateBlockNote({
    schema: taskListSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    initialContent: initialContent.length > 0 ? (initialContent as any) : undefined,
    dictionary: blockNoteDictionary,
  })

  // Sync notes changes to editor
  useEffect(() => {
    if (!editor) return

    const notesKey = notes.map((n) => `${n.id}:${n.content}:${n.completed}`).join('|')
    if (notesKey === lastSyncedRef.current) return

    lastSyncedRef.current = notesKey
    const blocks = notesToBlocks(notes, noteLabelsCache, noteAssigneesCache)

    if (blocks.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.replaceBlocks(editor.document, blocks as any)
    }
  }, [notes, noteLabelsCache, noteAssigneesCache, editor])

  // Handle changes from editor
  const handleChange = useCallback(() => {
    if (!editor) return

    for (const block of editor.document) {
      if (block.type !== 'taskItem') continue

      const props = block.props as {
        noteId: string
        checked: boolean
        category: string
      }

      if (!props.noteId) continue

      // Extract text content from block
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update = blockToNoteUpdate(block as any)
      if (update.content !== undefined) {
        onEdit(props.noteId, update.content, update.category as NoteCategory)
      }
    }
  }, [editor, onEdit])

  // Keyboard shortcuts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useTaskKeyboardShortcuts(editor as any, {
    onToggleCompleted,
    onDelete,
    onCreateAfter: () => onCreateNote(),
  })

  return (
    <div className={`task-list-editor ${className}`}>
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        theme={resolvedTheme}
        slashMenu={false}
      >
        <AssigneeSuggestionMenu contacts={contacts} />
        <HashtagSuggestionMenu labels={labels} onCreateLabel={onCreateLabel} />
      </BlockNoteView>
    </div>
  )
}
