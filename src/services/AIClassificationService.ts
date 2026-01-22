import type {
  ClassificationCandidate,
  LabelSuggestion,
  AssigneeSuggestion,
  ClassificationResult,
  AIModelProgress,
} from '@/types/ai';

// Types for dynamic import
type Pipeline = Awaited<ReturnType<typeof import('@xenova/transformers')['pipeline']>>;
type ZeroShotClassificationPipeline = Pipeline;

// Type for zero-shot classification result
interface ZeroShotClassificationResult {
  sequence: string;
  labels: string[];
  scores: number[];
}

export class AIClassificationService {
  private classifier: ZeroShotClassificationPipeline | null = null;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;
  private progressCallback: ((progress: AIModelProgress) => void) | null = null;

  // Singleton
  private static instance: AIClassificationService;
  static getInstance(): AIClassificationService {
    if (!this.instance) {
      this.instance = new AIClassificationService();
    }
    return this.instance;
  }

  setProgressCallback(callback: ((progress: AIModelProgress) => void) | null): void {
    this.progressCallback = callback;
  }

  async initialize(): Promise<void> {
    if (this.classifier) return;
    if (this.loadPromise) return this.loadPromise;

    this.isLoading = true;
    this.loadPromise = (async () => {
      try {
        // Dynamic import to avoid loading ONNX runtime until needed
        const { pipeline, env } = await import('@xenova/transformers');

        // Configure transformers.js to use browser cache
        env.allowLocalModels = false;
        env.useBrowserCache = true;

        // Use DeBERTa v3 small for better classification quality
        this.classifier = await pipeline(
          'zero-shot-classification',
          'Xenova/nli-deberta-v3-small',
          {
            progress_callback: (progress: AIModelProgress) => {
              if (this.progressCallback) {
                this.progressCallback(progress);
              }
            },
          }
        );
      } catch (error) {
        this.isLoading = false;
        this.loadPromise = null;
        throw error;
      }
    })();

    await this.loadPromise;
    this.isLoading = false;
  }

  getStatus(): 'unloaded' | 'loading' | 'ready' {
    if (this.classifier) return 'ready';
    if (this.isLoading) return 'loading';
    return 'unloaded';
  }

  async classifyForLabels(
    text: string,
    candidateLabels: ClassificationCandidate[],
    colors: Record<string, string>
  ): Promise<LabelSuggestion[]> {
    if (!this.classifier) {
      throw new Error('Classifier not initialized');
    }

    if (candidateLabels.length === 0 || !text.trim()) {
      return [];
    }

    const labels = candidateLabels.map((c) => c.label);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawResult = await (this.classifier as any)(text, labels, {
      multi_label: true, // Allow multiple labels
    });

    // Handle both array and single result formats
    const result = (Array.isArray(rawResult) ? rawResult[0] : rawResult) as ZeroShotClassificationResult;
    const resultLabels = result.labels;
    const resultScores = result.scores;

    return resultLabels
      .map((label: string, index: number) => {
        const candidate = candidateLabels.find((c) => c.label === label);
        if (!candidate) return null;
        return {
          labelId: candidate.id,
          labelName: label,
          color: colors[candidate.id] || '#6b7280',
          confidence: resultScores[index],
        };
      })
      .filter((r): r is LabelSuggestion => r !== null && r.confidence > 0.25);
  }

  async classifyForAssignee(
    text: string,
    candidates: ClassificationCandidate[]
  ): Promise<AssigneeSuggestion | null> {
    if (!this.classifier || candidates.length === 0 || !text.trim()) {
      return null;
    }

    // Create natural hypotheses for assignment
    const hypotheses = candidates.map((c) => `This task should be assigned to ${c.label}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawResult = await (this.classifier as any)(text, hypotheses);

    // Handle both array and single result formats
    const result = (Array.isArray(rawResult) ? rawResult[0] : rawResult) as ZeroShotClassificationResult;
    const resultScores = result.scores;

    const topIndex = resultScores.indexOf(Math.max(...resultScores));
    const topScore = resultScores[topIndex];

    // Only suggest if confidence is reasonable (>0.3)
    if (topScore < 0.3) return null;

    return {
      assigneeId: candidates[topIndex].id,
      assigneeName: candidates[topIndex].label,
      confidence: topScore,
    };
  }

  async classify(
    text: string,
    labels: ClassificationCandidate[],
    labelColors: Record<string, string>,
    assignees: ClassificationCandidate[]
  ): Promise<ClassificationResult> {
    if (!this.classifier) {
      throw new Error('Classifier not initialized');
    }

    const [labelResults, assigneeResult] = await Promise.all([
      this.classifyForLabels(text, labels, labelColors),
      this.classifyForAssignee(text, assignees),
    ]);

    // Calculate overall confidence
    const allConfidences = [...labelResults.map((l) => l.confidence)];
    if (assigneeResult) {
      allConfidences.push(assigneeResult.confidence);
    }
    const overallConfidence =
      allConfidences.length > 0
        ? allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length
        : 0;

    return {
      labels: labelResults,
      assignee: assigneeResult,
      overallConfidence,
    };
  }

  // Clean up resources
  dispose(): void {
    this.classifier = null;
    this.loadPromise = null;
    this.isLoading = false;
  }
}

// Helper to generate content hash for caching
export function generateContentHash(content: string): string {
  // Simple hash function for content
  let hash = 0;
  const str = content.toLowerCase().trim();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}
