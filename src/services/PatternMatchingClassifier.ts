import type {
  ClassificationCandidate,
  LabelSuggestion,
  AssigneeSuggestion,
  ClassificationResult,
} from '@/types/ai';

// ============================================================================
// PATTERN DEFINITION TYPES
// ============================================================================

export interface LabelPattern {
  // Direct keywords that trigger this label
  keywords: string[];

  // Regex patterns for more complex matching
  patterns?: RegExp[];

  // Weight/importance of this pattern (0-1)
  weight?: number;

  // Synonyms and variations
  synonyms?: string[];

  // Context words that boost confidence when present
  contextBoost?: string[];
}

export interface PatternConfig {
  // Minimum confidence to suggest a label
  minConfidence?: number;

  // Maximum number of labels to suggest
  maxSuggestions?: number;

  // Enable case-sensitive matching
  caseSensitive?: boolean;

  // Language detection (auto, es, en)
  language?: 'auto' | 'es' | 'en';
}

// ============================================================================
// STOPWORDS (Spanish & English)
// ============================================================================

const STOPWORDS_ES = new Set([
  'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'ser', 'se', 'no', 'haber',
  'por', 'con', 'su', 'para', 'como', 'estar', 'tener', 'le', 'lo', 'todo',
  'pero', 'más', 'hacer', 'o', 'poder', 'decir', 'este', 'ir', 'otro', 'ese',
  'si', 'me', 'ya', 'ver', 'porque', 'dar', 'cuando', 'él', 'muy', 'sin',
  'vez', 'mucho', 'saber', 'qué', 'sobre', 'mi', 'alguno', 'mismo', 'yo',
  'también', 'hasta', 'año', 'dos', 'querer', 'entre', 'así', 'primero',
  'desde', 'grande', 'eso', 'ni', 'nos', 'llegar', 'pasar', 'tiempo', 'ella',
  'sí', 'día', 'uno', 'bien', 'poco', 'deber', 'entonces', 'poner', 'cosa',
  'tanto', 'hombre', 'parecer', 'nuestro', 'tan', 'donde', 'ahora', 'parte',
  'después', 'vida', 'quedar', 'siempre', 'creer', 'hablar', 'llevar', 'dejar',
]);

const STOPWORDS_EN = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for',
  'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his',
  'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my',
  'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if',
  'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like',
  'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year',
  'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
  'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back',
  'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even',
  'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us',
]);

// ============================================================================
// DEFAULT PATTERNS (Common task categories - bilingual)
// ============================================================================

