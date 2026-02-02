import { useCallback, useState } from 'react';
import { commandBus } from '../CommandBus';
import type { Command } from '../types';

interface UseCommandResult<C extends Command<unknown, R>, R> {
  dispatch: (command: C) => Promise<R>;
  isLoading: boolean;
  error: Error | null;
  reset: () => void;
}

/**
 * Hook to dispatch commands with loading and error state
 */
export function useCommand<C extends Command<unknown, R>, R>(): UseCommandResult<C, R> {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const dispatch = useCallback(async (command: C): Promise<R> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await commandBus.dispatch<C, R>(command);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setIsLoading(false);
  }, []);

  return { dispatch, isLoading, error, reset };
}

/**
 * Simple hook to dispatch commands without state tracking
 */
export function useCommandDispatch() {
  return useCallback(<C extends Command<unknown, R>, R>(command: C): Promise<R> => {
    return commandBus.dispatch<C, R>(command);
  }, []);
}
