import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { NavigationMediator, RegionHandler } from './types';

const NavigationMediatorContext = createContext<NavigationMediator | null>(null);

interface NavigationMediatorProviderProps {
  children: ReactNode;
  mediator: NavigationMediator;
}

/**
 * Provider component for the Navigation Mediator
 */
export function NavigationMediatorProvider({
  children,
  mediator,
}: NavigationMediatorProviderProps) {
  return (
    <NavigationMediatorContext.Provider value={mediator}>
      {children}
    </NavigationMediatorContext.Provider>
  );
}

/**
 * Hook to access the Navigation Mediator
 */
export function useNavigationMediatorContext(): NavigationMediator | null {
  return useContext(NavigationMediatorContext);
}

/**
 * Hook to register a region with the mediator
 * Automatically unregisters on unmount
 */
export function useRegisterNavigationRegion(handler: RegionHandler | null) {
  const mediator = useNavigationMediatorContext();

  useEffect(() => {
    if (!mediator || !handler) return;

    mediator.registerRegion(handler);

    return () => {
      mediator.unregisterRegion(handler.region);
    };
  }, [mediator, handler]);
}
