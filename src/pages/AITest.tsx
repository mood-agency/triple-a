import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AIStatusIndicator } from '@/components/ai/AIStatusIndicator';
import { useAI } from '@/contexts/AIContext';
import type { ClassificationCandidate, LabelSuggestion } from '@/types/ai';

export function AITest() {
  const { service, status, isEnabled } = useAI();

  const [title, setTitle] = useState('');
  const [labelsInput, setLabelsInput] = useState('');
  const [results, setResults] = useState<LabelSuggestion[]>([]);
  const [isClassifying, setIsClassifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClassify = async () => {
    if (!title.trim() || !labelsInput.trim()) {
      setError('Please enter both a title and labels');
      return;
    }

    if (status !== 'ready') {
      setError('AI model is not ready. Please load it first.');
      return;
    }

    setIsClassifying(true);
    setError(null);
    setResults([]);

    try {
      // Parse labels from comma-separated input
      const labelNames = labelsInput
        .split(',')
        .map(l => l.trim())
        .filter(l => l.length > 0);

      if (labelNames.length === 0) {
        setError('Please enter at least one label');
        setIsClassifying(false);
        return;
      }

      // Create label candidates with fake IDs
      const labelCandidates: ClassificationCandidate[] = labelNames.map((name, index) => ({
        id: `label-${index}`,
        label: name,
      }));

      // Create color map (using a simple color palette)
      const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];
      const labelColors: Record<string, string> = {};
      labelCandidates.forEach((l, i) => {
        labelColors[l.id] = colors[i % colors.length];
      });

      // Run classification directly to show ALL labels (not filtered)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const classifier = (service as any).classifier;
      if (!classifier) {
        setError('Classifier not available');
        setIsClassifying(false);
        return;
      }

      const rawResult = await classifier(title, labelNames, { multi_label: true });
      const result = Array.isArray(rawResult) ? rawResult[0] : rawResult;

      // Map all results (no filtering)
      const allResults: LabelSuggestion[] = result.labels.map((label: string, index: number) => {
        const candidate = labelCandidates.find((c) => c.label === label);
        return {
          labelId: candidate?.id || `label-${index}`,
          labelName: label,
          color: labelColors[candidate?.id || `label-${index}`] || '#6b7280',
          confidence: result.scores[index],
        };
      });

      // Sort by confidence descending
      const sortedResults = allResults.sort((a, b) => b.confidence - a.confidence);
      setResults(sortedResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classification failed');
    } finally {
      setIsClassifying(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.5) return 'text-yellow-600 dark:text-yellow-400';
    if (confidence >= 0.3) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getConfidenceBar = (confidence: number) => {
    if (confidence >= 0.7) return 'bg-green-500';
    if (confidence >= 0.5) return 'bg-yellow-500';
    if (confidence >= 0.3) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="min-h-screen p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">AI Classification Test</h1>
        <AIStatusIndicator />
      </div>

      <div className="space-y-6">
        {/* Title Input */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Task Title
          </label>
          <Textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a task title to classify, e.g., 'Schedule meeting with marketing team'"
            className="min-h-[80px]"
          />
        </div>

        {/* Labels Input */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Labels (comma-separated)
          </label>
          <Textarea
            value={labelsInput}
            onChange={(e) => setLabelsInput(e.target.value)}
            placeholder="Enter labels separated by commas, e.g., 'Work, Personal, Urgent, Marketing, Development'"
            className="min-h-[60px]"
          />
        </div>

        {/* Classify Button */}
        <Button
          onClick={handleClassify}
          disabled={isClassifying || status !== 'ready' || !isEnabled}
          className="w-full"
        >
          {isClassifying ? 'Classifying...' : 'Classify'}
        </Button>

        {/* Status Messages */}
        {!isEnabled && (
          <p className="text-sm text-muted-foreground text-center">
            AI is disabled. Click the AI button above to enable it.
          </p>
        )}

        {isEnabled && status !== 'ready' && (
          <p className="text-sm text-muted-foreground text-center">
            AI model is not ready. Click the AI button above to load it.
          </p>
        )}

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Results */}
        {results.length > 0 && (
          <div className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Classification Results</h2>
            <div className="space-y-3">
              {results.map((result) => (
                <div key={result.labelId} className="flex items-center gap-3">
                  <span
                    className="px-2 py-1 text-xs rounded-full text-white shrink-0"
                    style={{ backgroundColor: result.color }}
                  >
                    {result.labelName}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getConfidenceBar(result.confidence)} transition-all`}
                      style={{ width: `${result.confidence * 100}%` }}
                    />
                  </div>
                  <span className={`text-sm font-mono ${getConfidenceColor(result.confidence)}`}>
                    {(result.confidence * 100).toFixed(1)}%
                  </span>
                  {result.confidence >= 0.7 && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      ✓ Would auto-assign
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
              <p>Labels with confidence ≥ 70% will be auto-assigned when a task loses focus.</p>
            </div>
          </div>
        )}

        {/* Example Presets */}
        <div className="border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3 text-muted-foreground">Quick Examples</h2>
          <div className="space-y-2">
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-left h-auto py-2"
              onClick={() => {
                setTitle('Fix bug in login authentication flow');
                setLabelsInput('Bug, Feature, Documentation, Testing, Urgent');
              }}
            >
              <span className="truncate">Bug fix example</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-left h-auto py-2"
              onClick={() => {
                setTitle('Write documentation for the new API endpoints');
                setLabelsInput('Bug, Feature, Documentation, Testing, Urgent');
              }}
            >
              <span className="truncate">Documentation example</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start text-left h-auto py-2"
              onClick={() => {
                setTitle('Call dentist to schedule appointment');
                setLabelsInput('Work, Personal, Health, Finance, Shopping');
              }}
            >
              <span className="truncate">Personal task example</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
