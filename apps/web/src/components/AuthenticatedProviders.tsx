import type { ReactNode } from 'react';
import { SyncProvider } from '@/contexts/SyncContext';
import { AssigneesProvider } from '@/contexts/AssigneesContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { GoogleCalendarProvider } from '@/contexts/GoogleCalendarContext';

interface AuthenticatedProvidersProps {
  children: ReactNode;
}

/**
 * Providers that should only wrap authenticated routes.
 * These providers fetch user-specific data and should NOT be active on public pages.
 */
export function AuthenticatedProviders({ children }: AuthenticatedProvidersProps) {
  return (
    <SyncProvider>
      <AssigneesProvider>
        <ProjectProvider>
          <GoogleCalendarProvider>
            {children}
          </GoogleCalendarProvider>
        </ProjectProvider>
      </AssigneesProvider>
    </SyncProvider>
  );
}
