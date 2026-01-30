import { createReactInlineContentSpec } from '@blocknote/react'

/**
 * Inline content for label chips
 * Renders as a colored chip with the label name
 */
export const LabelChip = createReactInlineContentSpec(
  {
    type: 'labelChip',
    propSchema: {
      labelId: { default: '' },
      name: { default: '' },
      color: { default: '#6b7280' }, // gray-500 default
    },
    content: 'none',
  },
  {
    render: (props) => {
      const { name, color } = props.inlineContent.props

      return (
        <span
          className="chip-label mx-0.5"
          style={{ backgroundColor: color }}
          contentEditable={false}
        >
          {name}
        </span>
      )
    },
  }
)
