import type { BlockCommand, BlockCommandContext } from "./BlockCommand";

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

        // Dispatch custom event to parent component (BlockNoteNoteList)
        window.dispatchEvent(new CustomEvent('notepad:toggleFixInSidebar', {
            detail: { noteId: block.id }
        }));

        return true;
    }

    canExecute(context: BlockCommandContext): boolean {
        return !!context.editor && !!context.block;
    }
}
