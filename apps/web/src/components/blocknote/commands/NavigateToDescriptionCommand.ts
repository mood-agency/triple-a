import type { BlockCommand, BlockCommandContext } from './BlockCommand';
import { eventBus } from "@/events";

/**
 * Command to navigate to the description panel when Tab is pressed
 */
export class NavigateToDescriptionCommand implements BlockCommand {
    canExecute(context: BlockCommandContext): boolean {
        // Only execute if Tab is pressed
        return context.event.key === 'Tab';
    }

    execute(context: BlockCommandContext): boolean {
        const noteId = context.block.id;

        // Emit event to notify the parent component
        eventBus.emit('editor:navigateToDescription', { noteId });

        // Prevent default Tab behavior
        context.event.preventDefault();
        return true;
    }

    undo?(): void {
        // No undo needed for navigation
    }
}
