import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
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
  const [prevOnline, setPrevOnline] = useState<boolean | null>(null);

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
    if (prevOnline === null) {
      setPrevOnline(isOnline);
      return;
    }

    if (prevOnline !== isOnline) {
      if (isOnline) {
        toast.success(i18n.t('sync.backOnline'));
      } else {
        toast.warning(i18n.t('sync.nowOffline'));
      }
      setPrevOnline(isOnline);
    }
  }, [isOnline, prevOnline]);

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
