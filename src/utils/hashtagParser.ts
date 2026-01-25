import Fuse, { type IFuseOptions } from 'fuse.js';
import type { Label, NoteCategory } from '@/types/note';
import type { Contact } from '@/types/contact';

// Regex para extraer hashtags (soporta caracteres unicode, números y guiones bajos)
// Requiere espacio o inicio de string antes del #
const HASHTAG_REGEX = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;

const VALID_CATEGORIES: NoteCategory[] = ['todo', 'followup', 'notes', 'meeting'];

// Fuse.js base options
const FUSE_OPTIONS: IFuseOptions<unknown> = {
  threshold: 0.4, // 0 = exact match, 1 = match anything
  distance: 100,
  minMatchCharLength: 2,
  includeScore: true,
};

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
 * Busca la mejor coincidencia fuzzy para una categoría
 */
function findCategoryMatch(query: string): NoteCategory | null {
  const fuse = new Fuse(VALID_CATEGORIES, {
    ...FUSE_OPTIONS,
    threshold: 0.3, // Más estricto para categorías
  });
  const results = fuse.search(query);
  return results.length > 0 ? results[0].item : null;
}

/**
 * Busca la mejor coincidencia fuzzy para un contacto
 */
function findContactMatch(query: string, contacts: Contact[]): Contact | null {
  if (contacts.length === 0) return null;

  const fuse = new Fuse(contacts, {
    ...FUSE_OPTIONS,
    keys: ['name', 'lastname'],
  });
  const results = fuse.search(query);
  return results.length > 0 ? results[0].item : null;
}

/**
 * Busca la mejor coincidencia fuzzy para un label
 */
function findLabelMatch(query: string, labels: Label[]): Label | null {
  if (labels.length === 0) return null;

  const fuse = new Fuse(labels, {
    ...FUSE_OPTIONS,
    keys: ['name'],
  });
  const results = fuse.search(query);
  return results.length > 0 ? results[0].item : null;
}

/**
 * Parsea hashtags del contenido y los resuelve a categorías, contactos y labels
 *
 * Orden de prioridad:
 * 1. Categorías (todo, followup, notes, meeting)
 * 2. Contactos (por nombre o apellido, fuzzy match)
 * 3. Labels existentes (por nombre, fuzzy match)
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
    const categoryMatch = findCategoryMatch(normalizedTag);
    if (categoryMatch) {
      result.category = categoryMatch;
      result.parsedHashtags.push({ tag, type: 'category' });
      tagsToRemove.add(tag);
      continue;
    }

    // 2. Verificar si es un contacto (fuzzy match por nombre o apellido)
    const contactMatch = findContactMatch(normalizedTag, context.contacts);
    if (contactMatch && !result.assigneeId) {
      result.assigneeId = contactMatch.id;
      result.parsedHashtags.push({ tag, type: 'contact', matchedId: contactMatch.id });
      tagsToRemove.add(tag);
      continue;
    }

    // 3. Verificar si es un label existente (fuzzy match)
    const labelMatch = findLabelMatch(normalizedTag, context.labels);
    if (labelMatch) {
      if (!result.labelIds.includes(labelMatch.id)) {
        result.labelIds.push(labelMatch.id);
        result.parsedHashtags.push({ tag, type: 'label', matchedId: labelMatch.id });
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