export const DEFAULT_LABEL_PATTERNS: Record<string, LabelPattern> = {
  // Meeting/Reunion patterns
  'reunión': {
    keywords: ['reunión', 'reunion', 'meeting', 'junta', 'call', 'videollamada', 'zoom', 'meet', 'teams'],
    patterns: [
      /reuni(r|ón|ones|endo)/i,
      /meet(ing)?s?/i,
      /junta/i,
      /\b(zoom|teams|meet|skype)\b/i,
    ],
    weight: 0.9,
    synonyms: ['encuentro', 'cita', 'sesión'],
    contextBoost: ['agendar', 'programar', 'convocar', 'asistir', 'schedule'],
  },

  // Urgent/Priority patterns
  'urgente': {
    keywords: ['urgente', 'urgent', 'asap', 'prioridad', 'priority', 'ya', 'ahora', 'inmediato'],
    patterns: [
      /urgent/i,
      /asap/i,
      /priorid(ad)?/i,
      /\bya\b/i,
      /inmediato/i,
      /cuanto antes/i,
    ],
    weight: 0.95,
    synonyms: ['importante', 'critical', 'critico'],
    contextBoost: ['rápido', 'quick', 'fast', 'rush'],
  },

  // Client/Customer patterns
  'cliente': {
    keywords: ['cliente', 'client', 'customer', 'consumidor'],
    patterns: [/client[es]?/i, /custom[ae]r/i],
    weight: 0.85,
    synonyms: ['usuario', 'comprador', 'user'],
    contextBoost: ['atender', 'contactar', 'llamar', 'email', 'follow-up', 'seguimiento'],
  },

  // Development/Coding patterns
  'desarrollo': {
    keywords: ['código', 'code', 'programar', 'develop', 'bug', 'feature', 'fix', 'implementar'],
    patterns: [
      /cod(e|igo|ificar)/i,
      /program(ar|ming)?/i,
      /develop/i,
      /\bbug\b/i,
      /feature/i,
      /\bfix\b/i,
      /implement/i,
    ],
    weight: 0.8,
    synonyms: ['software', 'app', 'aplicación', 'sistema'],
    contextBoost: ['api', 'frontend', 'backend', 'database', 'test', 'deploy'],
  },

  // Email/Communication patterns
  'email': {
    keywords: ['email', 'correo', 'mail', 'mensaje', 'enviar', 'responder'],
    patterns: [
      /e-?mail/i,
      /corre[ou]/i,
      /\bmail\b/i,
      /@/,
      /enviar/i,
      /responder/i,
    ],
    weight: 0.85,
    synonyms: ['mensaje', 'comunicación'],
    contextBoost: ['redactar', 'escribir', 'contestar', 'reply', 'send'],
  },

  // Document/Report patterns
  'documento': {
    keywords: ['documento', 'document', 'reporte', 'report', 'informe', 'presentación', 'presentation'],
    patterns: [
      /document[oa]/i,
      /report[e]?/i,
      /inform[e]?/i,
      /presentaci[oó]n/i,
      /\.pdf|\.docx?|\.pptx?/i,
    ],
    weight: 0.8,
    synonyms: ['archivo', 'file', 'propuesta'],
    contextBoost: ['preparar', 'redactar', 'revisar', 'finalizar', 'review', 'draft'],
  },

  // Payment/Billing patterns
  'pago': {
    keywords: ['pago', 'payment', 'factura', 'invoice', 'cobro', 'billing', 'presupuesto', 'budget'],
    patterns: [
      /pag[ou]/i,
      /payment/i,
      /factura/i,
      /invoice/i,
      /cobr[ou]/i,
      /\$|€|£/,
      /presupuesto/i,
    ],
    weight: 0.9,
    synonyms: ['dinero', 'money', 'precio', 'price', 'costo'],
    contextBoost: ['enviar', 'recibir', 'procesar', 'pendiente', 'send', 'receive'],
  },

  // Review/Revision patterns
  'revisión': {
    keywords: ['revisar', 'review', 'revisión', 'verificar', 'check', 'validar'],
    patterns: [
      /revis(ar|ión|ion)/i,
      /review/i,
      /verificar/i,
      /\bcheck\b/i,
      /validar/i,
    ],
    weight: 0.75,
    synonyms: ['comprobar', 'evaluar', 'evaluar'],
    contextBoost: ['pendiente', 'pending', 'completar', 'finalizar'],
  },

  // Call/Phone patterns
  'llamada': {
    keywords: ['llamar', 'call', 'teléfono', 'phone', 'contactar'],
    patterns: [
      /llam(ar|ada)/i,
      /\bcall\b/i,
      /tel[eé]fono/i,
      /phone/i,
      /contactar/i,
      /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/,
    ],
    weight: 0.85,
    synonyms: ['hablar', 'comunicar'],
    contextBoost: ['cliente', 'proveedor', 'client', 'supplier'],
  },

  // Follow-up patterns
  'seguimiento': {
    keywords: ['seguimiento', 'follow-up', 'followup', 'tracking', 'monitorear'],
    patterns: [
      /seguimiento/i,
      /follow-?up/i,
      /track(ing)?/i,
      /monitorear/i,
    ],
    weight: 0.8,
    synonyms: ['rastreo', 'control'],
    contextBoost: ['pendiente', 'pending', 'verificar', 'check'],
  },
};

// ============================================================================
// PATTERN MATCHING CLASSIFIER
// ============================================================================

export class PatternMatchingClassifier {
  private config: Required<PatternConfig>;
  private customPatterns: Map<string, LabelPattern> = new Map();

  // Singleton
  private static instance: PatternMatchingClassifier;

  static getInstance(): PatternMatchingClassifier {
    if (!this.instance) {
      this.instance = new PatternMatchingClassifier();
    }
    return this.instance;
  }

  constructor(config: PatternConfig = {}) {
    this.config = {
      minConfidence: config.minConfidence ?? 0.3,
      maxSuggestions: config.maxSuggestions ?? 5,
      caseSensitive: config.caseSensitive ?? false,
      language: config.language ?? 'auto',
    };
  }

