import type { BlockCommand, BlockCommandContext } from "./BlockCommand";

/**
 * NavigateBlockCommand - Handles ArrowUp/ArrowDown to navigate between blocks
 *
 * Navigates to the previous/next block while trying to maintain the same
 * horizontal cursor position (character offset).
 */
export class NavigateBlockCommand implements BlockCommand {
  private direction: "up" | "down";

  constructor(direction: "up" | "down") {
    this.direction = direction;
  }

  execute(context: BlockCommandContext): boolean {
    const { editor, block, event, node } = context;

    const document = editor.document;
    const currentIndex = document.findIndex((b) => b.id === block.id);

    if (currentIndex === -1) return false;

    // Get the current cursor offset within the text content
    const currentOffset = this.getCursorOffset(node);

    if (this.direction === "up") {
      // Navigate to previous block
      if (currentIndex > 0) {
        event.preventDefault();
        event.stopPropagation();

        const previousBlock = document[currentIndex - 1];

        // Set cursor to start first, then adjust position
        editor.setTextCursorPosition(previousBlock, "start");

        // After a microtask, adjust the cursor position
        requestAnimationFrame(() => {
          this.setCursorAtOffset(editor, previousBlock.id, currentOffset);
        });

        return true;
      }
    } else {
      // Navigate to next block
      if (currentIndex < document.length - 1) {
        event.preventDefault();
        event.stopPropagation();

        const nextBlock = document[currentIndex + 1];

        // Set cursor to start first, then adjust position
        editor.setTextCursorPosition(nextBlock, "start");

        // After a microtask, adjust the cursor position
        requestAnimationFrame(() => {
          this.setCursorAtOffset(editor, nextBlock.id, currentOffset);
        });

        return true;
      }
    }

    return false;
  }

  /**
   * Get the current cursor offset from the start of the editable content
   */
  private getCursorOffset(node: HTMLElement): number {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;

    const range = selection.getRangeAt(0);

    // Create a range from the start of the node to the cursor position
    const preCaretRange = document.createRange();
    preCaretRange.selectNodeContents(node);
    preCaretRange.setEnd(range.startContainer, range.startOffset);

    // Get the text content length up to the cursor
    return preCaretRange.toString().length;
  }

  /**
   * Set the cursor at a specific character offset within a block
   */
  private setCursorAtOffset(editor: any, blockId: string, targetOffset: number): void {
    // Find the block's content element
    const blockElement = document.querySelector(`[data-id="${blockId}"]`);
    if (!blockElement) return;

    const contentElement = blockElement.querySelector('.notepad-content');
    if (!contentElement) return;

    // Get the text content length of the target block
    const textContent = contentElement.textContent || "";
    const maxOffset = textContent.length;

    // Clamp the offset to the available text length
    const actualOffset = Math.min(targetOffset, maxOffset);

    // Walk through text nodes to find the right position
    const walker = document.createTreeWalker(
      contentElement,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let targetNode: Text | null = null;
    let nodeOffset = 0;

    while (walker.nextNode()) {
      const textNode = walker.currentNode as Text;
      const nodeLength = textNode.length;

      if (currentOffset + nodeLength >= actualOffset) {
        targetNode = textNode;
        nodeOffset = actualOffset - currentOffset;
        break;
      }

      currentOffset += nodeLength;
    }

    if (targetNode) {
      const selection = window.getSelection();
      if (selection) {
        const range = document.createRange();
        range.setStart(targetNode, nodeOffset);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  canExecute(context: BlockCommandContext): boolean {
    const { editor, block } = context;

    if (!editor || !block) return false;

    // Get the selection
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);

    // Only execute if it's a collapsed selection (no text selected)
    if (!range.collapsed) return false;

    const document = editor.document;
    const currentIndex = document.findIndex((b) => b.id === block.id);

    if (this.direction === "up") {
      // Can execute if there's a previous block
      return currentIndex > 0;
    } else {
      // Can execute if there's a next block
      return currentIndex < document.length - 1;
    }
  }
}
