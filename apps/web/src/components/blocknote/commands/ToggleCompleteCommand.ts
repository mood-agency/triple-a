import type { BlockCommand, BlockCommandContext } from "./BlockCommand";
import { eventBus } from "@/events";

/**
 * ToggleCompleteCommand - Handles Ctrl+D / Cmd+D to toggle task completion
 *
 * This command:
 * 1. Prevents the default browser bookmark behavior (Ctrl+D)
 * 2. Updates the block's isChecked property
 * 3. Emits an event to notify parent components
 */
export class ToggleCompleteCommand implements BlockCommand {
    execute(context: BlockCommandContext): boolean {
        const { block, event } = context;

        // Prevent browser's bookmark dialog
        event.preventDefault();
        event.stopImmediatePropagation();

        const props = block.props as any;
        const isChecked = props.isChecked as boolean;
        const nextChecked = !isChecked;

        console.log(`🔹 Ctrl+D pressed - Toggling complete for block ${block.id} to ${nextChecked}`);

        // Emit event to parent component (BlockNoteNoteList)
        eventBus.emit('note:completed', {
            noteId: block.id,
            completed: nextChecked,
            completedAt: nextChecked ? new Date().toISOString() : null,
        });

        return true;
    }

    canExecute(context: BlockCommandContext): boolean {
        // Only toggle if category is something that can be completed
        const props = context.block.props as any;
        const category = props.category as string;
        return !!context.editor && !!context.block && (category === 'todo' || category === 'followup');
    }
}
