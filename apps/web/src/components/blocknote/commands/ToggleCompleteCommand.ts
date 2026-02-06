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

        if (nextChecked) {
            // Completing: animate first, then emit event after animation
            const blockElement = document.querySelector(`[data-id="${block.id}"]`);
            const notepadLine = blockElement?.querySelector('.notepad-line');
            const notepadContent = blockElement?.querySelector('.notepad-content');

            notepadLine?.classList.add('is-completing');
            notepadContent?.classList.add('is-completing');

            setTimeout(() => {
                eventBus.emit('note:completed', {
                    noteId: block.id,
                    completed: true,
                    completedAt: new Date().toISOString(),
                });
            }, 600);
        } else {
            // Uncompleting: emit immediately
            eventBus.emit('note:completed', {
                noteId: block.id,
                completed: false,
                completedAt: null,
            });
        }

        return true;
    }

    canExecute(context: BlockCommandContext): boolean {
        // Only toggle if category is something that can be completed
        const props = context.block.props as any;
        const category = props.category as string;
        return !!context.editor && !!context.block && (category === 'todo' || category === 'followup');
    }
}
