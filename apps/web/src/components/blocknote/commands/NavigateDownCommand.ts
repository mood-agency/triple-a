import type { BlockCommand, BlockCommandContext } from "./BlockCommand";

/**
 * NavigateDownCommand - Handles ArrowDown key to move to the next notepad block
 *
 * Moves the cursor to the start of the next block, allowing quick navigation
 * between tasks without using the mouse.
 */
export class NavigateDownCommand implements BlockCommand {
  execute(context: BlockCommandContext): boolean {
    const { editor, block, event } = context;

    event.preventDefault();
    event.stopPropagation();

    // Get all blocks in the document
    const blocks = editor.document;
    const currentIndex = blocks.findIndex(b => b.id === block.id);

    // If we're at the last block or block not found, do nothing
    if (currentIndex === -1 || currentIndex >= blocks.length - 1) {
      return true;
    }

    // Get the next block
    const nextBlock = blocks[currentIndex + 1];
    if (nextBlock && nextBlock.type === 'notepad') {
      editor.setTextCursorPosition(nextBlock, 'start');
    }

    return true;
  }

  canExecute(context: BlockCommandContext): boolean {
    return !!context.editor && !!context.block;
  }
}
