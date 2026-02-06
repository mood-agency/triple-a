import { useEffect } from "react";
import type { BlockNoteEditor, Block } from "@blocknote/core";
import { commandRegistry, getKeyCombo } from "../commands/CommandRegistry";
import type { BlockCommandContext } from "../commands/BlockCommand";

const DEBUG_BLOCKNOTE = false;

/**
 * Custom hook to handle keyboard commands for BlockNote blocks
 *
 * This hook sets up keyboard event listeners and delegates to the CommandRegistry
 * to execute the appropriate commands based on key combinations.
 *
 * @param node - The DOM node containing the editable block content
 * @param editor - The BlockNote editor instance
 * @param block - The current block being rendered
 *
 * Critical implementation details:
 * - Uses capture phase (capture: true) for BlockNote compatibility
 * - Calls stopImmediatePropagation() to prevent BlockNote's default handling
 * - Checks if event target is inside the node before processing
 */
export function useBlockCommands(
  node: HTMLElement | null,
  editor: BlockNoteEditor<any>,
  block: Block
): void {
  useEffect(() => {
    if (!node) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editor || !block) return;

      // Skip when a dialog/modal is open — capture phase fires before
      // the dialog can stopPropagation, so we must check here
      if ((e.target as HTMLElement).closest?.('[role="dialog"]')) return;

      // Check if the event originated from inside this block
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode;

      const isInside =
        (anchorNode && node.contains(anchorNode)) ||
        node.contains(e.target as Node) ||
        node.parentElement?.contains(e.target as Node) ||
        e.target === node;

      if (!isInside) return;

      // Convert keyboard event to key combination string
      const keyCombo = getKeyCombo(e);

      if (DEBUG_BLOCKNOTE && e.key === 'Tab') {
        const allBlocks = editor.document;
        const currentBlockIndex = allBlocks.findIndex(b => b.id === block.id);
        const isLastBlock = currentBlockIndex === allBlocks.length - 1;
        console.log(`[useBlockCommands] 🔍 Tab pressed - Block ${block.id.substring(0, 8)}... (index: ${currentBlockIndex}, isLast: ${isLastBlock}, isInside: ${isInside})`);
      }

      if (DEBUG_BLOCKNOTE) {
        console.log(`[useBlockCommands] ⌨️ Key pressed in block ${block.id}: "${e.key}", combo: "${keyCombo}"`);
      }

      // Execute the command if registered
      if (commandRegistry.hasCommand(keyCombo)) {
        // Stop event propagation only for registered commands
        e.stopImmediatePropagation();

        // Create command context
        const context: BlockCommandContext = {
          editor,
          block,
          node,
          event: e,
        };

        const executed = commandRegistry.executeCommand(keyCombo, context);
        if (DEBUG_BLOCKNOTE && e.key === 'Tab') {
          console.log(`[useBlockCommands] ✅ Tab command executed: ${executed} for block ${block.id.substring(0, 8)}...`);
        }
        if (executed) {
          // Command executed successfully
        }
      }
    };

    // Use capture phase to intercept events before BlockNote's handlers
    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [node, editor, block]);
}
