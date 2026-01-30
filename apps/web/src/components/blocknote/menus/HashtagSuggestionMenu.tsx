import { SuggestionMenuController, useBlockNoteEditor } from '@blocknote/react'
import { useTranslation } from 'react-i18next'
import type { Label, NoteCategory } from '@/types/note'

interface HashtagSuggestionMenuProps {
  labels: Label[]
  onCreateLabel?: (name: string) => void
}

interface SuggestionItem {
  title: string
  subtext?: string
  onItemClick: () => void
}

/**
 * Suggestion menu for # hashtags
 * Shows categories and labels, can create new labels
 */
export function HashtagSuggestionMenu({ labels, onCreateLabel }: HashtagSuggestionMenuProps) {
  const { t } = useTranslation()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useBlockNoteEditor() as any

  const getItems = async (query: string): Promise<SuggestionItem[]> => {
    const items: SuggestionItem[] = []
    const lowerQuery = query.toLowerCase()

    // Categories
    const categories: Array<{ value: NoteCategory; key: string }> = [
      { value: 'todo', key: 'categoryTodo' },
      { value: 'followup', key: 'categoryFollowup' },
      { value: 'notes', key: 'categoryNotes' },
      { value: 'meeting', key: 'categoryMeeting' },
    ]

    const matchingCategories = categories.filter((cat) =>
      cat.value.toLowerCase().includes(lowerQuery)
    )

    for (const cat of matchingCategories) {
      items.push({
        title: t(cat.key),
        subtext: t('setCategory'),
        onItemClick: () => {
          const block = editor.getTextCursorPosition()?.block
          if (block && block.type === 'taskItem') {
            editor.updateBlock(block, {
              props: { category: cat.value },
            })
          }
        },
      })
    }

    // Labels
    const matchingLabels = labels.filter((label) =>
      label.name.toLowerCase().includes(lowerQuery)
    )

    for (const label of matchingLabels.slice(0, 8)) {
      items.push({
        title: label.name,
        onItemClick: () => {
          editor.insertInlineContent([
            {
              type: 'labelChip',
              props: {
                labelId: label.id,
                name: label.name,
                color: label.color,
              },
            },
            { type: 'text', text: ' ', styles: {} },
          ])
        },
      })
    }

    // Create new label option
    if (
      query.length > 0 &&
      !matchingLabels.some((l) => l.name.toLowerCase() === lowerQuery) &&
      onCreateLabel
    ) {
      items.push({
        title: t('createLabelWithName', { name: query }),
        onItemClick: () => onCreateLabel(query),
      })
    }

    if (items.length === 0) {
      return [
        {
          title: t('noLabelsFound'),
          onItemClick: () => {},
        },
      ]
    }

    return items
  }

  return (
    <SuggestionMenuController
      triggerCharacter="#"
      minQueryLength={0}
      getItems={getItems}
    />
  )
}
