import { useCallback, useRef, useState } from 'react';
import {
  DEFAULT_NAVIGATION_RULES,
  type NavigationMediator,
  type NavigationRegion,
  type NavigationRequest,
  type NavigationResult,
  type NavigationRule,
  type RegionHandler,
  type FocusTarget,
} from './types';

interface UseNavigationMediatorOptions {
  /** Custom navigation rules (merged with defaults) */
  rules?: NavigationRule[];
  /** Callback when navigation occurs */
  onNavigate?: (request: NavigationRequest, result: NavigationResult) => void;
}

/**
 * Hook that creates a Navigation Mediator instance.
 *
 * The Mediator Pattern benefits:
 * - Decouples navigation logic from individual components
 * - Centralizes keyboard navigation rules
 * - Makes navigation flow explicit and configurable
 * - Easier to test and debug navigation behavior
 */
export function useNavigationMediator(
  options: UseNavigationMediatorOptions = {}
): NavigationMediator {
  const { rules = [], onNavigate } = options;

  // Merge custom rules with defaults (custom rules take precedence)
  const navigationRules = useRef<NavigationRule[]>([...DEFAULT_NAVIGATION_RULES, ...rules]);

  // Registry of region handlers
  const regionHandlers = useRef<Map<NavigationRegion, RegionHandler>>(new Map());

  // Track current focused region (state triggers re-renders, ref for sync access)
  const [_currentRegion, setCurrentRegion] = useState<NavigationRegion | null>(null);
  const currentRegionRef = useRef<NavigationRegion | null>(null);

  // Keep ref in sync with state
  const updateCurrentRegion = useCallback((region: NavigationRegion | null) => {
    currentRegionRef.current = region;
    setCurrentRegion(region);
  }, []);

  /**
   * Register a region handler
   */
  const registerRegion = useCallback((handler: RegionHandler) => {
    regionHandlers.current.set(handler.region, handler);
  }, []);

  /**
   * Unregister a region handler
   */
  const unregisterRegion = useCallback((region: NavigationRegion) => {
    regionHandlers.current.delete(region);
  }, []);

  /**
   * Find the target region based on navigation rules
   */
  const findTargetRegion = useCallback(
    (request: NavigationRequest): NavigationRegion | null => {
      const applicableRules = navigationRules.current.filter(
        (rule) =>
          rule.from === request.fromRegion &&
          rule.direction === request.direction &&
          (!rule.condition || rule.condition())
      );

      if (applicableRules.length === 0) return null;

      // Return the first matching rule's target
      return applicableRules[0].to;
    },
    []
  );

  /**
   * Focus a specific region
   */
  const focusRegion = useCallback(
    (region: NavigationRegion, target?: FocusTarget, column?: number): boolean => {
      const handler = regionHandlers.current.get(region);

      if (!handler || !handler.canReceiveFocus()) {
        return false;
      }

      // Determine which focus method to use based on target
      let success = false;
      if (target === 'description-end') {
        success = handler.focusLast(column);
      } else {
        success = handler.focusFirst(column);
      }

      if (success) {
        updateCurrentRegion(region);
      }

      return success;
    },
    [updateCurrentRegion]
  );

  /**
   * Navigate from one region to another
   */
  const navigate = useCallback(
    (request: NavigationRequest): NavigationResult => {
      const targetRegion = findTargetRegion(request);

      if (!targetRegion) {
        return { handled: false };
      }

      const handler = regionHandlers.current.get(targetRegion);

      if (!handler || !handler.canReceiveFocus()) {
        return { handled: false };
      }

      // Determine focus method based on direction
      let success = false;
      let focusTarget: FocusTarget = 'title';

      if (request.direction === 'up' || request.direction === 'previous') {
        success = handler.focusLast(request.column);
        focusTarget = 'description-end';
      } else {
        success = handler.focusFirst(request.column);
        focusTarget = 'title';
      }

      const result: NavigationResult = {
        handled: success,
        targetRegion: success ? targetRegion : undefined,
        focusTarget: success ? focusTarget : undefined,
      };

      if (success) {
        updateCurrentRegion(targetRegion);
      }

      // Notify callback
      onNavigate?.(request, result);

      return result;
    },
    [findTargetRegion, updateCurrentRegion, onNavigate]
  );

  /**
   * Get the currently focused region
   */
  const getCurrentRegion = useCallback(() => currentRegionRef.current, []);

  return {
    registerRegion,
    unregisterRegion,
    navigate,
    focusRegion,
    getCurrentRegion,
    setCurrentRegion: updateCurrentRegion,
  };
}
