import { createReactInlineContentSpec } from '@blocknote/react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

/**
 * Inline content for assignee chips
 * Renders as a chip with initials and tooltip showing full name
 */
export const AssigneeChip = createReactInlineContentSpec(
  {
    type: 'assigneeChip',
    propSchema: {
      contactId: { default: '' },
      initials: { default: '' },
      fullName: { default: '' },
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { initials, fullName } = props.inlineContent.props

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="chip-assignee mx-0.5 cursor-default"
              contentEditable={false}
            >
              {initials}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{fullName}</p>
          </TooltipContent>
        </Tooltip>
      )
    },
  }
)
