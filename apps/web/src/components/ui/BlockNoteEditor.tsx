import {
  forwardRef,
  useImperativeHandle,
  useEffect,
  useRef,
  useState,
  useMemo,
  useCallback,
} from 'react'
import { BlockNoteView } from '@blocknote/shadcn'
import { useCreateBlockNote } from '@blocknote/react'
import { BlockNoteSchema, defaultBlockSpecs, createCodeBlockSpec, type BlockNoteEditor as BlockNoteEditorCore } from '@blocknote/core'
import { codeBlockOptions } from '@blocknote/code-block'
import { en as enLocale, es as esLocale } from '@blocknote/core/locales'
import '@blocknote/shadcn/style.css'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import i18n from '@/i18n'
import { uploadNoteAttachment, StorageError, getFileTypeLabel } from '@/services/storage'
import { detectContentFormat, tiptapToBlockNote, plainTextToBlockNote } from '@/utils/contentMigration'
import { useDebugNavigation } from '@/hooks/useDebugNavigation'
import { useTheme } from '@/contexts/ThemeContext'
import { SearchHighlightExtension } from './SearchHighlightExtension'

// Create schema with code block syntax highlighting
const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
  },
})

/**
 * Detect if text is a Markdown table
 */
function isMarkdownTable(text: string): boolean {
  const lines = text.trim().split('\n').filter(line => line.trim())
  if (lines.length < 2) return false

  // Check if lines start and contain pipes
  const hasPipes = lines.every(line => line.includes('|'))
  if (!hasPipes) return false

  // Check for separator row (contains dashes between pipes)
  const hasSeparator = lines.some(line => /^\|?[\s-:|]+\|?$/.test(line.trim()))
  return hasSeparator
}

/**
 * Parse Markdown table to BlockNote table content
 */
function parseMarkdownTable(text: string): { type: 'table'; content: { type: 'tableContent'; rows: Array<{ cells: Array<Array<{ type: 'text'; text: string; styles: Record<string, never> }>> }> } } | null {
  const lines = text.trim().split('\n').filter(line => line.trim())
  if (lines.length < 2) return null

  const rows: Array<{ cells: Array<Array<{ type: 'text'; text: string; styles: Record<string, never> }>> }> = []

  for (const line of lines) {
    // Skip separator row
    if (/^\|?[\s-:|]+\|?$/.test(line.trim())) continue

    // Parse cells from line
    const cellTexts = line
      .split('|')
      .map(cell => cell.trim())
      .filter((_, index, arr) => {
        // Remove empty first/last elements from lines like "| a | b |"
        if (index === 0 && arr[0] === '') return false
        if (index === arr.length - 1 && arr[arr.length - 1] === '') return false
        return true
      })

    if (cellTexts.length === 0) continue

    const cells = cellTexts.map(cellText => [{
      type: 'text' as const,
      text: cellText,
      styles: {} as Record<string, never>,
    }])

    rows.push({ cells })
  }

  if (rows.length === 0) return null

  return {
    type: 'table',
    content: {
      type: 'tableContent',
      rows,
    },
  }
}

interface BlockNoteEditorProps {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void
  onNavigateUp?: () => void
  placeholder?: string
  className?: string
  noteId?: string
}

export interface BlockNoteEditorHandle {
  focus: () => void
  blur: () => void
  getSelectionInfo: () => { cursorPosition: number; text: string } | null
  setCursorPosition: (position: number) => void
  updateSearch: (searchTerm: string, currentMatchIndex: number) => void
  clearSearch: () => void
  countSearchMatches: (searchTerm: string) => number
}

