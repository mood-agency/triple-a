import { useEffect } from 'react'
import type { BlockNoteEditor } from '@blocknote/core'

interface TaskKeyboardCallbacks {
  onToggleCompleted?: (noteId: string, completed: boolean) => void
  onDelete?: (noteId: string) => void
  onCreateAfter?: (noteId: string) => void
}

/**
 * Hook to handle keyboard shortcuts for task items
 * - Ctrl+D: Toggle completed
 * - Ctrl+Backspace: Delete task
 * - Enter: Create new task after current (handled by BlockNote natively for new blocks)
 */
export function useTaskKeyboardShortcuts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  editor: BlockNoteEditor<any> | null,
  callbacks: TaskKeyboardCallbacks
) {
  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const position = editor.getTextCursorPosition()
      const block = position?.block

      // Only handle shortcuts for taskItem blocks
      if (!block || block.type !== 'taskItem') return

      const props = block.props as {
        checked: boolean
        category: string
        noteId: string
      }

      // Ctrl+D: Toggle completed
      if (e.key === 'd' && e.ctrlKey && !e.shiftKey && !e.altKey) {
        // Only toggle for todo and followup categories
        if (props.category === 'todo' || props.category === 'followup') {
          e.preventDefault()
          const newChecked = !props.checked
          editor.updateBlock(block, {
            props: { checked: newChecked },
          })
          callbacks.onToggleCompleted?.(props.noteId, newChecked)
        }
      }

      // Ctrl+Backspace: Delete task
      if (e.key === 'Backspace' && e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault()
        callbacks.onDelete?.(props.noteId)
        editor.removeBlocks([block])
      }

      // Enter: Create new task (only when not in suggestion menu)
      // BlockNote handles basic Enter for new paragraphs, but we want new taskItems
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
        // Check if suggestion menu is open by looking for the menu element
        const suggestionMenu = document.querySelector('[data-bn-suggestion-menu]')
        if (suggestionMenu) return // Let suggestion menu handle Enter

        e.preventDefault()

        // Create new taskItem block after current
        const newBlock = {
          type: 'taskItem' as const,
          props: {
            checked: false,
            category: props.category, // Inherit category
            deadline: '',
            pinned: false,
            labelIds: '[]',
            assigneeIds: '[]',
            noteId: '',
          },
        }

        editor.insertBlocks([newBlock], block, 'after')

        // Focus the new block
        setTimeout(() => {
          const blocks = editor.document
          const currentIndex = blocks.findIndex((b: { id: string }) => b.id === block.id)
          if (currentIndex >= 0 && currentIndex < blocks.length - 1) {
            const nextBlock = blocks[currentIndex + 1]
            editor.setTextCursorPosition(nextBlock, 'start')
          }
        }, 0)

        callbacks.onCreateAfter?.(props.noteId)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [editor, callbacks])
}
