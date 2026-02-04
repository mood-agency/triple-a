import type { BlockCommand, BlockCommandContext } from "./BlockCommand";

/**
 * PreventNavigateOutCommand - Prevents cursor from leaving the editable content
 *
 * When cursor is at the start and ArrowLeft is pressed, prevents navigation.
 * When cursor is at the end and ArrowRight is pressed, prevents navigation.
 * This stops the cursor from moving into non-editable elements like checkboxes.
 */
export class PreventNavigateOutCommand implements BlockCommand {
  private direction: "left" | "right";

  constructor(direction: "left" | "right") {
    this.direction = direction;
  }

  execute(context: BlockCommandContext): boolean {
    const { event } = context;

    // Simply prevent the default behavior to stop cursor movement
    event.preventDefault();
    event.stopPropagation();

    return true;
  }

  canExecute(context: BlockCommandContext): boolean {
    const { editor, block, node } = context;

    if (!editor || !block) return false;

    // Get the selection to check cursor position
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return false;

    const range = selection.getRangeAt(0);

    // Only execute if it's a collapsed selection (no text selected)
    if (!range.collapsed) return false;

    if (this.direction === "left") {
      // Check if cursor is at the start of the block
      return this.isCursorAtStart(node, range);
    } else {
      // Check if cursor is at the end of the block
      return this.isCursorAtEnd(node, range);
    }
  }

  private isCursorAtStart(node: HTMLElement, range: Range): boolean {
    // If range offset is not 0, cursor is not at start
    if (range.startOffset !== 0) return false;

    // Check if the cursor is at the very beginning of the editable content
    const startContainer = range.startContainer;

    // If the container is the node itself, cursor is at start
    if (startContainer === node) return true;

    // Walk up from startContainer to node, checking if we're at the first position
    let current: Node | null = startContainer;
    while (current && current !== node) {
      const parent: ParentNode | null = current.parentNode;
      if (!parent) break;

      // Check if current is the first child
      if (parent.firstChild !== current) {
        // There's content before the cursor
        return false;
      }
      current = parent;
    }

    return true;
  }

  private isCursorAtEnd(node: HTMLElement, range: Range): boolean {
    const startContainer = range.startContainer;
    const offset = range.startOffset;

    // If it's a text node, check if we're at the end of the text
    if (startContainer.nodeType === Node.TEXT_NODE) {
      const textLength = startContainer.textContent?.length || 0;
      if (offset !== textLength) return false;
    }

    // Check if the cursor is at the very end of the editable content
    let current: Node | null = startContainer;
    while (current && current !== node) {
      const parent: ParentNode | null = current.parentNode;
      if (!parent) break;

      // Check if current is the last child
      if (parent.lastChild !== current) {
        // There's content after the cursor
        return false;
      }
      current = parent;
    }

    return true;
  }
}
