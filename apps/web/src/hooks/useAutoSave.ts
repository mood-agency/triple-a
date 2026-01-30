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
      return;
    }

    if (value !== originalValue) {
      pendingSaveRef.current = value;

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        if (pendingSaveRef.current !== null) {
          onSaveRef.current(pendingSaveRef.current);
          pendingSaveRef.current = null;
        }
      }, debounceMs);
    } else {
      // Value returned to original, cancel pending save
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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingSaveRef.current !== null) {
      onSaveRef.current(pendingSaveRef.current);
      pendingSaveRef.current = null;
    }
  }, []);

  return {
    handleBlur,
    isPending: pendingSaveRef.current !== null,
  };
}
