export interface ClassificationCandidate {
  id: string;
  label: string;
}

export interface LabelSuggestion {
  labelId: string;
  labelName: string;
  color: string;
  confidence: number;
}

export interface AssigneeSuggestion {
  assigneeId: string;
  assigneeName: string;
  confidence: number;
}

export interface ClassificationResult {
  labels: LabelSuggestion[];
  assignee: AssigneeSuggestion | null;
  overallConfidence: number;
}

export interface AIClassificationCache {
  id: string;
  content_hash: string;
  suggested_labels: string | null; // JSON array
  suggested_assignee: string | null;
  confidence: number;
  created_at: string;
}

export type AIModelStatus = 'unloaded' | 'loading' | 'ready' | 'error';

export interface AIModelProgress {
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}
