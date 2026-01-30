import { SuggestionMenuController, useBlockNoteEditor } from '@blocknote/react'
import { useTranslation } from 'react-i18next'
import { getInitials } from '@/lib/utils'
import type { Contact } from '@/types/contact'

interface AssigneeSuggestionMenuProps {
  contacts: Contact[]
}

interface SuggestionItem {
  title: string
  subtext?: string
  onItemClick: () => void
}

/**
 * Suggestion menu for @ mentions
 * Shows list of contacts and inserts AssigneeChip when selected
 */
export function AssigneeSuggestionMenu({ contacts }: AssigneeSuggestionMenuProps) {
  const { t } = useTranslation()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useBlockNoteEditor() as any

  const getItems = async (query: string): Promise<SuggestionItem[]> => {
    const filtered = contacts.filter((contact) => {
      const fullName = `${contact.name} ${contact.lastname}`.toLowerCase()
      return fullName.includes(query.toLowerCase())
    })

    if (filtered.length === 0) {
      return [
        {
          title: t('assignee.noResults'),
          onItemClick: () => {},
        },
      ]
    }

    return filtered.slice(0, 10).map((contact) => {
      const fullName = `${contact.name} ${contact.lastname}`.trim()
      const initials = getInitials(contact.name, contact.lastname)

      return {
        title: fullName,
        subtext: contact.email || undefined,
        onItemClick: () => {
          editor.insertInlineContent([
            {
              type: 'assigneeChip',
              props: {
                contactId: contact.id,
                initials,
                fullName,
              },
            },
            { type: 'text', text: ' ', styles: {} },
          ])
        },
      }
    })
  }

  return (
    <SuggestionMenuController
      triggerCharacter="@"
      minQueryLength={0}
      getItems={getItems}
    />
  )
}
