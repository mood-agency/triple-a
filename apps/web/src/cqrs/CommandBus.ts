import type { Command, CommandHandler, CommandMetadata, CommandMiddleware } from './types';

class CommandBus {
  private handlers: Map<string, CommandHandler<Command>> = new Map();
  private middlewares: CommandMiddleware[] = [];

  /**
   * Register a command handler
   */
  register<C extends Command>(
    commandType: string,
    handler: CommandHandler<C>
  ): void {
    if (this.handlers.has(commandType)) {
      console.warn(`[CommandBus] Handler for ${commandType} is being overwritten`);
    }
    this.handlers.set(commandType, handler as CommandHandler<Command>);
  }

  /**
   * Add middleware to the command pipeline
   */
  use(middleware: CommandMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Dispatch a command to its handler
   */
  async dispatch<C extends Command<unknown, R>, R>(command: C): Promise<R> {
    const handler = this.handlers.get(command.type);
    if (!handler) {
      throw new Error(`[CommandBus] No handler registered for command: ${command.type}`);
    }

    const metadata: CommandMetadata = {
      timestamp: Date.now(),
      correlationId: crypto.randomUUID(),
    };

    // Log in development
    if (import.meta.env.DEV) {
      console.debug(`[CommandBus] Dispatching ${command.type}`, command.payload);
    }

    // Execute with middleware pipeline
    const executeHandler = () => handler(command);

    if (this.middlewares.length === 0) {
      return executeHandler() as Promise<R>;
    }

    // Build middleware chain
    let index = -1;
    const executeNext = (): Promise<unknown> => {
      index++;
      if (index < this.middlewares.length) {
        return this.middlewares[index](command, metadata, executeNext);
      }
      return executeHandler();
    };

    return executeNext() as Promise<R>;
  }

  /**
   * Check if a handler is registered for a command type
   */
  hasHandler(commandType: string): boolean {
    return this.handlers.has(commandType);
  }

  /**
   * Get all registered command types
   */
  getRegisteredCommands(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all handlers and middlewares (for testing)
   */
  clear(): void {
    this.handlers.clear();
    this.middlewares = [];
  }
}

// Singleton instance
export const commandBus = new CommandBus();

// Export class for testing
export { CommandBus };
