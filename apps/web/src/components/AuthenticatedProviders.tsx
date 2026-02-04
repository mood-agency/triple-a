import type { ReactNode } from 'react';
import { SyncProvider } from '@/contexts/SyncContext';
import { AssigneesProvider } from '@/contexts/AssigneesContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { GoogleCalendarProvider } from '@/contexts/GoogleCalendarContext';
import { RepositoryProvider } from '@/data';
import { useNoteSideEffects } from '@/hooks/useNoteSideEffects';
import { useCalendarSyncListener } from '@/hooks/useCalendarSyncListener';

interface AuthenticatedProvidersProps {
  children: ReactNode;
}

/**
 * Mounts event-driven side-effect listeners (label/assignee persistence, calendar sync).
 */
function SideEffectListeners({ children }: { children: ReactNode }) {
  useNoteSideEffects();
  useCalendarSyncListener();
  return <>{children}</>;
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
            <RepositoryProvider>
              <SideEffectListeners>
                {children}
              </SideEffectListeners>
            </RepositoryProvider>
          </GoogleCalendarProvider>
        </ProjectProvider>
      </AssigneesProvider>
    </SyncProvider>
  );
}
