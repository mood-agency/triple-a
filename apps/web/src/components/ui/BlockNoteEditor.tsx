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
import '@blocknote/core/fonts/inter.css'
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
    { value, onChange, onBlur, onFocus, onKeyDown, placeholder, className = '', noteId },
    ref
  ) {
    const lastExternalValueRef = useRef(value)
    const isInitializedRef = useRef(false)
    const editorRef = useRef<BlockNoteEditorCore | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const { debugMode, debugDescriptionFocusClass } = useDebugNavigation()
    const [isFocused, setIsFocused] = useState(false)
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

    // Handle paste for Markdown tables
    useEffect(() => {
      if (!editor || !containerRef.current) return

      const handlePaste = (event: ClipboardEvent) => {
        const text = event.clipboardData?.getData('text/plain')
        if (!text || !isMarkdownTable(text)) return

        const tableBlock = parseMarkdownTable(text)
        if (!tableBlock) return

        // Prevent default paste behavior
        event.preventDefault()
        event.stopPropagation()

        // Insert the table block at current cursor position
        const currentBlock = editor.getTextCursorPosition()?.block
        if (currentBlock) {
          editor.insertBlocks([tableBlock as Parameters<typeof editor.insertBlocks>[0][0]], currentBlock, 'after')
        } else {
          editor.insertBlocks([tableBlock as Parameters<typeof editor.insertBlocks>[0][0]], editor.document[0], 'before')
        }
      }

      const container = containerRef.current
      container.addEventListener('paste', handlePaste as EventListener, true)
      return () => {
        container.removeEventListener('paste', handlePaste as EventListener, true)
      }
    }, [editor])

    // Handle content changes
    const handleChange = useCallback(() => {
      if (!editor) return
      const json = JSON.stringify(editor.document)
      console.log('[BlockNoteEditor] onChange triggered:', {
        noteId,
        jsonLength: json.length,
        jsonPreview: json.substring(0, 100),
      });
      lastExternalValueRef.current = json
      onChange(json)
    }, [editor, onChange, noteId])

    // Initialize content
    useEffect(() => {
      if (!editor || isInitializedRef.current) return
      isInitializedRef.current = true
    }, [editor])

    // Sync value from external source (when switching notes)
    useEffect(() => {
      if (!editor || !isInitializedRef.current) return

      if (lastExternalValueRef.current !== value) {
        console.log('[BlockNoteEditor] ⚠️ External value changed, will replaceBlocks:', {
          noteId,
          lastExternalValueLength: lastExternalValueRef.current?.length ?? 0,
          newValueLength: value?.length ?? 0,
          lastExternalValuePreview: lastExternalValueRef.current?.substring(0, 100),
          newValuePreview: value?.substring(0, 100),
        });
        lastExternalValueRef.current = value

        const format = detectContentFormat(value)
        let blocks

        switch (format) {
          case 'empty':
            blocks = []
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

        editor.replaceBlocks(editor.document, blocks)
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

        if (onKeyDown) {
          onKeyDown(event)
          if (event.key === 'Escape') {
            event.preventDefault()
            event.stopPropagation()
          }
        }
      },
      [onKeyDown]
    )

    // Handle focus/blur
    const handleFocus = useCallback(() => {
      setIsFocused(true)
      onFocus?.()
    }, [onFocus])

    const handleBlur = useCallback(() => {
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
          // BlockNote uses block-based selection, this is a simplified implementation
          editor?.focus()
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
