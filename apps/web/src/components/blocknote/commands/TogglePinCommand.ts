import type { BlockCommand, BlockCommandContext } from "./BlockCommand";

/**
 * TogglePinCommand - Handles Ctrl+P / Cmd+P to toggle task pin state
 */
export class TogglePinCommand implements BlockCommand {
    execute(context: BlockCommandContext): boolean {
        const { block, event } = context;

        // Prevent browser's print dialog
        event.preventDefault();
        event.stopImmediatePropagation();

        const props = block.props as any;
        const isPinned = props.pinned as boolean;
        const nextPinned = !isPinned;

        console.log(`🔹 Ctrl+P pressed - Toggling pin for block ${block.id} to ${nextPinned}`);

        // Dispatch custom event to parent component (BlockNoteNoteList)
        window.dispatchEvent(new CustomEvent('notepad:togglePin', {
            detail: { noteId: block.id }
        }));

        return true;
    }

    canExecute(context: BlockCommandContext): boolean {
        return !!context.editor && !!context.block;
    }
}
