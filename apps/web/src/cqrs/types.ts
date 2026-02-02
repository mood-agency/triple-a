// Command interface
export interface Command<TPayload = unknown, _TResult = void> {
  readonly type: string;
  readonly payload: TPayload;
}

// Query interface
export interface Query<TPayload = unknown, _TResult = unknown> {
  readonly type: string;
  readonly payload: TPayload;
}

// Command handler type
export type CommandHandler<C extends Command<unknown, unknown>> = (
  command: C
) => Promise<C extends Command<unknown, infer R> ? R : void>;

// Query handler type
export type QueryHandler<Q extends Query<unknown, unknown>> = (
  query: Q
) => Promise<Q extends Query<unknown, infer R> ? R : unknown>;

// Command metadata (for logging/auditing)
export interface CommandMetadata {
  timestamp: number;
  userId?: string;
  correlationId: string;
}

// Command with metadata wrapper
export interface CommandEnvelope<C extends Command> {
  command: C;
  metadata: CommandMetadata;
}

// Query metadata
export interface QueryMetadata {
  timestamp: number;
  correlationId: string;
}

// Query with metadata wrapper
export interface QueryEnvelope<Q extends Query> {
  query: Q;
  metadata: QueryMetadata;
}

// Middleware type for commands
export type CommandMiddleware = <C extends Command>(
  command: C,
  metadata: CommandMetadata,
  next: () => Promise<unknown>
) => Promise<unknown>;

// Middleware type for queries
export type QueryMiddleware = <Q extends Query>(
  query: Q,
  metadata: QueryMetadata,
  next: () => Promise<unknown>
) => Promise<unknown>;
