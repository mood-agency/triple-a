import { useMemo, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveProject } from '@/contexts/ProjectContext';
import { DataProvider } from './DataProvider';
import { createSupabaseRepositories } from './createRepositories';
import { formatLocalDate } from '@/utils/dateUtils';

interface RepositoryProviderProps {
  children: ReactNode;
  date?: string;
}

/**
 * Provider that creates and provides Supabase repositories based on auth context.
 * Should be used within AuthenticatedProviders after AuthContext and ProjectContext.
 */
export function RepositoryProvider({ children, date }: RepositoryProviderProps) {
  const { user } = useAuth();
  const { activeProjectId } = useActiveProject();

  const repositories = useMemo(() => {
    if (!user) return null;

    return createSupabaseRepositories({
      userId: user.id,
      projectId: activeProjectId,
      date: date ?? formatLocalDate(new Date()),
    });
  }, [user, activeProjectId, date]);

  // Don't render children if no user (shouldn't happen in authenticated routes)
  if (!repositories) {
    return null;
  }

  return <DataProvider repositories={repositories}>{children}</DataProvider>;
}