export const BlockNoteEditor = forwardRef<BlockNoteEditorHandle, BlockNoteEditorProps>(
  function BlockNoteEditor(
    { value, onChange, onBlur, onFocus, onKeyDown, onNavigateUp, placeholder, className = '', noteId },
    ref
  ) {
    const isInitializedRef = useRef(false)
    const editorRef = useRef<BlockNoteEditorCore | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    // Track noteId to detect when we switch notes (start with null to force initial sync)
    const currentNoteIdRef = useRef<string | undefined>(undefined)
    const { debugMode, debugDescriptionFocusClass } = useDebugNavigation()
    const [isFocused, setIsFocused] = useState(false)
    const isFocusedRef = useRef(false)
    // Track what this editor instance last emitted via onChange, so we can
    // distinguish our own writes from external changes (e.g. another panel).
    const lastEmittedValueRef = useRef<string>('')
    const { theme } = useTheme()
    const { i18n: i18nInstance } = useTranslation()

    // Get BlockNote dictionary based on current language
    const blockNoteDictionary = useMemo(() => {
      const locales: Record<string, typeof enLocale> = {
        en: enLocale,
        es: esLocale,
      }
      return locales[i18nInstance.language] || enLocale
    }, [i18nInstance.language])

    // Resolve theme for BlockNote (handles 'system' preference)
    const resolvedTheme = useMemo(() => {
      if (theme === 'system') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      return theme
    }, [theme])

    // Parse initial content, migrating from TipTap if needed
    const initialContent = useMemo(() => {
      if (!value) return undefined

      const format = detectContentFormat(value)

      switch (format) {
        case 'empty':
          return undefined

        case 'blocknote':
          try {
            return JSON.parse(value)
          } catch {
            return undefined
          }

        case 'tiptap':
          try {
            const tiptapDoc = JSON.parse(value)
            return tiptapToBlockNote(tiptapDoc)
          } catch {
            return undefined
          }

        case 'plain':
          return plainTextToBlockNote(value)
      }
    }, []) // Only compute on mount

    // File upload handler
    const uploadFile = useCallback(async (file: File) => {
      if (!noteId) {
        // Fallback to base64 if no noteId
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      }

      try {
        const result = await uploadNoteAttachment(file, noteId)
        return result.url
      } catch (error) {
        if (error instanceof StorageError) {
          switch (error.code) {
            case 'INVALID_TYPE':
              toast.error(i18n.t('toast.fileUnsupportedFormat'), {
                description: i18n.t('toast.fileUnsupportedFormatDescription', {
                  type: getFileTypeLabel(file.type),
                }),
              })
              break
            case 'FILE_TOO_LARGE':
              toast.error(i18n.t('toast.fileTooLarge'), {
                description: i18n.t('toast.fileTooLargeDescription', {
                  maxSize: 10,
                  fileSize: (file.size / 1024 / 1024).toFixed(1),
                }),
              })
              break
            case 'NO_SUPABASE':
            case 'NOT_AUTHENTICATED':
              // Fallback to base64 for offline mode
              return new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result as string)
                reader.onerror = reject
                reader.readAsDataURL(file)
              })
            default:
              toast.error(i18n.t('toast.uploadFailed'), {
                description: error.message,
              })
          }
        }
        throw error
      }
    }, [noteId])

    // Create the BlockNote editor with code block support and advanced tables
    const editor = useCreateBlockNote({
      schema,
      initialContent,
      uploadFile,
      dictionary: blockNoteDictionary,
      trailingBlock: false,
      tables: {
        splitCells: true,
        cellBackgroundColor: true,
        cellTextColor: true,
        headers: true,
      },
      _tiptapOptions: {
        extensions: [
          SearchHighlightExtension.configure({
            searchTerm: '',
            currentMatchIndex: 0,
          }),
        ],
      },
    })

    // Store editor ref
    useEffect(() => {
      editorRef.current = editor
    }, [editor])

    // Handle paste - always use plain text to prevent formatted content (HTML with animations, etc.)
    useEffect(() => {
      if (!editor || !containerRef.current) return

      const handlePaste = (event: ClipboardEvent) => {
        const text = event.clipboardData?.getData('text/plain')
        if (!text) return

        // Always prevent default to avoid pasting formatted HTML content
        event.preventDefault()
        event.stopPropagation()

        // Check if it's a Markdown table
        if (isMarkdownTable(text)) {
          const tableBlock = parseMarkdownTable(text)
          if (tableBlock) {
            // Insert the table block at current cursor position
            const currentBlock = editor.getTextCursorPosition()?.block
            if (currentBlock) {
              editor.insertBlocks([tableBlock as Parameters<typeof editor.insertBlocks>[0][0]], currentBlock, 'after')
            } else {
              editor.insertBlocks([tableBlock as Parameters<typeof editor.insertBlocks>[0][0]], editor.document[0], 'before')
            }
            return
          }
        }

        // For all other content, insert as plain text using the editor's API
        // This ensures no HTML formatting (animations, styles, etc.) is preserved
        const currentBlock = editor.getTextCursorPosition()?.block
        if (currentBlock) {
          // Split text into lines and create paragraph blocks for each
          const lines = text.split('\n')
          const blocks = lines.map(line => ({
            type: 'paragraph' as const,
            content: line || undefined,
          }))

          // Insert all blocks after current position
          editor.insertBlocks(blocks, currentBlock, 'after')
        }
      }

      const container = containerRef.current
      container.addEventListener('paste', handlePaste as EventListener, true)
      return () => {
        container.removeEventListener('paste', handlePaste as EventListener, true)
      }
    }, [editor])

    // Handle content changes - just propagate to parent, no complex sync logic
    const handleChange = useCallback(() => {
      if (!editor || isReplacingContentRef.current) return
      const json = JSON.stringify(editor.document)
      lastEmittedValueRef.current = json
      onChange(json)
    }, [editor, onChange])

    // Initialize content
    useEffect(() => {
      if (!editor || isInitializedRef.current) return
      isInitializedRef.current = true
    }, [editor])

    // Track if we've loaded content for this note
    const hasLoadedContentRef = useRef(false)
    // Flag to suppress onChange during programmatic replaceBlocks calls
    const isReplacingContentRef = useRef(false)

    // Sync content when:
    // 1. noteId changes (switching notes)
    // 2. Initial content load
    // 3. External value change while this editor is NOT focused (e.g. another panel edited same note)
    useEffect(() => {
      if (!editor || !isInitializedRef.current) return

      const noteIdChanged = currentNoteIdRef.current !== noteId
      currentNoteIdRef.current = noteId

      // Also sync if we haven't loaded content yet and value is now available
      const needsInitialLoad = !hasLoadedContentRef.current && value

      // Check for external changes: same note, content loaded, not focused,
      // and value differs from what this editor last emitted
      const isExternalChange =
        !noteIdChanged &&
        hasLoadedContentRef.current &&
        !isFocusedRef.current &&
        value !== lastEmittedValueRef.current

      if (noteIdChanged || needsInitialLoad || isExternalChange) {
        const format = detectContentFormat(value)
        let blocks

        switch (format) {
          case 'empty':
            // Use a single empty paragraph instead of [] to avoid ProseMirror
            // auto-creating a paragraph + trailingBlock adding a second one,
            // which causes a visible extra newline when the editor mounts.
            blocks = [{ type: 'paragraph' as const, content: [] }]
            break
          case 'blocknote':
            try {
              blocks = JSON.parse(value)
            } catch {
              blocks = []
            }
            break
          case 'tiptap':
            try {
              const tiptapDoc = JSON.parse(value)
              blocks = tiptapToBlockNote(tiptapDoc)
            } catch {
              blocks = []
            }
            break
          case 'plain':
            blocks = plainTextToBlockNote(value)
            break
        }

        // Suppress onChange during programmatic content replacement to prevent
        // re-render loops (replaceBlocks fires handleChange synchronously)
        isReplacingContentRef.current = true
        editor.replaceBlocks(editor.document, blocks)
        isReplacingContentRef.current = false
        // Keep lastEmittedValueRef in sync so we don't re-trigger
        lastEmittedValueRef.current = value
        hasLoadedContentRef.current = true
      }

      // Reset flag when switching notes
      if (noteIdChanged) {
        hasLoadedContentRef.current = !!value
      }
    }, [value, editor, noteId])

    // Handle keyboard events
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        // Prevent browser's bookmark (Ctrl+D), print (Ctrl+P), save (Ctrl+S),
        // or other defaults that conflict with our task shortcuts
        if ((event.ctrlKey || event.metaKey) &&
          (event.key.toLowerCase() === 'd' ||
            event.key.toLowerCase() === 'p' ||
            event.key.toLowerCase() === 's' ||
            event.key === 'Backspace')) {
          event.preventDefault();
        }

        // ArrowUp at the top boundary → navigate to title
        if (event.key === 'ArrowUp' && onNavigateUp && editor) {
          // Use BlockNote public API to check if cursor is in the first block
          const cursor = editor.getTextCursorPosition()
          if (cursor && !cursor.prevBlock) {
            // Cursor is in the first block — check if on the first visual line
            // by comparing y-coordinates of cursor vs start of paragraph content
            const tiptapEditor = (editor as unknown as { _tiptapEditor?: { view: { coordsAtPos: (pos: number) => { top: number } }; state: { selection: { from: number; $from: { depth: number; start: (depth: number) => number } } } } })._tiptapEditor
            if (tiptapEditor) {
              const { view, state } = tiptapEditor
              const { $from } = state.selection
              const cursorCoords = view.coordsAtPos(state.selection.from)
              const paragraphStart = $from.start($from.depth)
              const startCoords = view.coordsAtPos(paragraphStart)
              if (Math.abs(cursorCoords.top - startCoords.top) < 2) {
                event.preventDefault()
                onNavigateUp()
              }
            }
          }
        }

        if (onKeyDown) {
          onKeyDown(event)
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
          }
        }
      },
      [onKeyDown, onNavigateUp, editor]
    )

    // Handle focus/blur
    const handleFocus = useCallback(() => {
      isFocusedRef.current = true
      setIsFocused(true)
      onFocus?.()
    }, [onFocus])

    const handleBlur = useCallback(() => {
      isFocusedRef.current = false
      setIsFocused(false)
      onBlur?.()
    }, [onBlur])

    // Expose imperative handle
    useImperativeHandle(
      ref,
      () => ({
        focus: () => {
          editor?.focus()
        },
        blur: () => {
          // BlockNote doesn't have a direct blur method
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur()
          }
        },
        getSelectionInfo: () => {
          if (!editor) return null
          const selection = editor.getSelection()
          const text = editor.document
            .map(block => {
              if ('content' in block && Array.isArray(block.content)) {
                return block.content
                  .map(inline => ('text' in inline ? inline.text : ''))
                  .join('')
              }
              return ''
            })
            .join('\n')

          return {
            cursorPosition: selection?.blocks?.[0] ? 0 : 0,
            text,
          }
        },
        setCursorPosition: (_position: number) => {
          if (!editor) return
          editor.focus()
          const firstBlock = editor.document[0]
          if (firstBlock) {
            editor.setTextCursorPosition(firstBlock, 'start')
          }
        },
        updateSearch: (searchTerm: string, currentMatchIndex: number) => {
          if (!editor) return
          // Access the underlying TipTap editor and call the custom command
          const tiptapEditor = (editor as unknown as { _tiptapEditor?: { commands: { setSearchHighlight: (term: string, index: number) => boolean } } })._tiptapEditor
          if (tiptapEditor?.commands) {
            tiptapEditor.commands.setSearchHighlight(searchTerm, currentMatchIndex)
          }
        },
        clearSearch: () => {
          if (!editor) return
          const tiptapEditor = (editor as unknown as { _tiptapEditor?: { commands: { clearSearchHighlight: () => boolean } } })._tiptapEditor
          if (tiptapEditor?.commands) {
            tiptapEditor.commands.clearSearchHighlight()
          }
        },
        countSearchMatches: (searchTerm: string): number => {
          if (!editor || !searchTerm) return 0
          const tiptapEditor = (editor as unknown as { _tiptapEditor?: { state: { doc: { descendants: (callback: (node: { isText: boolean; text?: string }, pos: number) => void) => void } } } })._tiptapEditor
          if (!tiptapEditor?.state?.doc) return 0

          let count = 0
          const searchLower = searchTerm.toLowerCase()

          tiptapEditor.state.doc.descendants((node) => {
            if (node.isText && node.text) {
              const text = node.text.toLowerCase()
              let pos = 0
              while ((pos = text.indexOf(searchLower, pos)) !== -1) {
                count++
                pos += searchTerm.length
              }
            }
          })

          return count
        },
      }),
      [editor]
    )

    return (
      <div
        ref={containerRef}
        className={`blocknote-editor-wrapper ${className} ${debugMode && isFocused ? debugDescriptionFocusClass : ''}`}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
      >
        <BlockNoteView
          editor={editor}
          onChange={handleChange}
          theme={resolvedTheme}
          data-placeholder={placeholder}
        />
      </div>
    )
  }
)
