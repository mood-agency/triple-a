import { useEffect } from "react";
import type { BlockNoteEditor, Block } from "@blocknote/core";
import { commandRegistry, getKeyCombo } from "../commands/CommandRegistry";
import type { BlockCommandContext } from "../commands/BlockCommand";

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

      const isInside =
        (anchorNode && node.contains(anchorNode)) ||
        node.contains(e.target as Node) ||
        node.parentElement?.contains(e.target as Node) ||
        e.target === node;

      if (!isInside) return;

      // Stop event propagation for BlockNote compatibility
      e.stopImmediatePropagation();

      // Convert keyboard event to key combination string
      const keyCombo = getKeyCombo(e);

      // Create command context
      const context: BlockCommandContext = {
        editor,
        block,
        node,
        event: e,
      };

      // Execute the command if registered
      const executed = commandRegistry.executeCommand(keyCombo, context);

      // Log for debugging (can be removed in production)
      if (executed) {
        console.log(`✅ Executed command for: ${keyCombo}`);
      }
    };

    // Use capture phase to intercept events before BlockNote's handlers
    document.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [node, editor, block]);
}
