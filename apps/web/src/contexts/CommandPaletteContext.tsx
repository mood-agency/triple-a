import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

export type PaletteMode = 'commands' | 'projects' | 'labels' | 'assignees';

interface FocusState {
  element: HTMLElement;
  selectionStart: number | null;
  selectionEnd: number | null;
}

interface CommandPaletteContextValue {
  /** Whether the command palette is open */
  isOpen: boolean;
  /** Current mode of the command palette */
  mode: PaletteMode;
  /** Open the command palette with a specific mode */
  open: (mode?: PaletteMode) => void;
  /** Close the command palette */
  close: () => void;
  /** Close the command palette without restoring focus (use when applying filters) */
  closeWithoutFocusRestore: () => void;
  /** Toggle the command palette */
  toggle: (mode?: PaletteMode) => void;
  /** Set the mode without changing open state */
  setMode: (mode: PaletteMode) => void;
  /** Handle open state change (for dialog) */
  handleOpenChange: (open: boolean) => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

interface CommandPaletteProviderProps {
  children: ReactNode;
}

export function CommandPaletteProvider({ children }: CommandPaletteProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setModeState] = useState<PaletteMode>('commands');
  const savedFocusRef = useRef<FocusState | null>(null);

  const saveFocusState = useCallback(() => {
    const activeElement = document.activeElement as HTMLElement;
    if (activeElement && activeElement !== document.body) {
      const focusState: FocusState = {
        element: activeElement,
        selectionStart: null,
        selectionEnd: null,
      };

      // Save cursor position for input elements
      if (activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement) {
        focusState.selectionStart = activeElement.selectionStart;
        focusState.selectionEnd = activeElement.selectionEnd;
      }

      savedFocusRef.current = focusState;
    }
  }, []);

  const restoreFocusState = useCallback(() => {
    const savedFocus = savedFocusRef.current;
    if (savedFocus && savedFocus.element) {
      // Use setTimeout to ensure the dialog has fully closed
      setTimeout(() => {
        savedFocus.element.focus();

        // Restore cursor position for input elements
        if (
          (savedFocus.element instanceof HTMLInputElement || savedFocus.element instanceof HTMLTextAreaElement) &&
          savedFocus.selectionStart !== null &&
          savedFocus.selectionEnd !== null
        ) {
          savedFocus.element.setSelectionRange(savedFocus.selectionStart, savedFocus.selectionEnd);
        }

        savedFocusRef.current = null;
      }, 0);
    }
  }, []);

  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (newOpen) {
      saveFocusState();
    } else {
      restoreFocusState();
      // Reset mode to commands when closing, but with a slight delay to avoid UI flicker
      setTimeout(() => setModeState('commands'), 300);
    }
    setIsOpen(newOpen);
  }, [saveFocusState, restoreFocusState]);

  const open = useCallback((newMode: PaletteMode = 'commands') => {
    setModeState(newMode);
    if (!isOpen) {
      saveFocusState();
      setIsOpen(true);
    }
  }, [isOpen, saveFocusState]);

  const close = useCallback(() => {
    handleOpenChange(false);
  }, [handleOpenChange]);

  const closeWithoutFocusRestore = useCallback(() => {
    // Clear saved focus state so restoreFocusState becomes a no-op
    savedFocusRef.current = null;
    setIsOpen(false);
    // Reset mode to commands when closing, but with a slight delay to avoid UI flicker
    setTimeout(() => setModeState('commands'), 300);
  }, []);

  const toggle = useCallback((targetMode: PaletteMode = 'commands') => {
    if (isOpen && mode === targetMode) {
      handleOpenChange(false);
    } else {
      setModeState(targetMode);
      if (!isOpen) {
        saveFocusState();
        setIsOpen(true);
      }
    }
  }, [isOpen, mode, handleOpenChange, saveFocusState]);

  const setMode = useCallback((newMode: PaletteMode) => {
    setModeState(newMode);
  }, []);

  // Global hotkeys - these work from anywhere in the app
  // Ctrl+K to toggle command palette (commands mode)
  useHotkeys('ctrl+k, meta+k', () => {
    toggle('commands');
  }, { preventDefault: true, enableOnFormTags: true, enableOnContentEditable: true }, [toggle]);

  // Ctrl+P to toggle command palette (projects mode)
  useHotkeys('ctrl+p, meta+p', () => {
    toggle('projects');
  }, { preventDefault: true, enableOnFormTags: true, enableOnContentEditable: true }, [toggle]);

  // Ctrl+R to toggle command palette (assignees mode)
  useHotkeys('ctrl+r, meta+r', () => {
    toggle('assignees');
  }, { preventDefault: true, enableOnFormTags: true, enableOnContentEditable: true }, [toggle]);

  // Ctrl+L to toggle command palette (labels mode)
  useHotkeys('ctrl+l, meta+l', () => {
    toggle('labels');
  }, { preventDefault: true, enableOnFormTags: true, enableOnContentEditable: true }, [toggle]);

  const value = useMemo(() => ({
    isOpen,
    mode,
    open,
    close,
    closeWithoutFocusRestore,
    toggle,
    setMode,
    handleOpenChange,
  }), [isOpen, mode, open, close, closeWithoutFocusRestore, toggle, setMode, handleOpenChange]);

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return context;
}
