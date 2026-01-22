import { useTranslation } from 'react-i18next';
import { Check, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { LabelSuggestion, AssigneeSuggestion } from '@/types/ai';

interface AISuggestionBadgeProps {
  labelSuggestions: LabelSuggestion[];
  assigneeSuggestion: AssigneeSuggestion | null;
  onAcceptLabel: (labelId: string) => void;
  onAcceptAssignee: (assigneeId: string) => void;
  onAcceptAll: () => void;
  onDismiss: () => void;
  compact?: boolean;
}

export function AISuggestionBadge({
  labelSuggestions,
  assigneeSuggestion,
  onAcceptLabel,
  onAcceptAssignee,
  onAcceptAll,
  onDismiss,
  compact = false,
}: AISuggestionBadgeProps) {
  const { t } = useTranslation();

  const hasSuggestions = labelSuggestions.length > 0 || assigneeSuggestion;

  if (!hasSuggestions) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800',
        compact && 'p-1.5'
      )}
    >
      <Sparkles className={cn('text-blue-500 shrink-0', compact ? 'h-3 w-3' : 'h-4 w-4')} />

      <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
        {/* Label suggestions */}
        {labelSuggestions.map((suggestion) => (
          <button
            key={suggestion.labelId}
            onClick={() => onAcceptLabel(suggestion.labelId)}
            className="group flex items-center gap-1 hover:opacity-80 transition-opacity"
            title={t('ai.suggestions.clickToAccept', 'Click to accept')}
          >
            <Badge
              variant="outline"
              className={cn('cursor-pointer transition-all', compact && 'text-xs px-1.5 py-0')}
              style={{
                backgroundColor: `${suggestion.color}20`,
                borderColor: suggestion.color,
                color: suggestion.color,
              }}
            >
              {suggestion.labelName}
              <span className="ml-1 text-xs opacity-60">
                {Math.round(suggestion.confidence * 100)}%
              </span>
            </Badge>
          </button>
        ))}

        {/* Assignee suggestion */}
        {assigneeSuggestion && (
          <button
            onClick={() => onAcceptAssignee(assigneeSuggestion.assigneeId)}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            title={t('ai.suggestions.clickToAccept', 'Click to accept')}
          >
            <span className="font-medium">{assigneeSuggestion.assigneeName}</span>
            <span className="opacity-60">({Math.round(assigneeSuggestion.confidence * 100)}%)</span>
          </button>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className={cn('text-green-600 hover:text-green-700 hover:bg-green-100', compact && 'h-6 w-6')}
          onClick={onAcceptAll}
          title={t('ai.suggestions.acceptAll', 'Accept all')}
        >
          <Check className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className={cn('text-gray-400 hover:text-gray-600 hover:bg-gray-100', compact && 'h-6 w-6')}
          onClick={onDismiss}
          title={t('ai.suggestions.dismiss', 'Dismiss')}
        >
          <X className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
        </Button>
      </div>
    </div>
  );
}
