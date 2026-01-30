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
import { notesToBlocks, blockToNoteUpdate, extractLabelIds, extractAssigneeIds } from '@/utils/taskBlockConverter'
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
  selectedNoteId?: string | null
  onSelect?: (noteId: string) => void
  onEdit: (id: string, content: string, category?: NoteCategory) => void
  onToggleCompleted: (id: string, completed: boolean) => void
  onTogglePinned?: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
  onCreateNote: () => void
  onCreateLabel?: (name: string) => void
  onAddLabel?: (noteId: string, labelId: string) => void
  onRemoveLabel?: (noteId: string, labelId: string) => void
  onAddAssignee?: (noteId: string, contactId: string) => void
  onRemoveAssignee?: (noteId: string, contactId: string) => void
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
  selectedNoteId: _selectedNoteId,
  onSelect,
  onEdit,
  onToggleCompleted,
  onTogglePinned,
  onDelete,
  onCreateNote,
  onCreateLabel,
  onAddLabel,
  onRemoveLabel,
  onAddAssignee,
  onRemoveAssignee,
  className = '',
}: TaskListEditorProps) {
  const { i18n: i18nInstance } = useTranslation()
  const { theme } = useTheme()
  const lastSyncedRef = useRef<string>('')
  const lastLabelsRef = useRef<Map<string, string[]>>(new Map())
  const lastAssigneesRef = useRef<Map<string, string[]>>(new Map())

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

    const notesKey = notes.map((n) => `${n.id}:${n.content}:${n.completed}:${n.pinned}`).join('|')
    if (notesKey === lastSyncedRef.current) return

    lastSyncedRef.current = notesKey
    const blocks = notesToBlocks(notes, noteLabelsCache, noteAssigneesCache)

    if (blocks.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      editor.replaceBlocks(editor.document, blocks as any)
    }
  }, [notes, noteLabelsCache, noteAssigneesCache, editor])

  // Initialize last labels/assignees state
  useEffect(() => {
    notes.forEach((note) => {
      const labels = noteLabelsCache.get(note.id) || []
      const assignees = noteAssigneesCache.get(note.id) || []
      lastLabelsRef.current.set(note.id, labels.map((l) => l.id))
      lastAssigneesRef.current.set(note.id, assignees.map((a) => a.id))
    })
  }, [notes, noteLabelsCache, noteAssigneesCache])

  // Handle changes from editor
  const handleChange = useCallback(() => {
    if (!editor) return

    for (const block of editor.document) {
      if (block.type !== 'taskItem') continue

      const props = block.props as {
        noteId: string
        checked: boolean
        category: string
        pinned: boolean
      }

      if (!props.noteId) continue

      // Extract text content from block
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const update = blockToNoteUpdate(block as any)
      if (update.content !== undefined) {
        onEdit(props.noteId, update.content, update.category as NoteCategory)
      }

      // Handle label changes
      if (onAddLabel && onRemoveLabel) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentLabelIds = extractLabelIds(block as any)
        const previousLabelIds = lastLabelsRef.current.get(props.noteId) || []

        const addedLabels = currentLabelIds.filter((id) => !previousLabelIds.includes(id))
        const removedLabels = previousLabelIds.filter((id) => !currentLabelIds.includes(id))

        addedLabels.forEach((labelId) => onAddLabel(props.noteId, labelId))
        removedLabels.forEach((labelId) => onRemoveLabel(props.noteId, labelId))

        lastLabelsRef.current.set(props.noteId, currentLabelIds)
      }

      // Handle assignee changes
      if (onAddAssignee && onRemoveAssignee) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const currentAssigneeIds = extractAssigneeIds(block as any)
        const previousAssigneeIds = lastAssigneesRef.current.get(props.noteId) || []

        const addedAssignees = currentAssigneeIds.filter((id) => !previousAssigneeIds.includes(id))
        const removedAssignees = previousAssigneeIds.filter((id) => !currentAssigneeIds.includes(id))

        addedAssignees.forEach((contactId) => onAddAssignee(props.noteId, contactId))
        removedAssignees.forEach((contactId) => onRemoveAssignee(props.noteId, contactId))

        lastAssigneesRef.current.set(props.noteId, currentAssigneeIds)
      }
    }
  }, [editor, onEdit, onAddLabel, onRemoveLabel, onAddAssignee, onRemoveAssignee])

  // Handle click on a task for selection
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!editor || !onSelect) return

      // Find the block that was clicked
      const target = e.target as HTMLElement
      const taskElement = target.closest('[data-block-type="taskItem"]')
      if (!taskElement) return

      // Get the block ID from the element
      const blockId = taskElement.getAttribute('data-id')
      if (!blockId) return

      // Find the block in the document
      const block = editor.document.find((b: { id: string }) => b.id === blockId)
      if (block && block.type === 'taskItem') {
        const props = block.props as { noteId: string }
        if (props.noteId) {
          onSelect(props.noteId)
        }
      }
    },
    [editor, onSelect]
  )

  // Keyboard shortcuts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useTaskKeyboardShortcuts(editor as any, {
    onToggleCompleted,
    onDelete,
    onCreateAfter: () => onCreateNote(),
    onTogglePinned,
  })

  return (
    <div className={`task-list-editor ${className}`} onClick={handleClick}>
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
