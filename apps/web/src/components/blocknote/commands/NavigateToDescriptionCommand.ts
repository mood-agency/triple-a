import type { BlockCommand, BlockCommandContext } from './BlockCommand';

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

        // Dispatch custom event to notify the parent component
        window.dispatchEvent(new CustomEvent('notepad:navigateToDescription', {
            detail: { noteId }
        }));

        // Prevent default Tab behavior
        context.event.preventDefault();
        return true;
    }

    undo?(): void {
        // No undo needed for navigation
    }
}
