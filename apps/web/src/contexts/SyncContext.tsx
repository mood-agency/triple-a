import { createContext, useContext, useEffect, useState, useRef, type ReactNode } from 'react';
import { toast } from 'sonner';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { supabase } from '@/lib/supabase';
import i18n from '@/i18n';

export type SyncConnectionStatus = 'online' | 'offline' | 'connecting';

interface SyncContextType {
  connectionStatus: SyncConnectionStatus;
  isOnline: boolean;
}

const SyncContext = createContext<SyncContextType | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const isOnline = useOnlineStatus();
  const [connectionStatus, setConnectionStatus] = useState<SyncConnectionStatus>('offline');
  // Use ref to track previous online state without causing re-renders
  const prevOnlineRef = useRef<boolean | null>(null);

  // Update connection status
  useEffect(() => {
    if (!supabase) {
      setConnectionStatus('offline');
    } else if (isOnline) {
      setConnectionStatus('online');
    } else {
      setConnectionStatus('offline');
    }
  }, [isOnline]);

  // Show toast notifications for online/offline transitions
  useEffect(() => {
    // Skip notification on initial mount - just record the initial state
    if (prevOnlineRef.current === null) {
      prevOnlineRef.current = isOnline;
      return;
    }

    // Only show toast when status actually changes
    if (prevOnlineRef.current !== isOnline) {
      if (isOnline) {
        toast.success(i18n.t('sync.backOnline'));
      } else {
        toast.warning(i18n.t('sync.nowOffline'));
      }
      prevOnlineRef.current = isOnline;
    }
  }, [isOnline]);

  return (
    <SyncContext.Provider
      value={{
        connectionStatus,
        isOnline,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within SyncProvider');
  }
  return context;
}
