import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { AIClassificationService } from '@/services/AIClassificationService';
import type { AIModelStatus, AIModelProgress } from '@/types/ai';

interface AIContextType {
  status: AIModelStatus;
  loadProgress: number;
  progressMessage: string;
  loadModel: () => Promise<void>;
  service: AIClassificationService;
  error: string | null;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

const AIContext = createContext<AIContextType | null>(null);

const AI_ENABLED_KEY = 'ai-classification-enabled';
const AI_AUTO_LOAD_KEY = 'ai-auto-load';

export function AIProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AIModelStatus>('unloaded');
  const [loadProgress, setLoadProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isEnabled, setIsEnabledState] = useState(() => {
    return localStorage.getItem(AI_ENABLED_KEY) === 'true';
  });

  const service = AIClassificationService.getInstance();

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabledState(enabled);
    localStorage.setItem(AI_ENABLED_KEY, enabled ? 'true' : 'false');
  }, []);

  const loadModel = useCallback(async () => {
    if (status === 'ready' || status === 'loading') return;

    setStatus('loading');
    setError(null);
    setLoadProgress(0);
    setProgressMessage('Initializing...');

    service.setProgressCallback((progress: AIModelProgress) => {
      if (progress.status === 'progress' && progress.progress !== undefined) {
        setLoadProgress(Math.round(progress.progress));
        setProgressMessage(`Loading ${progress.file || 'model'}...`);
      } else if (progress.status === 'done') {
        setProgressMessage('Model loaded');
      } else if (progress.status === 'initiate') {
        setProgressMessage(`Downloading ${progress.file || 'model'}...`);
      }
    });

    try {
      await service.initialize();
      setStatus('ready');
      setLoadProgress(100);
      setProgressMessage('Ready');
      // Save auto-load preference when user manually loads
      localStorage.setItem(AI_AUTO_LOAD_KEY, 'true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load AI model');
      setStatus('error');
      setProgressMessage('');
    } finally {
      service.setProgressCallback(null);
    }
  }, [status, service]);

  // Auto-load if preference is set and enabled
  useEffect(() => {
    const autoLoad = localStorage.getItem(AI_AUTO_LOAD_KEY) === 'true';
    if (autoLoad && isEnabled && status === 'unloaded') {
      loadModel();
    }
  }, [isEnabled, status, loadModel]);

  return (
    <AIContext.Provider
      value={{
        status,
        loadProgress,
        progressMessage,
        loadModel,
        service,
        error,
        isEnabled,
        setEnabled,
      }}
    >
      {children}
    </AIContext.Provider>
  );
}

export function useAI() {
  const context = useContext(AIContext);
  if (!context) {
    throw new Error('useAI must be used within AIProvider');
  }
  return context;
}
