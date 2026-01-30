import { useRef, useCallback, useEffect } from 'react'
import type { BlockNoteEditor } from '@blocknote/core'
import { blockToNoteUpdate, extractLabelIds, extractAssigneeIds } from '@/utils/taskBlockConverter'
import type { NoteCategory } from '@/types/note'

interface TaskItemBlock {
  type: 'taskItem'
  props: {
    noteId: string
    checked: boolean
    category: string
  }
  content: Array<unknown>
}

interface SyncCallbacks {
  onEdit: (id: string, content: string, category?: NoteCategory) => void
  onToggleCompleted: (id: string, completed: boolean) => void
  onAddLabel?: (noteId: string, labelId: string) => void
  onRemoveLabel?: (noteId: string, labelId: string) => void
  onAddAssignee?: (noteId: string, contactId: string) => void
  onRemoveAssignee?: (noteId: string, contactId: string) => void
}

interface SyncOptions {
  debounceMs?: number
}

/**
 * Hook to sync BlockNote editor changes with Supabase
 * Uses debounce to prevent excessive writes
 */
export function useBlockNoteTaskSync(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: BlockNoteEditor<any> | null,
  callbacks: SyncCallbacks,
  options: SyncOptions = {}
) {
  const { debounceMs = 500 } = options
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastStateRef = useRef<Map<string, { content: string; checked: boolean; labelIds: string[]; assigneeIds: string[] }>>(new Map())

  // Debounced sync function
  const syncChanges = useCallback(() => {
    if (!editor) return

    for (const block of editor.document) {
      // Skip non-taskItem blocks
      if ((block as { type: string }).type !== 'taskItem') continue

      const taskBlock = block as unknown as TaskItemBlock
      const { noteId, checked, category } = taskBlock.props

      if (!noteId) continue

      const update = blockToNoteUpdate(taskBlock as Parameters<typeof blockToNoteUpdate>[0])
      const labelIds = extractLabelIds(taskBlock as Parameters<typeof extractLabelIds>[0])
      const assigneeIds = extractAssigneeIds(taskBlock as Parameters<typeof extractAssigneeIds>[0])

      const lastState = lastStateRef.current.get(noteId)
      const currentContent = update.content || ''

      // Check if anything changed
      const contentChanged = lastState?.content !== currentContent
      const checkedChanged = lastState?.checked !== checked
      const labelsChanged = JSON.stringify(lastState?.labelIds) !== JSON.stringify(labelIds)
      const assigneesChanged = JSON.stringify(lastState?.assigneeIds) !== JSON.stringify(assigneeIds)

      // Sync content/category changes
      if (contentChanged) {
        callbacks.onEdit(noteId, currentContent, category as NoteCategory)
      }

      // Sync completion status
      if (checkedChanged) {
        callbacks.onToggleCompleted(noteId, checked)
      }

      // Sync labels (add/remove)
      if (labelsChanged && callbacks.onAddLabel && callbacks.onRemoveLabel) {
        const oldLabels = new Set(lastState?.labelIds || [])
        const newLabels = new Set(labelIds)

        // Added labels
        for (const labelId of newLabels) {
          if (!oldLabels.has(labelId)) {
            callbacks.onAddLabel(noteId, labelId)
          }
        }

        // Removed labels
        for (const labelId of oldLabels) {
          if (!newLabels.has(labelId)) {
            callbacks.onRemoveLabel(noteId, labelId)
          }
        }
      }

      // Sync assignees (add/remove)
      if (assigneesChanged && callbacks.onAddAssignee && callbacks.onRemoveAssignee) {
        const oldAssignees = new Set(lastState?.assigneeIds || [])
        const newAssignees = new Set(assigneeIds)

        // Added assignees
        for (const contactId of newAssignees) {
          if (!oldAssignees.has(contactId)) {
            callbacks.onAddAssignee(noteId, contactId)
          }
        }

        // Removed assignees
        for (const contactId of oldAssignees) {
          if (!newAssignees.has(contactId)) {
            callbacks.onRemoveAssignee(noteId, contactId)
          }
        }
      }

      // Update last state
      lastStateRef.current.set(noteId, {
        content: currentContent,
        checked,
        labelIds,
        assigneeIds,
      })
    }
  }, [editor, callbacks])

  // Debounced handler
  const handleChange = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      syncChanges()
    }, debounceMs)
  }, [syncChanges, debounceMs])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Flush pending changes immediately
  const flush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    syncChanges()
  }, [syncChanges])

  return {
    handleChange,
    flush,
  }
}
