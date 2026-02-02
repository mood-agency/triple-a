import type { BlockCommand, BlockCommandContext } from "./BlockCommand";
import { eventBus } from "@/events";

/**
 * ToggleSidebarCommand - Handles Ctrl+S / Cmd+S to toggle task fixed-in-sidebar state
 */
export class ToggleSidebarCommand implements BlockCommand {
    execute(context: BlockCommandContext): boolean {
        const { block, event } = context;

        // Prevent browser's save dialog
        event.preventDefault();
        event.stopImmediatePropagation();

        const props = block.props as any;
        const isFixed = props.fixedInSidebar as boolean;
        const nextFixed = !isFixed;

        console.log(`🔹 Ctrl+S pressed - Toggling sidebar fix for block ${block.id} to ${nextFixed}`);

        // Emit event to parent component (BlockNoteNoteList)
        eventBus.emit('note:fixedInSidebar', {
            noteId: block.id,
            fixedInSidebar: nextFixed,
        });

        return true;
    }

    canExecute(context: BlockCommandContext): boolean {
        return !!context.editor && !!context.block;
    }
}
