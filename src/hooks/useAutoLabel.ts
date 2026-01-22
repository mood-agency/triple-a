import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAI } from '@/contexts/AIContext';
import { useLabels } from '@/hooks/useLabels';
import type { ClassificationCandidate } from '@/types/ai';

interface UseAutoLabelOptions {
  minConfidence?: number;
}

interface UseAutoLabelReturn {
  autoLabelNote: (noteId: string, content: string, description?: string | null) => Promise<void>;
  isReady: boolean;
}

// Track which notes have already been auto-labeled to avoid duplicate labeling
const autoLabeledNotes = new Set<string>();

export function useAutoLabel(options: UseAutoLabelOptions = {}): UseAutoLabelReturn {
  const { minConfidence = 0.7 } = options;
  const { t } = useTranslation();
  const { service, status, isEnabled } = useAI();
  const { labels, addLabelToNote, getLabelsForNote } = useLabels();
  const processingRef = useRef<Set<string>>(new Set());

  const isReady = isEnabled && status === 'ready';

  const autoLabelNote = useCallback(
    async (noteId: string, content: string, description?: string | null): Promise<void> => {
      // Don't process if AI not ready or already labeled/processing
      if (!isReady || !content.trim()) return;
      if (autoLabeledNotes.has(noteId)) return;
      if (processingRef.current.has(noteId)) return;

      // Check if note already has labels
      const existingLabels = getLabelsForNote(noteId);
      if (existingLabels.length > 0) {
        autoLabeledNotes.add(noteId);
        return;
      }

      // Mark as processing
      processingRef.current.add(noteId);

      try {
        // Combine content and description for classification
        const text = description ? `${content}\n${description}` : content;

        // Prepare label candidates
        const labelCandidates: ClassificationCandidate[] = labels.map((l) => ({
          id: l.id,
          label: l.name,
        }));

        if (labelCandidates.length === 0) {
          return;
        }

        // Prepare label colors map
        const labelColors: Record<string, string> = {};
        labels.forEach((l) => {
          labelColors[l.id] = l.color;
        });

        // Classify for labels only (no assignees for auto-label)
        const result = await service.classifyForLabels(text, labelCandidates, labelColors);

        // Filter by confidence and add labels
        const labelsToAdd = result.filter((l) => l.confidence >= minConfidence);

        if (labelsToAdd.length > 0) {
          for (const labelSuggestion of labelsToAdd) {
            await addLabelToNote(noteId, labelSuggestion.labelId);
          }
          toast.success(t('toast.autoLabelSuccess'));
        }

        // Mark as processed
        autoLabeledNotes.add(noteId);
      } catch (error) {
        console.error('Auto-label error:', error);
        toast.error(t('toast.autoLabelFailed'));
      } finally {
        processingRef.current.delete(noteId);
      }
    },
    [isReady, service, labels, addLabelToNote, getLabelsForNote, minConfidence, t]
  );

  return {
    autoLabelNote,
    isReady,
  };
}

// Clear the auto-labeled cache for a specific note (useful if user removes all labels)
export function clearAutoLabelCache(noteId: string): void {
  autoLabeledNotes.delete(noteId);
}

// Clear the entire auto-label cache (useful for testing or reset)
export function clearAllAutoLabelCache(): void {
  autoLabeledNotes.clear();
}
