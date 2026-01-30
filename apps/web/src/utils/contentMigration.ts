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

    // BlockNote format: array of blocks with id or type property
    // (blocks from markdownToBlockNote may not have id yet, but have type)
    if (Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.id !== undefined || parsed[0]?.type !== undefined)) {
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
 * Parse inline Markdown formatting (bold, italic, code, links)
 */
function parseInlineMarkdown(text: string): InlineContent[] {
  const result: InlineContent[] = []
  let remaining = text

  // Regex patterns for inline formatting
  const patterns = [
    // Bold: **text** or __text__
    { regex: /\*\*(.+?)\*\*|__(.+?)__/, style: 'bold' },
    // Italic: *text* or _text_ (not followed by another _ or *)
    { regex: /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/, style: 'italic' },
    // Code: `text`
    { regex: /`(.+?)`/, style: 'code' },
    // Links: [text](url)
    { regex: /\[(.+?)\]\((.+?)\)/, type: 'link' },
  ]

  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; content: InlineContent } | null = null

    // Find bold **text**
    const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
    if (boldMatch && boldMatch.index !== undefined) {
      const idx = boldMatch.index
      if (!earliestMatch || idx < earliestMatch.index) {
        earliestMatch = {
          index: idx,
          length: boldMatch[0].length,
          content: { type: 'text', text: boldMatch[1], styles: { bold: true } },
        }
      }
    }

    // Find italic *text* (single asterisk, not double)
    const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/)
    if (italicMatch && italicMatch.index !== undefined) {
      const idx = italicMatch.index
      if (!earliestMatch || idx < earliestMatch.index) {
        earliestMatch = {
          index: idx,
          length: italicMatch[0].length,
          content: { type: 'text', text: italicMatch[1], styles: { italic: true } },
        }
      }
    }

    // Find code `text`
    const codeMatch = remaining.match(/`([^`]+)`/)
    if (codeMatch && codeMatch.index !== undefined) {
      const idx = codeMatch.index
      if (!earliestMatch || idx < earliestMatch.index) {
        earliestMatch = {
          index: idx,
          length: codeMatch[0].length,
          content: { type: 'text', text: codeMatch[1], styles: { code: true } },
        }
      }
    }

    // Find links [text](url)
    const linkMatch = remaining.match(/\[(.+?)\]\((.+?)\)/)
    if (linkMatch && linkMatch.index !== undefined) {
      const idx = linkMatch.index
      if (!earliestMatch || idx < earliestMatch.index) {
        earliestMatch = {
          index: idx,
          length: linkMatch[0].length,
          content: {
            type: 'link',
            href: linkMatch[2],
            content: [{ type: 'text', text: linkMatch[1], styles: {} }],
          },
        }
      }
    }

    if (earliestMatch) {
      // Add plain text before the match
      if (earliestMatch.index > 0) {
        result.push({
          type: 'text',
          text: remaining.slice(0, earliestMatch.index),
          styles: {},
        })
      }

      // Add the formatted content
      result.push(earliestMatch.content)

      // Continue with remaining text
      remaining = remaining.slice(earliestMatch.index + earliestMatch.length)
    } else {
      // No more matches, add remaining as plain text
      if (remaining) {
        result.push({ type: 'text', text: remaining, styles: {} })
      }
      break
    }
  }

  return result
}

/**
 * Converts Markdown text to BlockNote blocks
 */
export function markdownToBlockNote(markdown: string): PartialBlock[] {
  const lines = markdown.split('\n')
  const blocks: PartialBlock[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // Empty line - skip or create empty paragraph
    if (!trimmedLine) {
      i++
      continue
    }

    // Headings: # ## ###
    const headingMatch = trimmedLine.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3
      blocks.push({
        type: 'heading',
        props: { level },
        content: parseInlineMarkdown(headingMatch[2]),
      } as PartialBlock)
      i++
      continue
    }

    // Code block: ```
    if (trimmedLine.startsWith('```')) {
      const language = trimmedLine.slice(3).trim() || 'text'
      const codeLines: string[] = []
      i++

      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }

      blocks.push({
        type: 'codeBlock',
        props: { language },
        content: codeLines.join('\n'),
      })

      i++ // Skip closing ```
      continue
    }

    // Unordered list: - or *
    if (/^[-*]\s+/.test(trimmedLine)) {
      const listItems: PartialBlock[] = []

      while (i < lines.length) {
        const listLine = lines[i].trim()
        const listMatch = listLine.match(/^[-*]\s+(.+)$/)
        if (!listMatch) break

        listItems.push({
          type: 'bulletListItem',
          content: parseInlineMarkdown(listMatch[1]),
        } as PartialBlock)
        i++
      }

      blocks.push(...listItems)
      continue
    }

    // Ordered list: 1. 2. etc
    if (/^\d+\.\s+/.test(trimmedLine)) {
      const listItems: PartialBlock[] = []

      while (i < lines.length) {
        const listLine = lines[i].trim()
        const listMatch = listLine.match(/^\d+\.\s+(.+)$/)
        if (!listMatch) break

        listItems.push({
          type: 'numberedListItem',
          content: parseInlineMarkdown(listMatch[1]),
        } as PartialBlock)
        i++
      }

      blocks.push(...listItems)
      continue
    }

    // Checkbox list: - [ ] or - [x]
    if (/^[-*]\s+\[[ xX]\]\s+/.test(trimmedLine)) {
      const listItems: PartialBlock[] = []

      while (i < lines.length) {
        const listLine = lines[i].trim()
        const checkMatch = listLine.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/)
        if (!checkMatch) break

        listItems.push({
          type: 'checkListItem',
          props: { checked: checkMatch[1].toLowerCase() === 'x' },
          content: parseInlineMarkdown(checkMatch[2]),
        } as PartialBlock)
        i++
      }

      blocks.push(...listItems)
      continue
    }

    // Table: | ... |
    if (trimmedLine.includes('|') && lines[i + 1]?.trim().match(/^\|?[\s-:|]+\|?$/)) {
      const tableRows: Array<{ cells: Array<Array<{ type: 'text'; text: string; styles: Record<string, never> }>> }> = []

      while (i < lines.length && lines[i].includes('|')) {
        const tableLine = lines[i].trim()

        // Skip separator row
        if (/^\|?[\s-:|]+\|?$/.test(tableLine)) {
          i++
          continue
        }

        const cellTexts = tableLine
          .split('|')
          .map(cell => cell.trim())
          .filter((_, index, arr) => {
            if (index === 0 && arr[0] === '') return false
            if (index === arr.length - 1 && arr[arr.length - 1] === '') return false
            return true
          })

        if (cellTexts.length > 0) {
          tableRows.push({
            cells: cellTexts.map(cellText => [{
              type: 'text' as const,
              text: cellText,
              styles: {} as Record<string, never>,
            }]),
          })
        }

        i++
      }

      if (tableRows.length > 0) {
        blocks.push({
          type: 'table',
          content: {
            type: 'tableContent',
            rows: tableRows,
          },
        } as unknown as PartialBlock)
      }

      continue
    }

    // Regular paragraph
    blocks.push({
      type: 'paragraph',
      content: parseInlineMarkdown(trimmedLine),
    } as PartialBlock)
    i++
  }

  return blocks
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
