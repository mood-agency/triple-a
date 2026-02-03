import type { BlockCommand, BlockCommandContext } from "./BlockCommand";
import { eventBus } from "@/events";

/**
 * DeleteBlockCommand - Handles Backspace key to delete the current block
 *
 * Behavior:
 * - If block is empty OR Ctrl/Cmd+Backspace is pressed: delete the block
 * - Moves cursor to previous block if available, otherwise next block
 * - If this is the only block, convert it to a paragraph instead of deleting
 *
 * Implementation extracted from NotepadBlock.tsx lines 107-126
 */
export class DeleteBlockCommand implements BlockCommand {
  execute(context: BlockCommandContext): boolean {
    const { editor, block, node, event } = context;

    // Check if block is empty
    const textContent = node.textContent || "";
    const isEmpty = textContent.trim() === "" || textContent === "\u200B";

    // Only execute if block is empty OR Ctrl/Cmd+Backspace is pressed
    if (!isEmpty && !event.ctrlKey && !event.metaKey) {
      return false;
    }

    event.preventDefault();
    event.stopPropagation();

    // Non-empty block with Ctrl/Cmd+Backspace: show delete dialog
    if (!isEmpty) {
      eventBus.emit('note:requestDelete', { noteId: block.id });
      return true;
    }

    // Empty block: auto-delete without dialog
    const cursorInfo = editor.getTextCursorPosition();
    const prevBlock = cursorInfo?.prevBlock;
    const nextBlock = cursorInfo?.nextBlock;

    // Move cursor to previous block (preferred) or next block
    if (prevBlock) {
      editor.setTextCursorPosition(prevBlock, "end");
    } else if (nextBlock) {
      editor.setTextCursorPosition(nextBlock, "start");
    }

    // If this is the only block, convert to paragraph instead of deleting
    if (!prevBlock && !nextBlock) {
      editor.updateBlock(block, { type: "paragraph" } as any);
    } else {
      eventBus.emit('note:deleted', {
        noteId: block.id,
        reason: 'empty',
      });

      editor.removeBlocks([block]);
    }

    return true;
  }

  canExecute(context: BlockCommandContext): boolean {
    const { node, event } = context;

    // Check if block is empty
    const textContent = node.textContent || "";
    const isEmpty = textContent.trim() === "" || textContent === "\u200B";

    // Can execute if block is empty OR Ctrl/Cmd+Backspace is pressed
    return isEmpty || event.ctrlKey || event.metaKey;
  }
}
