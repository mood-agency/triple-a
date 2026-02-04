import type { ReactNode } from 'react';
import { SyncProvider } from '@/contexts/SyncContext';
import { ContactsProvider } from '@/contexts/ContactsContext';
import { LabelsProvider } from '@/contexts/LabelsContext';
import { AssigneesProvider } from '@/contexts/AssigneesContext';
import { ProjectProvider } from '@/contexts/ProjectContext';
import { GoogleCalendarProvider } from '@/contexts/GoogleCalendarContext';
import { RepositoryProvider } from '@/data';
import { useNoteSideEffects } from '@/hooks/useNoteSideEffects';

interface AuthenticatedProvidersProps {
  children: ReactNode;
}

/**
 * Mounts event-driven side-effect listeners (label/assignee persistence).
 */
function SideEffectListeners({ children }: { children: ReactNode }) {
  useNoteSideEffects();
  return <>{children}</>;
}

/**
 * Providers that should only wrap authenticated routes.
 * These providers fetch user-specific data and should NOT be active on public pages.
 */
export function AuthenticatedProviders({ children }: AuthenticatedProvidersProps) {
  return (
    <SyncProvider>
      <ContactsProvider>
        <LabelsProvider>
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
        </LabelsProvider>
      </ContactsProvider>
    </SyncProvider>
  );
}
