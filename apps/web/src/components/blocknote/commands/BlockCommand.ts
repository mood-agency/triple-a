import type { BlockNoteEditor, Block } from "@blocknote/core";

/**
 * Context object passed to block commands containing all necessary state
 */
export interface BlockCommandContext {
  /** The BlockNote editor instance */
  editor: BlockNoteEditor<any>;
  /** The current block being operated on */
  block: Block;
  /** The DOM node containing the editable content */
  node: HTMLElement;
  /** The original keyboard event */
  event: KeyboardEvent;
}

/**
 * Base interface for all block commands following the Command Pattern.
 *
 * Benefits:
 * - Testability: Commands can be unit tested in isolation
 * - Extensibility: New commands can be added without modifying existing code
 * - Undo/Redo: Interface supports future undo/redo implementation
 * - Reusability: Commands can be reused across different block types
 */
export interface BlockCommand {
  /**
   * Execute the command with the given context
   * @returns true if command was executed, false otherwise
   */
  execute(context: BlockCommandContext): boolean;

  /**
   * Check if the command can execute given the current context
   * Optional - defaults to true if not implemented
   */
  canExecute?(context: BlockCommandContext): boolean;

  /**
   * Undo the command (interface only - implementation deferred)
   * Will be used for future undo/redo support
   */
  undo?(): void;
}
