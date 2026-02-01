/**
 * Navigation Mediator Types
 *
 * The Mediator Pattern centralizes navigation logic between UI regions,
 * allowing components to communicate through a central coordinator
 * rather than directly with each other.
 */

/**
 * Navigation regions in the notes interface
 */
export type NavigationRegion = 'search' | 'taskList' | 'editor' | 'toolbar';

/**
 * Focus target within a region
 */
export type FocusTarget = 'title' | 'description-start' | 'description-end' | null;

/**
 * Navigation direction
 */
export type NavigationDirection = 'up' | 'down' | 'left' | 'right' | 'next' | 'previous';

/**
 * Navigation request from a component to the mediator
 */
export interface NavigationRequest {
  /** The region making the request */
  fromRegion: NavigationRegion;
  /** Direction of navigation */
  direction: NavigationDirection;
  /** Current cursor column (for maintaining position across navigation) */
  column?: number;
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Result of a navigation request
 */
export interface NavigationResult {
  /** Whether navigation was handled */
  handled: boolean;
  /** The region that received focus */
  targetRegion?: NavigationRegion;
  /** Focus target within the region */
  focusTarget?: FocusTarget;
}

/**
 * Region handler that the mediator can call
 */
export interface RegionHandler {
  /** Unique identifier for the region */
  region: NavigationRegion;
  /** Focus the first element in this region */
  focusFirst: (column?: number) => boolean;
  /** Focus the last element in this region */
  focusLast: (column?: number) => boolean;
  /** Check if the region can receive focus */
  canReceiveFocus: () => boolean;
  /** Optional: Handle escape key */
  onEscape?: () => void;
  /** Optional: Get current focus info */
  getCurrentFocusInfo?: () => { column: number; position: 'start' | 'end' | 'middle' };
}

/**
 * Navigation Mediator interface
 */
export interface NavigationMediator {
  /** Register a region handler */
  registerRegion: (handler: RegionHandler) => void;
  /** Unregister a region handler */
  unregisterRegion: (region: NavigationRegion) => void;
  /** Request navigation from current region */
  navigate: (request: NavigationRequest) => NavigationResult;
  /** Directly focus a specific region */
  focusRegion: (region: NavigationRegion, target?: FocusTarget, column?: number) => boolean;
  /** Get the currently focused region */
  getCurrentRegion: () => NavigationRegion | null;
  /** Set the currently focused region */
  setCurrentRegion: (region: NavigationRegion | null) => void;
}

/**
 * Navigation rules defining how regions connect
 */
export interface NavigationRule {
  from: NavigationRegion;
  direction: NavigationDirection;
  to: NavigationRegion;
  /** Optional condition for the rule to apply */
  condition?: () => boolean;
}

/**
 * Default navigation rules for the notes interface
 */
export const DEFAULT_NAVIGATION_RULES: NavigationRule[] = [
  // Search -> Task List
  { from: 'search', direction: 'down', to: 'taskList' },

  // Task List navigation
  { from: 'taskList', direction: 'right', to: 'editor' },
  { from: 'taskList', direction: 'next', to: 'editor' },

  // Editor -> Task List
  { from: 'editor', direction: 'left', to: 'taskList' },
  { from: 'editor', direction: 'previous', to: 'taskList' },

  // Toolbar -> Task List
  { from: 'toolbar', direction: 'down', to: 'taskList' },
];
