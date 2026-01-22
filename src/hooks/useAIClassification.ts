import { useState, useCallback, useRef, useEffect } from 'react';
import { useAI } from '@/contexts/AIContext';
import { useLabels } from '@/hooks/useLabels';
import { useAssignees } from '@/hooks/useAssignees';
import { generateContentHash } from '@/services/AIClassificationService';
import type { ClassificationResult, ClassificationCandidate } from '@/types/ai';

interface UseAIClassificationOptions {
  debounceMs?: number;
  minConfidence?: number;
}

interface UseAIClassificationReturn {
  suggestions: ClassificationResult | null;
  isClassifying: boolean;
  classify: (text: string) => Promise<ClassificationResult | null>;
  clearSuggestions: () => void;
}

// In-memory cache for classification results
const classificationCache = new Map<string, ClassificationResult>();

export function useAIClassification(
  options: UseAIClassificationOptions = {}
): UseAIClassificationReturn {
  const { debounceMs = 500, minConfidence = 0.25 } = options;
  const { service, status, isEnabled } = useAI();
  const { labels } = useLabels();
  const { assignees } = useAssignees();

  const [suggestions, setSuggestions] = useState<ClassificationResult | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);

  const debounceTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastContentHash = useRef<string | null>(null);

  // Clear suggestions when disabled
  useEffect(() => {
    if (!isEnabled) {
      setSuggestions(null);
    }
  }, [isEnabled]);

  const classify = useCallback(
    async (text: string): Promise<ClassificationResult | null> => {
      // Don't classify if not enabled or model not ready
      if (!isEnabled || status !== 'ready' || !text.trim()) {
        return null;
      }

      // Check cache first
      const contentHash = generateContentHash(text);
      if (contentHash === lastContentHash.current && suggestions) {
        return suggestions;
      }

      // Check in-memory cache
      const cached = classificationCache.get(contentHash);
      if (cached) {
        setSuggestions(cached);
        lastContentHash.current = contentHash;
        return cached;
      }

      // Clear any pending debounce
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }

      return new Promise((resolve) => {
        debounceTimeout.current = setTimeout(async () => {
          setIsClassifying(true);

          try {
            // Prepare label candidates
            const labelCandidates: ClassificationCandidate[] = labels.map((l) => ({
              id: l.id,
              label: l.name,
            }));

            // Prepare label colors map
            const labelColors: Record<string, string> = {};
            labels.forEach((l) => {
              labelColors[l.id] = l.color;
            });

            // Prepare assignee candidates
            const assigneeCandidates: ClassificationCandidate[] = assignees.map((a) => ({
              id: a.id,
              label: a.name,
            }));

            const result = await service.classify(
              text,
              labelCandidates,
              labelColors,
              assigneeCandidates
            );

            // Filter by minimum confidence
            const filteredResult: ClassificationResult = {
              labels: result.labels.filter((l) => l.confidence >= minConfidence),
              assignee:
                result.assignee && result.assignee.confidence >= minConfidence
                  ? result.assignee
                  : null,
              overallConfidence: result.overallConfidence,
            };

            // Cache the result
            classificationCache.set(contentHash, filteredResult);
            lastContentHash.current = contentHash;

            setSuggestions(filteredResult);
            resolve(filteredResult);
          } catch (error) {
            console.error('AI Classification error:', error);
            resolve(null);
          } finally {
            setIsClassifying(false);
          }
        }, debounceMs);
      });
    },
    [isEnabled, status, service, labels, assignees, minConfidence, debounceMs, suggestions]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions(null);
    lastContentHash.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return {
    suggestions,
    isClassifying,
    classify,
    clearSuggestions,
  };
}
