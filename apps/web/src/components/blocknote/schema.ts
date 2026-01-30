import {
  BlockNoteSchema,
  defaultBlockSpecs,
  defaultInlineContentSpecs,
  createCodeBlockSpec,
} from '@blocknote/core'
import { codeBlockOptions } from '@blocknote/code-block'
import { TaskItemBlock } from './blocks/TaskItemBlock'
import { LabelChip } from './inline/LabelChip'
import { AssigneeChip } from './inline/AssigneeChip'

/**
 * Custom BlockNote schema for task list editor
 * Includes TaskItemBlock for tasks and inline chips for labels/assignees
 */
export const taskListSchema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    codeBlock: createCodeBlockSpec(codeBlockOptions),
    taskItem: TaskItemBlock(),
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    labelChip: LabelChip,
    assigneeChip: AssigneeChip,
  },
})

export type TaskListSchema = typeof taskListSchema
