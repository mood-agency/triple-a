import type { NoteCategory } from '@/types/note';

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
export type NavigationRegion = 'search' | 'taskList' | 'editor' | 'sidebar' | 'toolbar';

/**
 * Data returned by getItemData for saving
 */
export interface ItemSaveData {
  content: string;
  category: NoteCategory;
  description: string | null;
}

/**
 * Entry in the focus history stack for navigation restoration
 */
export interface FocusHistoryEntry {
  /** The region that had focus */
  region: NavigationRegion;
  /** Optional note/block ID to restore focus to */
  noteId?: string;
  /** Cursor column position for maintaining horizontal position */
  column?: number;
  /** Additional context for focus restoration */
  context?: Record<string, unknown>;
}

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
 * Focus restoration context passed to region handlers
 */
export interface FocusRestorationContext {
  /** Column position to restore */
  column?: number;
  /** Specific note/item ID to focus */
  noteId?: string;
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Region handler that the mediator can call
 */
export interface RegionHandler {
  /** Unique identifier for the region */
  region: NavigationRegion;
  /** Focus the first element in this region (or specific element if context.noteId provided) */
  focusFirst: (column?: number, context?: FocusRestorationContext) => boolean;
  /** Focus the last element in this region */
  focusLast: (column?: number) => boolean;
  /** Check if the region can receive focus */
  canReceiveFocus: () => boolean;
  /** Optional: Handle escape key */
  onEscape?: () => void;
  /** Optional: Get current focus info */
  getCurrentFocusInfo?: () => { column: number; position: 'start' | 'end' | 'middle' };
  /**
   * Optional: Get data for an item to be saved.
   * Used by the mediator's onSaveItem callback to get content before dispatching save commands.
   */
  getItemData?: (itemId: string) => ItemSaveData | null;
  /** Optional: Get the ID of the currently focused item within this region */
  getCurrentItemId?: () => string | null;
}

/**
 * Navigation Mediator interface
 *
 * The mediator acts as a central coordinator that:
 * - Manages navigation between regions
 * - Tracks the currently focused item within each region
 * - Coordinates saving when focus changes (calls handler.saveCurrentItem)
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
  /** Push a focus entry to the history stack (for later restoration) */
  pushFocusHistory: (entry: FocusHistoryEntry) => void;
  /** Return to the previous focus location (pop from history stack) */
  returnToPrevious: () => boolean;
  /** Clear the focus history stack */
  clearFocusHistory: () => void;
  /**
   * Notify the mediator that the focused item changed within a region.
   * The mediator will call handler.saveCurrentItem() for the previous item if needed.
   */
  setCurrentItem: (region: NavigationRegion, itemId: string | null) => void;
  /** Get the currently focused item ID for a region */
  getCurrentItem: (region: NavigationRegion) => string | null;
  /**
   * Explicitly save the current item without changing it.
   * Used for action-based saves (toggle complete, pin, window blur, etc.)
   */
  saveCurrentItem: (region: NavigationRegion) => void;
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

  // Sidebar navigation (fixed sidebar panel)
  { from: 'sidebar', direction: 'left', to: 'taskList' },
  { from: 'sidebar', direction: 'previous', to: 'taskList' },

  // Toolbar -> Task List
  { from: 'toolbar', direction: 'down', to: 'taskList' },
];
