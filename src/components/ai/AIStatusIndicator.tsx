import { useTranslation } from 'react-i18next';
import { Brain, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useAI } from '@/contexts/AIContext';

interface AIStatusIndicatorProps {
  compact?: boolean;
  showLabel?: boolean;
}

export function AIStatusIndicator({ compact = false, showLabel = true }: AIStatusIndicatorProps) {
  const { t } = useTranslation();
  const { status, loadProgress, progressMessage, loadModel, error, isEnabled, setEnabled } = useAI();

  const handleToggle = async () => {
    if (!isEnabled) {
      setEnabled(true);
      if (status === 'unloaded') {
        await loadModel();
      }
    } else {
      setEnabled(false);
    }
  };

  const handleLoad = async () => {
    await loadModel();
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className={cn('animate-spin', compact ? 'h-3 w-3' : 'h-4 w-4')} />;
      case 'ready':
        return (
          <Sparkles
            className={cn(
              compact ? 'h-3 w-3' : 'h-4 w-4',
              isEnabled ? 'text-blue-500' : 'text-gray-400'
            )}
          />
        );
      case 'error':
        return <AlertCircle className={cn('text-red-500', compact ? 'h-3 w-3' : 'h-4 w-4')} />;
      default:
        return (
          <Brain
            className={cn(compact ? 'h-3 w-3' : 'h-4 w-4', isEnabled ? 'text-gray-600' : 'text-gray-400')}
          />
        );
    }
  };

  const getStatusText = () => {
    if (!isEnabled) {
      return t('ai.status.disabled', 'AI disabled');
    }
    switch (status) {
      case 'loading':
        return progressMessage || t('ai.status.loading', 'Loading...');
      case 'ready':
        return t('ai.status.ready', 'AI ready');
      case 'error':
        return error || t('ai.status.error', 'Error');
      default:
        return t('ai.status.unloaded', 'AI not loaded');
    }
  };

  const getTooltipContent = () => {
    if (!isEnabled) {
      return t('ai.tooltip.clickToEnable', 'Click to enable AI suggestions');
    }
    switch (status) {
      case 'loading':
        return `${t('ai.tooltip.loading', 'Loading model')}... ${loadProgress}%`;
      case 'ready':
        return t('ai.tooltip.ready', 'AI is ready to suggest labels and assignees');
      case 'error':
        return t('ai.tooltip.error', 'Click to retry loading');
      default:
        return t('ai.tooltip.clickToLoad', 'Click to load AI model (~50MB)');
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size={compact ? 'sm' : 'default'}
            className={cn(
              'gap-2',
              compact && 'h-7 px-2',
              !isEnabled && 'opacity-60',
              status === 'loading' && 'cursor-wait'
            )}
            onClick={status === 'unloaded' || status === 'error' ? handleLoad : handleToggle}
            disabled={status === 'loading'}
          >
            {getStatusIcon()}
            {showLabel && (
              <span className={cn('text-xs', compact && 'hidden sm:inline')}>
                {status === 'loading' && loadProgress > 0 ? `${loadProgress}%` : getStatusText()}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipContent()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
