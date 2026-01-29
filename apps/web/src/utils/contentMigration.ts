import type { Block, PartialBlock } from '@blocknote/core'

type ContentFormat = 'tiptap' | 'blocknote' | 'plain' | 'empty'

interface TipTapNode {
  type: string
  content?: TipTapNode[]
  text?: string
  attrs?: Record<string, unknown>
  marks?: TipTapMark[]
}

interface TipTapMark {
  type: string
  attrs?: Record<string, unknown>
}

interface TipTapDoc {
  type: 'doc'
  content?: TipTapNode[]
}

/**
 * Detects the format of the content string
 */
export function detectContentFormat(content: string | null | undefined): ContentFormat {
  if (!content || content.trim() === '') {
    return 'empty'
  }

  try {
    const parsed = JSON.parse(content)

    // TipTap format: { type: "doc", content: [...] }
    if (parsed.type === 'doc' && Array.isArray(parsed.content)) {
      return 'tiptap'
    }

    // BlockNote format: array of blocks with id property
    if (Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.id !== undefined)) {
      return 'blocknote'
    }

    // Unknown JSON format, treat as plain text
    return 'plain'
  } catch {
    // Not JSON, treat as plain text
    return 'plain'
  }
}

/**
 * Converts TipTap inline marks to BlockNote inline content styles
 * Note: Links are handled separately as they are a different content type in BlockNote
 */
function convertMarks(marks?: TipTapMark[]): Record<string, boolean> {
  const styles: Record<string, boolean> = {}

  if (!marks) return styles

  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        styles.bold = true
        break
      case 'italic':
        styles.italic = true
        break
      case 'strike':
        styles.strike = true
        break
      case 'code':
        styles.code = true
        break
      // Links are not styles in BlockNote - they are a separate content type
      // Handled in convertInlineContent instead
    }
  }

  return styles
}

type TextContent = { type: 'text'; text: string; styles: Record<string, boolean> }
type LinkContent = { type: 'link'; content: TextContent[]; href: string }
type InlineContent = TextContent | LinkContent

/**
 * Converts TipTap inline content (text with marks) to BlockNote inline content
 */
function convertInlineContent(nodes?: TipTapNode[]): InlineContent[] {
  if (!nodes) return []

  const result: InlineContent[] = []

  for (const node of nodes) {
    if (node.type === 'text' && node.text) {
      const styles = convertMarks(node.marks)

      // Check if this is a link
      const linkMark = node.marks?.find(m => m.type === 'link')
      if (linkMark?.attrs?.href) {
        result.push({
          type: 'link',
          href: linkMark.attrs.href as string,
          content: [{
            type: 'text',
            text: node.text,
            styles,
          }],
        })
      } else {
        result.push({
          type: 'text',
          text: node.text,
          styles,
        })
      }
    } else if (node.type === 'hardBreak') {
      result.push({
        type: 'text',
        text: '\n',
        styles: {},
      })
    }
  }

  return result
}

/**
 * Extracts text content from TipTap nodes
 */
function extractTextContent(nodes?: TipTapNode[]): string {
  if (!nodes) return ''

  return nodes
    .map(node => {
      if (node.text) return node.text
      if (node.type === 'hardBreak') return '\n'
      if (node.content) return extractTextContent(node.content)
      return ''
    })
    .join('')
}

/**
 * Converts a TipTap list (bullet or ordered) to BlockNote list items
 */
function convertListItems(
  listNode: TipTapNode,
  listType: 'bulletListItem' | 'numberedListItem'
): PartialBlock[] {
  const blocks: PartialBlock[] = []

  if (!listNode.content) return blocks

  for (const listItem of listNode.content) {
    if (listItem.type !== 'listItem') continue

    // First paragraph content becomes the list item content
    const firstParagraph = listItem.content?.find(n => n.type === 'paragraph')
    const nestedLists = listItem.content?.filter(n =>
      n.type === 'bulletList' || n.type === 'orderedList'
    ) || []

    const block = {
      type: listType,
      content: firstParagraph?.content
        ? convertInlineContent(firstParagraph.content)
        : [],
    } as PartialBlock

    // Handle nested lists
    if (nestedLists.length > 0) {
      block.children = nestedLists.flatMap(nestedList =>
        convertListItems(
          nestedList,
          nestedList.type === 'bulletList' ? 'bulletListItem' : 'numberedListItem'
        )
      )
    }

    blocks.push(block)
  }

  return blocks
}

