import { useCallback, useState, useEffect, useRef } from 'react';
import { queryBus } from '../QueryBus';
import type { Query } from '../types';

interface UseQueryOptions {
  enabled?: boolean;
  refetchOnMount?: boolean;
}

interface UseQueryResult<R> {
  data: R | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<R>;
}

/**
 * Hook to execute a query with caching and state management
 */
export function useQuery<Q extends Query<unknown, R>, R>(
  query: Q,
  options: UseQueryOptions = {}
): UseQueryResult<R> {
  const { enabled = true, refetchOnMount = true } = options;

  const [data, setData] = useState<R | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const queryRef = useRef(query);

  // Update query ref when query changes
  queryRef.current = query;

  const execute = useCallback(async (): Promise<R> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await queryBus.execute<Q, R>(queryRef.current);
      if (mountedRef.current) {
        setData(result);
      }
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (mountedRef.current) {
        setError(error);
      }
      throw error;
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  // Execute on mount if enabled
  useEffect(() => {
    mountedRef.current = true;

    if (enabled && refetchOnMount) {
      execute().catch(() => {
        // Error already handled in execute
      });
    }

    return () => {
      mountedRef.current = false;
    };
  }, [enabled, refetchOnMount, execute]);

  // Re-execute when query payload changes
  useEffect(() => {
    if (enabled) {
      execute().catch(() => {
        // Error already handled in execute
      });
    }
  }, [JSON.stringify(query.payload), enabled, execute]);

  return { data, isLoading, error, refetch: execute };
}

/**
 * Simple hook to execute queries without state tracking
 */
export function useQueryExecute() {
  return useCallback(<Q extends Query<unknown, R>, R>(query: Q): Promise<R> => {
    return queryBus.execute<Q, R>(query);
  }, []);
}

/**
 * Hook for lazy query execution (manual trigger)
 */
export function useLazyQuery<Q extends Query<unknown, R>, R>(): [
  (query: Q) => Promise<R>,
  { data: R | null; isLoading: boolean; error: Error | null }
] {
  const [data, setData] = useState<R | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async (query: Q): Promise<R> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await queryBus.execute<Q, R>(query);
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return [execute, { data, isLoading, error }];
}
