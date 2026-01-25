import type { Label, NoteCategory } from '@/types/note';
import type { Contact } from '@/types/contact';

// Regex para extraer hashtags (soporta caracteres unicode, números y guiones bajos)
// Requiere espacio o inicio de string antes del #
const HASHTAG_REGEX = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;

const VALID_CATEGORIES: NoteCategory[] = ['todo', 'followup', 'notes', 'meeting'];

// Minimum score threshold for fuzzy matching (0-1)
const FUZZY_THRESHOLD = 0.6;

interface FuzzyMatch<T> {
  item: T;
  score: number;
}

/**
 * Calculates a fuzzy match score between a query and a target string.
 * Returns a score from 0 to 1, where 1 is an exact match.
 *
 * Scoring criteria:
 * - Exact match: 1.0
 * - Prefix match: 0.9 + bonus for length ratio
 * - Subsequence match: based on character positions
 */
function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  // Exact match
  if (q === t) return 1.0;

  // Query longer than target - no match possible
  if (q.length > t.length) return 0;

  // Prefix match (e.g., "lili" matches "liliana")
  if (t.startsWith(q)) {
    // Score based on how much of the target is covered
    return 0.9 + (q.length / t.length) * 0.1;
  }

  // Subsequence match (e.g., "mkt" matches "market")
  // Check if all characters of query appear in order in target
  let queryIdx = 0;
  let consecutiveBonus = 0;
  let lastMatchIdx = -1;

  for (let targetIdx = 0; targetIdx < t.length && queryIdx < q.length; targetIdx++) {
    if (t[targetIdx] === q[queryIdx]) {
      // Bonus for consecutive matches
      if (lastMatchIdx === targetIdx - 1) {
        consecutiveBonus += 0.1;
      }
      // Bonus for matching at word boundaries
      if (targetIdx === 0 || t[targetIdx - 1] === ' ' || t[targetIdx - 1] === '-' || t[targetIdx - 1] === '_') {
        consecutiveBonus += 0.05;
      }
      lastMatchIdx = targetIdx;
      queryIdx++;
    }
  }

  // All query characters found in order
  if (queryIdx === q.length) {
    const baseScore = q.length / t.length; // Coverage ratio
    return Math.min(0.85, baseScore * 0.7 + consecutiveBonus);
  }

  return 0;
}

/**
 * Finds the best fuzzy match from a list of candidates
 */
function findBestFuzzyMatch<T>(
  query: string,
  candidates: T[],
  getStrings: (item: T) => string[]
): FuzzyMatch<T> | null {
  let bestMatch: FuzzyMatch<T> | null = null;

  for (const item of candidates) {
    const strings = getStrings(item);
    for (const str of strings) {
      const score = fuzzyScore(query, str);
      if (score >= FUZZY_THRESHOLD && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { item, score };
      }
    }
  }

  return bestMatch;
}

export interface HashtagParseContext {
  labels: Label[];
  contacts: Contact[];
}

export interface ParsedHashtag {
  tag: string;
  type: 'category' | 'contact' | 'label' | 'new_label';
  matchedId?: string;
}

export interface HashtagParseResult {
  cleanedContent: string;
  originalContent: string;
  category: NoteCategory | null;
  assigneeId: string | null;
  labelIds: string[];
  newLabelNames: string[];
  parsedHashtags: ParsedHashtag[];
}

/**
 * Extrae todos los hashtags de un string de contenido
 */
export function extractHashtags(content: string): string[] {
  const matches = content.matchAll(HASHTAG_REGEX);
  return Array.from(matches, m => m[1]);
}

/**
 * Parsea hashtags del contenido y los resuelve a categorías, contactos y labels
 *
 * Orden de prioridad:
 * 1. Categorías (todo, followup, notes, meeting)
 * 2. Contactos (por nombre o apellido, case-insensitive)
 * 3. Labels existentes (por nombre, case-insensitive)
 * 4. Crear nuevo label si no hay match
 */
export function parseHashtags(
  content: string,
  context: HashtagParseContext
): HashtagParseResult {
  const hashtags = extractHashtags(content);

  const result: HashtagParseResult = {
    cleanedContent: content,
    originalContent: content,
    category: null,
    assigneeId: null,
    labelIds: [],
    newLabelNames: [],
    parsedHashtags: [],
  };

  if (hashtags.length === 0) {
    return result;
  }

  const processedTags = new Set<string>();
  const tagsToRemove = new Set<string>();

  for (const tag of hashtags) {
    // Evitar procesar el mismo tag múltiples veces
    const normalizedTag = tag.toLowerCase();
    if (processedTags.has(normalizedTag)) {
      tagsToRemove.add(tag);
      continue;
    }
    processedTags.add(normalizedTag);

    // 1. Verificar si es una categoría (fuzzy match)
    const categoryMatch = findBestFuzzyMatch(
      normalizedTag,
      VALID_CATEGORIES,
      (cat) => [cat]
    );
    if (categoryMatch) {
      result.category = categoryMatch.item;
      result.parsedHashtags.push({ tag, type: 'category' });
      tagsToRemove.add(tag);
      continue;
    }

    // 2. Verificar si es un contacto (fuzzy match por nombre o apellido)
    const contactMatch = findBestFuzzyMatch(
      normalizedTag,
      context.contacts,
      (c) => [c.name, c.lastname, `${c.name} ${c.lastname}`]
    );
    if (contactMatch && !result.assigneeId) {
      result.assigneeId = contactMatch.item.id;
      result.parsedHashtags.push({ tag, type: 'contact', matchedId: contactMatch.item.id });
      tagsToRemove.add(tag);
      continue;
    }

    // 3. Verificar si es un label existente (fuzzy match)
    const labelMatch = findBestFuzzyMatch(
      normalizedTag,
      context.labels,
      (l) => [l.name]
    );
    if (labelMatch) {
      if (!result.labelIds.includes(labelMatch.item.id)) {
        result.labelIds.push(labelMatch.item.id);
        result.parsedHashtags.push({ tag, type: 'label', matchedId: labelMatch.item.id });
      }
      tagsToRemove.add(tag);
      continue;
    }

    // 4. No hay match - crear nuevo label
    if (!result.newLabelNames.includes(tag)) {
      result.newLabelNames.push(tag);
      result.parsedHashtags.push({ tag, type: 'new_label' });
    }
    tagsToRemove.add(tag);
  }

  // Eliminar los hashtags procesados del contenido
  if (tagsToRemove.size > 0) {
    result.cleanedContent = removeHashtagsFromContent(content, tagsToRemove);
  }

  return result;
}

/**
 * Elimina los hashtags especificados del contenido
 */
function removeHashtagsFromContent(content: string, tagsToRemove: Set<string>): string {
  // Crear un regex que matchee los hashtags específicos
  let cleaned = content;

  for (const tag of tagsToRemove) {
    // Escapar caracteres especiales de regex en el tag
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Matchear el hashtag con posible espacio antes
    const tagRegex = new RegExp(`(^|\\s)#${escapedTag}(?=\\s|$)`, 'gi');
    cleaned = cleaned.replace(tagRegex, '$1');
  }

  // Limpiar espacios múltiples y trim
  return cleaned.replace(/\s+/g, ' ').trim();
}
