import type { BlockCommand, BlockCommandContext } from "./BlockCommand";
import { eventBus } from "@/events";

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

        // Emit event to parent component (BlockNoteNoteList)
        eventBus.emit('note:pinned', {
            noteId: block.id,
            pinned: nextPinned,
        });

        return true;
    }

    canExecute(context: BlockCommandContext): boolean {
        return !!context.editor && !!context.block;
    }
}