  // ============================================================================
  // PUBLIC API (compatible with AIClassificationService)
  // ============================================================================

  /**
   * Initialize (no-op for pattern matching, kept for API compatibility)
   */
  async initialize(): Promise<void> {
    // Pattern matching doesn't require initialization
    return Promise.resolve();
  }

  /**
   * Get status (always ready for pattern matching)
   */
  getStatus(): 'unloaded' | 'loading' | 'ready' {
    return 'ready';
  }

  /**
   * Classify text for labels
   */
  async classifyForLabels(
    text: string,
    candidateLabels: ClassificationCandidate[],
    colors: Record<string, string>
  ): Promise<LabelSuggestion[]> {
    if (!text.trim() || candidateLabels.length === 0) {
      return [];
    }

    const scores = new Map<string, number>();
    const normalizedText = this.normalizeText(text);
    const tokens = this.tokenize(normalizedText);

    // Score each candidate label
    for (const candidate of candidateLabels) {
      const score = this.scoreLabel(candidate.label, normalizedText, tokens);
      if (score > 0) {
        scores.set(candidate.id, score);
      }
    }

    // Convert to suggestions and sort by confidence
    const suggestions: LabelSuggestion[] = Array.from(scores.entries())
      .map(([labelId, confidence]) => {
        const candidate = candidateLabels.find((c) => c.id === labelId);
        if (!candidate) return null;

        return {
          labelId,
          labelName: candidate.label,
          color: colors[labelId] || '#6b7280',
          confidence,
        };
      })
      .filter((s): s is LabelSuggestion =>
        s !== null && s.confidence >= this.config.minConfidence
      )
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, this.config.maxSuggestions);

