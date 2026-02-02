import type { BlockCommand, BlockCommandContext } from './BlockCommand';
import { eventBus } from "@/events";

/**
 * Get the cursor offset within the current block's text content
 */
function getCursorOffsetInBlock(context: BlockCommandContext): number {
    const { editor } = context;

    // Get the ProseMirror selection from the editor
    const pmState = editor._tiptapEditor?.state;
    if (!pmState) return 0;

    const { selection } = pmState;
    const { $anchor: _anchor } = selection;

    // Find the position of the block's content start
    const blockPos = editor.getTextCursorPosition();
    if (!blockPos) return 0;

    // Get the DOM node for the block and calculate offset
    const blockElement = context.node;
    const editableElement = blockElement.querySelector('[contenteditable="true"]');

    if (!editableElement) return 0;

    // Use window selection to get precise cursor position
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.rangeCount === 0) return 0;

    const range = windowSelection.getRangeAt(0);

    // Calculate offset by counting characters before cursor
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(editableElement);
    preCaretRange.setEnd(range.startContainer, range.startOffset);

    return preCaretRange.toString().length;
}

/**
 * Get the current text content of a block
 */
function getBlockContent(context: BlockCommandContext): string {
    const blockElement = context.node;
    const contentElement = blockElement.querySelector('.notepad-content');
    return contentElement?.textContent || '';
}

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
        const cursorOffset = getCursorOffsetInBlock(context);
        const content = getBlockContent(context);

        // Emit event to notify the parent component (include content for immediate UI update)
        eventBus.emit('editor:navigateToDescription', { noteId, cursorOffset, content });

        // Prevent default Tab behavior
        context.event.preventDefault();
        return true;
    }

    undo?(): void {
        // No undo needed for navigation
    }
}
