import { useRef, useEffect, useCallback } from 'react';

interface UseAutoSaveOptions<T> {
  value: T;
  originalValue: T;
  onSave: (value: T) => void;
  debounceMs?: number;
  enabled?: boolean;
}

export function useAutoSave<T>({
  value,
  originalValue,
  onSave,
  debounceMs = 3000,
  enabled = true,
}: UseAutoSaveOptions<T>) {
  const timeoutRef = useRef<number | null>(null);
  const pendingSaveRef = useRef<T | null>(null);
  const onSaveRef = useRef(onSave);

  // Keep onSave reference updated
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Debounced save
  useEffect(() => {
    if (!enabled) {
      console.log('[AutoSave] Disabled - skipping');
      return;
    }

    if (value !== originalValue) {
      pendingSaveRef.current = value;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        console.log('[AutoSave] Clearing previous timeout');
      }

      console.log(`[AutoSave] Scheduling save in ${debounceMs}ms`);
      timeoutRef.current = window.setTimeout(() => {
        if (pendingSaveRef.current !== null) {
          console.log('[AutoSave] Executing scheduled save');
          onSaveRef.current(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }
      }, debounceMs);
    } else {
      // Value returned to original, cancel pending save
      console.log('[AutoSave] Value returned to original - canceling');
      pendingSaveRef.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [value, originalValue, debounceMs, enabled]);

  // beforeunload handler
  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = () => {
      if (pendingSaveRef.current !== null) {
        onSaveRef.current(pendingSaveRef.current);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Save on unmount
      if (pendingSaveRef.current !== null) {
        onSaveRef.current(pendingSaveRef.current);
      }
    };
  }, [enabled]);

  // Flush on blur - clears timeout and saves immediately if pending
  const handleBlur = useCallback(() => {
    console.log('[AutoSave] handleBlur called');
    if (timeoutRef.current) {
      console.log('[AutoSave] Clearing timeout on blur');
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingSaveRef.current !== null) {
      console.log('[AutoSave] Flushing pending save on blur');
      onSaveRef.current(pendingSaveRef.current);
      pendingSaveRef.current = null;
    } else {
      console.log('[AutoSave] No pending save on blur');
    }
  }, []);

  return {
    handleBlur,
    isPending: pendingSaveRef.current !== null,
  };
}
