// Core
export { commandBus, CommandBus } from './CommandBus';
export { queryBus, QueryBus } from './QueryBus';

// Types
export type {
  Command,
  Query,
  CommandHandler,
  QueryHandler,
  CommandMetadata,
  QueryMetadata,
  CommandEnvelope,
  QueryEnvelope,
  CommandMiddleware,
  QueryMiddleware,
} from './types';

// Hooks
export { useCommand, useCommandDispatch } from './hooks/useCommand';
export { useQuery, useQueryExecute, useLazyQuery } from './hooks/useQuery';

// Commands
export * from './commands';

// Queries
export * from './queries';

// Handlers
export * from './handlers';

// Registration
export { registerHandlers, clearHandlers } from './registerHandlers';
