import { useEffect } from "react";
import type { BlockNoteEditor, Block } from "@blocknote/core";
import { commandRegistry, getKeyCombo } from "../commands/CommandRegistry";
import type { BlockCommandContext } from "../commands/BlockCommand";

const DEBUG_BLOCKNOTE = true;

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

      // Check if the event originated from inside this block
      const selection = window.getSelection();
      const anchorNode = selection?.anchorNode;

      // Check if the event originated from inside THIS specific block
      // Note: We removed `node.parentElement?.contains(e.target)` as it was too broad
      // and could match multiple blocks at once (the parent contains all blocks)
      const isInside =
        (anchorNode && node.contains(anchorNode)) ||
        node.contains(e.target as Node) ||
        e.target === node;

      if (!isInside) return;

      // Convert keyboard event to key combination string
      const keyCombo = getKeyCombo(e);

      if (DEBUG_BLOCKNOTE) {
        console.log(`[useBlockCommands] ⌨️ Key pressed in block ${block.id}: "${e.key}", combo: "${keyCombo}"`);
      }

      // Execute the command if registered
      if (commandRegistry.hasCommand(keyCombo)) {
        console.log(`[useBlockCommands] Command found for "${keyCombo}", executing...`);
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
        console.log(`[useBlockCommands] Command executed: ${executed}`);
      } else {
        console.log(`[useBlockCommands] No command registered for "${keyCombo}"`);
      }
    };

    // Use capture phase to intercept events before BlockNote's handlers
    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [node, editor, block]);
}
