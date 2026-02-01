import type { BlockCommand, BlockCommandContext } from "./BlockCommand";

/**
 * InsertBlockCommand - Handles Enter key to insert a new notepad block
 *
 * Creates a new notepad block immediately after the current block
 * and moves the cursor to the start of the new block.
 *
 * Implementation extracted from NotepadBlock.tsx lines 93-104
 */
export class InsertBlockCommand implements BlockCommand {
  execute(context: BlockCommandContext): boolean {
    const { editor, block, event } = context;

    event.preventDefault();
    event.stopPropagation();

    // Insert a new notepad block after the current block (optimistic update)
    const insertedBlocks = editor.insertBlocks(
      [
        {
          type: "notepad",
          props: {
            date: new Date().toLocaleDateString(),
            category: (block.props as any).category || 'todo'
          },
        },
      ],
      block,
      "after"
    );

    // Move cursor to the start of the newly created block
    if (insertedBlocks.length > 0) {
      editor.setTextCursorPosition(insertedBlocks[0], "start");

      // Dispatch event with the new block's ID so the database can use it
      window.dispatchEvent(new CustomEvent('notepad:createNoteAfter', {
        detail: {
          afterNoteId: block.id,
          newNoteId: insertedBlocks[0].id,  // Pass the new block's ID
          category: (block.props as any).category || 'todo'
        }
      }));
    }

    return true;
  }

  canExecute(context: BlockCommandContext): boolean {
    // Command can always execute if we have a valid editor and block
    return !!context.editor && !!context.block;
  }
}
