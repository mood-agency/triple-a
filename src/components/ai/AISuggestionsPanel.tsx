import { useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2 } from 'lucide-react';
import { useAI } from '@/contexts/AIContext';
import { useAIClassification } from '@/hooks/useAIClassification';
import { useLabels } from '@/hooks/useLabels';
import { AISuggestionBadge } from './AISuggestionBadge';
import { AIStatusIndicator } from './AIStatusIndicator';
import type { Note } from '@/types/note';

interface AISuggestionsPanelProps {
  note: Note | null;
  onAddLabel: (labelId: string) => void;
  onSetAssignee: (assigneeId: string) => void;
}

export function AISuggestionsPanel({
  note,
  onAddLabel,
  onSetAssignee,
}: AISuggestionsPanelProps) {
  const { t } = useTranslation();
  const { status, isEnabled } = useAI();
  const { setLabelsForNote } = useLabels();
  const { suggestions, isClassifying, classify, clearSuggestions } = useAIClassification();

  // Classify when note content changes
  useEffect(() => {
    if (note && note.content && isEnabled && status === 'ready') {
      const text = note.description
        ? `${note.content}\n${note.description}`
        : note.content;
      classify(text);
    } else {
      clearSuggestions();
    }
  }, [note?.id, note?.content, note?.description, isEnabled, status, classify, clearSuggestions]);

  const handleAcceptLabel = useCallback(
    (labelId: string) => {
      onAddLabel(labelId);
    },
    [onAddLabel]
  );

  const handleAcceptAssignee = useCallback(
    (assigneeId: string) => {
      onSetAssignee(assigneeId);
    },
    [onSetAssignee]
  );

  const handleAcceptAll = useCallback(async () => {
    if (!note || !suggestions) return;

    // Add all suggested labels
    if (suggestions.labels.length > 0) {
      const labelIds = suggestions.labels.map((l) => l.labelId);
      await setLabelsForNote(note.id, labelIds);
    }

    // Set assignee
    if (suggestions.assignee) {
      onSetAssignee(suggestions.assignee.assigneeId);
    }

    clearSuggestions();
  }, [note, suggestions, setLabelsForNote, onSetAssignee, clearSuggestions]);

  // Don't render if AI is disabled or not ready
  if (!isEnabled) {
    return (
      <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t('ai.status.disabled')}</span>
        </div>
        <AIStatusIndicator compact showLabel={false} />
      </div>
    );
  }

  if (status !== 'ready') {
    return (
      <div className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" />
          <span>{t('ai.status.unloaded')}</span>
        </div>
        <AIStatusIndicator compact showLabel={false} />
      </div>
    );
  }

  // Show loading state
  if (isClassifying) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-950/30 text-xs text-blue-600 dark:text-blue-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>{t('ai.status.loading')}</span>
      </div>
    );
  }

  // Show suggestions if available
  if (suggestions && (suggestions.labels.length > 0 || suggestions.assignee)) {
    return (
      <AISuggestionBadge
        labelSuggestions={suggestions.labels}
        assigneeSuggestion={suggestions.assignee}
        onAcceptLabel={handleAcceptLabel}
        onAcceptAssignee={handleAcceptAssignee}
        onAcceptAll={handleAcceptAll}
        onDismiss={clearSuggestions}
        compact
      />
    );
  }

  // No suggestions available
  return null;
}
