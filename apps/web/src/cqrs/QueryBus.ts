import type { Query, QueryHandler, QueryMetadata, QueryMiddleware } from './types';

class QueryBus {
  private handlers: Map<string, QueryHandler<Query>> = new Map();
  private middlewares: QueryMiddleware[] = [];

  /**
   * Register a query handler
   */
  register<Q extends Query>(queryType: string, handler: QueryHandler<Q>): void {
    if (this.handlers.has(queryType)) {
      console.warn(`[QueryBus] Handler for ${queryType} is being overwritten`);
    }
    this.handlers.set(queryType, handler as QueryHandler<Query>);
  }

  /**
   * Add middleware to the query pipeline
   */
  use(middleware: QueryMiddleware): void {
    this.middlewares.push(middleware);
  }

  /**
   * Execute a query through its handler
   */
  async execute<Q extends Query<unknown, R>, R>(query: Q): Promise<R> {
    const handler = this.handlers.get(query.type);
    if (!handler) {
      throw new Error(`[QueryBus] No handler registered for query: ${query.type}`);
    }

    const metadata: QueryMetadata = {
      timestamp: Date.now(),
      correlationId: crypto.randomUUID(),
    };

    // Log in development
    if (import.meta.env.DEV) {
      console.debug(`[QueryBus] Executing ${query.type}`, query.payload);
    }

    // Execute with middleware pipeline
    const executeHandler = () => handler(query);

    if (this.middlewares.length === 0) {
      return executeHandler() as Promise<R>;
    }

    // Build middleware chain
    let index = -1;
    const executeNext = (): Promise<unknown> => {
      index++;
      if (index < this.middlewares.length) {
        return this.middlewares[index](query, metadata, executeNext);
      }
      return executeHandler();
    };

    return executeNext() as Promise<R>;
  }

  /**
   * Check if a handler is registered for a query type
   */
  hasHandler(queryType: string): boolean {
    return this.handlers.has(queryType);
  }

  /**
   * Get all registered query types
   */
  getRegisteredQueries(): string[] {
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
export const queryBus = new QueryBus();

// Export class for testing
export { QueryBus };