/**
 * Converts a TipTap task list to BlockNote check list items
 */
function convertTaskList(taskListNode: TipTapNode): PartialBlock[] {
  const blocks: PartialBlock[] = []

  if (!taskListNode.content) return blocks

  for (const taskItem of taskListNode.content) {
    if (taskItem.type !== 'taskItem') continue

    const paragraph = taskItem.content?.find(n => n.type === 'paragraph')

    blocks.push({
      type: 'checkListItem',
      props: {
        checked: taskItem.attrs?.checked === true,
      },
      content: paragraph?.content
        ? convertInlineContent(paragraph.content)
        : [],
    } as PartialBlock)
  }

  return blocks
}

/**
 * Converts a single TipTap node to BlockNote block(s)
 */
function convertNode(node: TipTapNode): PartialBlock[] {
  switch (node.type) {
    case 'paragraph':
      return [{
        type: 'paragraph',
        content: convertInlineContent(node.content),
      } as PartialBlock]

    case 'heading':
      return [{
        type: 'heading',
        props: {
          level: (node.attrs?.level as 1 | 2 | 3) || 1,
        },
        content: convertInlineContent(node.content),
      } as PartialBlock]

    case 'bulletList':
      return convertListItems(node, 'bulletListItem')

    case 'orderedList':
      return convertListItems(node, 'numberedListItem')

    case 'taskList':
      return convertTaskList(node)

    case 'codeBlock':
      return [{
        type: 'codeBlock',
        props: {
          language: (node.attrs?.language as string) || 'text',
        },
        content: extractTextContent(node.content),
      }]

    case 'image':
      return [{
        type: 'image',
        props: {
          url: (node.attrs?.src as string) || '',
          caption: (node.attrs?.alt as string) || '',
          previewWidth: 512,
        },
      }]

    case 'horizontalRule':
      // BlockNote doesn't have horizontal rule, skip or convert to empty paragraph
      return []

    case 'blockquote':
      // Convert blockquote to paragraph (BlockNote default doesn't have blockquote)
      if (node.content) {
        return node.content.flatMap(convertNode)
      }
      return []

    default:
      // Unknown node type, try to extract text content
      if (node.content) {
        return node.content.flatMap(convertNode)
      }
      return []
  }
}

/**
 * Converts TipTap JSON document to BlockNote blocks
 */
export function tiptapToBlockNote(tiptapDoc: TipTapDoc): PartialBlock[] {
  if (!tiptapDoc.content) return []

  return tiptapDoc.content.flatMap(convertNode)
}

/**
 * Converts plain text to BlockNote blocks
 */
export function plainTextToBlockNote(text: string): PartialBlock[] {
  const lines = text.split('\n')

  return lines.map(line => ({
    type: 'paragraph' as const,
    content: line ? [{ type: 'text' as const, text: line, styles: {} }] : [],
  }))
}

/**
 * Migrates content to BlockNote format
 * Returns the BlockNote JSON string, or null if content is empty
 */
export function migrateContent(content: string | null | undefined): string | null {
  const format = detectContentFormat(content)

  switch (format) {
    case 'empty':
      return null

    case 'blocknote':
      // Already in BlockNote format
      return content!

    case 'tiptap':
      try {
        const tiptapDoc = JSON.parse(content!) as TipTapDoc
        const blocks = tiptapToBlockNote(tiptapDoc)
        return JSON.stringify(blocks)
      } catch {
        // Fallback to plain text conversion
        return JSON.stringify(plainTextToBlockNote(content!))
      }

    case 'plain':
      return JSON.stringify(plainTextToBlockNote(content!))
  }
}

/**
 * Parses BlockNote content string to blocks
 */
export function parseBlockNoteContent(content: string | null | undefined): Block[] {
  if (!content) return []

  const format = detectContentFormat(content)

  if (format === 'blocknote') {
    try {
      return JSON.parse(content) as Block[]
    } catch {
      return []
    }
  }

  // Migrate and parse
  const migrated = migrateContent(content)
  if (!migrated) return []

  try {
    return JSON.parse(migrated) as Block[]
  } catch {
    return []
  }
}
