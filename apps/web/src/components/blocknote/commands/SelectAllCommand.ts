import { TextSelection } from "@tiptap/pm/state";
import type { BlockCommand, BlockCommandContext } from "./BlockCommand";

/**
 * SelectAllCommand - Handles Ctrl+A / Cmd+A to select only the current block's text
 *
 * Uses ProseMirror's TextSelection to scope the selection to the current block,
 * preventing the default browser behavior of selecting all content in the editor.
 *
 * Implementation extracted from NotepadBlock.tsx lines 59-90
 */
export class SelectAllCommand implements BlockCommand {
  execute(context: BlockCommandContext): boolean {
    const { editor, block, event } = context;

    console.log("🔹 Ctrl+A pressed - scoping selection (PM)");
    event.preventDefault();
    event.stopImmediatePropagation();

    // Access TipTap editor (BlockNote wraps TipTap internally)
    // Using 'as any' because _tiptapEditor is a private API
    const tiptapEditor = (editor as any)._tiptapEditor;
    if (!tiptapEditor) {
      console.warn("TipTap editor not found");
      return false;
    }

    const { state, view } = tiptapEditor;
    let foundPos = -1;
    let foundNodeSize = -1;

    // Traverse ProseMirror document to find the current block's position
    state.doc.descendants((pmNode: any, pos: number) => {
      if (pmNode.attrs?.id === block.id) {
        foundPos = pos;
        foundNodeSize = pmNode.nodeSize;
        return false; // Stop traversal
      }
      return true; // Continue traversal
    });

    if (foundPos === -1) {
      console.warn("Block not found in ProseMirror document");
      return false;
    }

    // Calculate selection range for the block's content
    // +1 to skip the opening tag, -1 to skip the closing tag
    const start = foundPos + 1;
    const end = foundPos + foundNodeSize - 1;

    // Create and dispatch the text selection
    const tr = state.tr.setSelection(TextSelection.create(state.doc, start, end));
    view.dispatch(tr);
    view.focus();

    return true;
  }

  canExecute(context: BlockCommandContext): boolean {
    // Command can execute if we have a valid editor and block
    return !!context.editor && !!context.block;
  }
}
