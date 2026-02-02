import type { BlockCommand, BlockCommandContext } from "./BlockCommand";

/**
 * NavigateUpCommand - Handles ArrowUp key to move to the previous notepad block
 *
 * Moves the cursor to the end of the previous block, allowing quick navigation
 * between tasks without using the mouse.
 */
export class NavigateUpCommand implements BlockCommand {
  execute(context: BlockCommandContext): boolean {
    const { editor, block, event } = context;

    event.preventDefault();
    event.stopPropagation();

    // Get all blocks in the document
    const blocks = editor.document;
    const currentIndex = blocks.findIndex(b => b.id === block.id);

    // If we're at the first block or block not found, do nothing
    if (currentIndex <= 0) {
      return true;
    }

    // Get the previous block
    const prevBlock = blocks[currentIndex - 1];
    if (prevBlock && prevBlock.type === 'notepad') {
      editor.setTextCursorPosition(prevBlock, 'end');
    }

    return true;
  }

  canExecute(context: BlockCommandContext): boolean {
    return !!context.editor && !!context.block;
  }
}
