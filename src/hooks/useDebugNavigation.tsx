import { useSearchParams } from 'react-router-dom';

/**
 * Hook to enable debug mode for keyboard navigation.
 * Add ?debug=nav to the URL to enable debug highlighting.
 *
 * When enabled, it adds visual indicators to show:
 * - Which element is currently selected/focused
 * - Focus targets (title, description)
 * - Navigation state
 */
export function useDebugNavigation() {
  const [searchParams] = useSearchParams();
  const debugMode = searchParams.get('debug') === 'nav';

  return {
    debugMode,
    // CSS classes for debug highlighting
    debugSelectedClass: debugMode ? 'ring-2 ring-red-500 ring-offset-1' : '',
    debugFocusedClass: debugMode ? 'ring-2 ring-blue-500 ring-offset-1' : '',
    debugTitleFocusClass: debugMode ? 'ring-2 ring-green-500' : '',
    debugDescriptionFocusClass: debugMode ? 'ring-2 ring-purple-500' : '',
  };
}

/**
 * Debug overlay component props
 */
export interface DebugNavigationOverlayProps {
  selectedNoteId: string | null;
  focusTarget: 'title' | 'description-start' | 'description-end' | null;
  desiredColumn: number;
  isDescriptionFocused: boolean;
  showDescriptionPanel: boolean;
}

/**
 * Debug overlay component to show current navigation state
 */
export function DebugNavigationOverlay({
  selectedNoteId,
  focusTarget,
  desiredColumn,
  isDescriptionFocused,
  showDescriptionPanel,
}: DebugNavigationOverlayProps) {
  const { debugMode } = useDebugNavigation();

  if (!debugMode) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-3 rounded-lg text-xs font-mono z-50 max-w-xs shadow-lg border border-white/20">
      <div className="font-bold text-yellow-400 mb-2">🐛 Navigation Debug</div>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Selected:</span>
          <span className={selectedNoteId ? 'text-red-400' : 'text-gray-500'}>
            {selectedNoteId ? selectedNoteId.slice(0, 8) + '...' : 'none'}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Focus Target:</span>
          <span className={focusTarget ? 'text-green-400' : 'text-gray-500'}>
            {focusTarget || 'none'}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Desired Col:</span>
          <span className="text-blue-400">{desiredColumn}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Desc Focused:</span>
          <span className={isDescriptionFocused ? 'text-purple-400' : 'text-gray-500'}>
            {isDescriptionFocused ? 'yes' : 'no'}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-400">Desc Panel:</span>
          <span className={showDescriptionPanel ? 'text-purple-400' : 'text-gray-500'}>
            {showDescriptionPanel ? 'open' : 'closed'}
          </span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-white/20 text-[10px] text-gray-500">
        <div className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full" /> Selected row</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full" /> Title focused</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 bg-purple-500 rounded-full" /> Description focused</div>
      </div>
    </div>
  );
}