    return suggestions;
  }

  /**
   * Classify text for assignee (simpler matching)
   */
  async classifyForAssignee(
    text: string,
    candidates: ClassificationCandidate[]
  ): Promise<AssigneeSuggestion | null> {
    if (!text.trim() || candidates.length === 0) {
      return null;
    }

    const normalizedText = this.normalizeText(text);
    const scores: Array<{ candidate: ClassificationCandidate; score: number }> = [];

    // Simple name matching for assignees
    for (const candidate of candidates) {
      const nameParts = candidate.label.toLowerCase().split(/\s+/);
      let score = 0;

      for (const part of nameParts) {
        if (part.length < 2) continue;
        if (normalizedText.includes(part)) {
          score += 0.5;
        }
      }

      if (score > 0) {
        scores.push({ candidate, score: Math.min(score, 1.0) });
      }
    }

    if (scores.length === 0) return null;

    // Get highest score
    scores.sort((a, b) => b.score - a.score);
    const top = scores[0];

    if (top.score < 0.3) return null;

    return {
      assigneeId: top.candidate.id,
      assigneeName: top.candidate.label,
      confidence: top.score,
    };
  }

  /**
   * Combined classification (labels + assignee)
   */
  async classify(
    text: string,
    labels: ClassificationCandidate[],
    labelColors: Record<string, string>,
    assignees: ClassificationCandidate[]
  ): Promise<ClassificationResult> {
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

  // ============================================================================
  // PATTERN MANAGEMENT
  // ============================================================================

  /**
   * Add or update a custom pattern for a label
   */
  addPattern(labelName: string, pattern: LabelPattern): void {
    this.customPatterns.set(labelName.toLowerCase(), pattern);
  }

  /**
   * Remove a custom pattern
   */
  removePattern(labelName: string): void {
    this.customPatterns.delete(labelName.toLowerCase());
  }

  /**
   * Get all patterns (default + custom)
   */
  getAllPatterns(): Record<string, LabelPattern> {
    return {
      ...DEFAULT_LABEL_PATTERNS,
      ...Object.fromEntries(this.customPatterns),
    };
  }

  // ============================================================================
  // CORE MATCHING LOGIC
  // ============================================================================

  /**
   * Score how well a label matches the text
   */
  private scoreLabel(labelName: string, normalizedText: string, tokens: string[]): number {
    const labelKey = labelName.toLowerCase();

    // Check if we have a pattern for this label
    const pattern = this.customPatterns.get(labelKey) || DEFAULT_LABEL_PATTERNS[labelKey];

    if (!pattern) {
      // No pattern defined, use simple keyword matching
      return this.simpleKeywordMatch(labelKey, tokens);
    }

    let score = 0;
    const weight = pattern.weight ?? 0.7;

    // 1. Keyword matching
    const keywordScore = this.matchKeywords(pattern.keywords, tokens);
    score += keywordScore * weight * 0.4;

    // 2. Regex pattern matching
    if (pattern.patterns) {
      const patternScore = this.matchPatterns(pattern.patterns, normalizedText);
      score += patternScore * weight * 0.4;
    }

    // 3. Synonym matching
    if (pattern.synonyms) {
      const synonymScore = this.matchKeywords(pattern.synonyms, tokens);
      score += synonymScore * weight * 0.1;
    }

    // 4. Context boost
    if (pattern.contextBoost) {
      const contextScore = this.matchKeywords(pattern.contextBoost, tokens);
      score += contextScore * weight * 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Match keywords against tokens
   */
  private matchKeywords(keywords: string[], tokens: string[]): number {
    if (keywords.length === 0) return 0;

    const tokenSet = new Set(tokens);
    let matches = 0;

    for (const keyword of keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim();

      // Exact match
      if (tokenSet.has(normalizedKeyword)) {
        matches++;
        continue;
      }

      // Partial match (keyword contains token or vice versa)
      for (const token of tokens) {
        if (token.length >= 3 && normalizedKeyword.includes(token)) {
          matches += 0.5;
          break;
        }
        if (normalizedKeyword.length >= 3 && token.includes(normalizedKeyword)) {
          matches += 0.5;
          break;
        }
      }
    }

    return matches / keywords.length;
  }

  /**
   * Match regex patterns against text
   */
  private matchPatterns(patterns: RegExp[], text: string): number {
    if (patterns.length === 0) return 0;

    let matches = 0;
    for (const pattern of patterns) {
      if (pattern.test(text)) {
        matches++;
      }
    }

    return matches / patterns.length;
  }

  /**
   * Simple keyword match when no pattern is defined
   */
  private simpleKeywordMatch(labelName: string, tokens: string[]): number {
    const labelTokens = labelName.split(/\s+/);
    let matches = 0;

    for (const labelToken of labelTokens) {
      if (labelToken.length < 2) continue;

      for (const token of tokens) {
        if (token === labelToken) {
          matches++;
          break;
        }
        if (token.length >= 3 && labelToken.length >= 3) {
          if (token.includes(labelToken) || labelToken.includes(token)) {
            matches += 0.5;
            break;
          }
        }
      }
    }

    return labelTokens.length > 0 ? matches / labelTokens.length : 0;
  }

  // ============================================================================
  // TEXT PROCESSING UTILITIES
  // ============================================================================

  /**
   * Normalize text (lowercase, trim, etc.)
   */
  private normalizeText(text: string): string {
    if (this.config.caseSensitive) {
      return text.trim();
    }
    return text.toLowerCase().trim();
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    // Split by whitespace and punctuation, keep alphanumeric
    const tokens = text
      .split(/[\s\p{P}]+/u)
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Remove stopwords
    return this.removeStopwords(tokens);
  }

  /**
   * Remove stopwords from tokens
   */
  private removeStopwords(tokens: string[]): string[] {
    const lang = this.detectLanguage(tokens);
    const stopwords = lang === 'es' ? STOPWORDS_ES : STOPWORDS_EN;

    return tokens.filter((token) => {
      const lower = token.toLowerCase();
      return !stopwords.has(lower);
    });
  }

  /**
   * Simple language detection based on stopwords
   */
  private detectLanguage(tokens: string[]): 'es' | 'en' {
    if (this.config.language !== 'auto') {
      return this.config.language;
    }

    let esScore = 0;
    let enScore = 0;

    for (const token of tokens.slice(0, 20)) {
      // Check first 20 tokens
      const lower = token.toLowerCase();
      if (STOPWORDS_ES.has(lower)) esScore++;
      if (STOPWORDS_EN.has(lower)) enScore++;
    }

    return esScore > enScore ? 'es' : 'en';
  }

  /**
   * Clean up (no-op for pattern matching, kept for API compatibility)
   */
  dispose(): void {
    this.customPatterns.clear();
  }
}
