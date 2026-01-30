import { createReactBlockSpec } from '@blocknote/react'
import { Checkbox } from '@/components/ui/checkbox'
import { Pickaxe, Forward, StickyNote, Users } from 'lucide-react'
import type { NoteCategory } from '@/types/note'

const categoryIcons: Record<NoteCategory, React.ElementType> = {
  todo: Pickaxe,
  followup: Forward,
  notes: StickyNote,
  meeting: Users,
}

/**
 * Custom BlockNote block for task items
 * Each task is a single block with checkbox, content, and metadata props
 */
export const TaskItemBlock = createReactBlockSpec(
  {
    type: 'taskItem',
    propSchema: {
      checked: { default: false },
      category: {
        default: 'todo' as NoteCategory,
        values: ['todo', 'followup', 'notes', 'meeting'] as NoteCategory[],
      },
      deadline: { default: '' },
      pinned: { default: false },
      labelIds: { default: '[]' }, // JSON array of label IDs
      assigneeIds: { default: '[]' }, // JSON array of contact IDs
      noteId: { default: '' }, // Link to Supabase note
    },
    content: 'inline',
  },
  {
    render: (props) => {
      const { block, editor, contentRef } = props
      const { checked, category } = block.props
      const isCheckable = category === 'todo' || category === 'followup'
      const CategoryIcon = categoryIcons[category as NoteCategory] || Pickaxe

      const handleCheckedChange = (newChecked: boolean) => {
        editor.updateBlock(block, {
          props: { checked: newChecked },
        })
      }

      return (
        <div
          className={`flex items-start gap-2 py-0.5 group/task ${
            checked && isCheckable ? 'opacity-50' : ''
          }`}
        >
          {/* Checkbox or Icon */}
          <div className="flex-shrink-0 mt-0.5">
            {isCheckable ? (
              <Checkbox
                checked={checked}
                onCheckedChange={handleCheckedChange}
                className="h-4 w-4"
              />
            ) : (
              <CategoryIcon className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          {/* Content area - this is where BlockNote renders inline content */}
          <div
            ref={contentRef}
            className={`flex-1 min-w-0 outline-none ${
              checked && isCheckable ? 'line-through text-muted-foreground' : ''
            }`}
          />
        </div>
      )
    },
  }
)
