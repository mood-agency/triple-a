import type { BlockCommand, BlockCommandContext } from "./BlockCommand";
import { SelectAllCommand } from "./SelectAllCommand";
import { InsertBlockCommand } from "./InsertBlockCommand";
import { DeleteBlockCommand } from "./DeleteBlockCommand";
import { NavigateToDescriptionCommand } from "./NavigateToDescriptionCommand";

/**
 * Maps keyboard events to command instances
 */
class CommandRegistry {
  private commands: Map<string, BlockCommand> = new Map();

  constructor() {
    // Register default commands
    this.register("Ctrl+A", new SelectAllCommand());
    this.register("Cmd+A", new SelectAllCommand());
    this.register("Enter", new InsertBlockCommand());
    this.register("Backspace", new DeleteBlockCommand());
    this.register("Tab", new NavigateToDescriptionCommand());
  }

  /**
   * Register a command for a specific key combination
   */
  register(keyCombo: string, command: BlockCommand): void {
    this.commands.set(keyCombo, command);
  }

  /**
   * Execute the command mapped to the key combination
   * @returns true if command was found and executed, false otherwise
   */
  executeCommand(keyCombo: string, context: BlockCommandContext): boolean {
    const command = this.commands.get(keyCombo);
    if (!command) {
      return false;
    }

    // Check if command can execute (if canExecute is implemented)
    if (command.canExecute && !command.canExecute(context)) {
      return false;
    }

    return command.execute(context);
  }

  /**
   * Get the command registered for a key combination
   */
  getCommand(keyCombo: string): BlockCommand | undefined {
    return this.commands.get(keyCombo);
  }

  /**
   * Check if a key combination is registered
   */
  hasCommand(keyCombo: string): boolean {
    return this.commands.has(keyCombo);
  }
}

/**
 * Convert a keyboard event to a key combination string
 * Examples: "Ctrl+A", "Enter", "Backspace", "Cmd+A"
 */
export function getKeyCombo(event: KeyboardEvent): string {
  const parts: string[] = [];

  // Add modifiers
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.metaKey) parts.push("Cmd");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");

  // Add the main key (capitalize first letter for consistency)
  const key = event.key.charAt(0).toUpperCase() + event.key.slice(1);
  parts.push(key);

  return parts.join("+");
}

// Export a singleton instance
export const commandRegistry = new CommandRegistry();
