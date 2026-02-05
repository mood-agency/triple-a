import Fuse, { type IFuseOptions } from 'fuse.js';
import type { Label, NoteCategory } from '@/types/note';
import type { Contact } from '@/types/contact';

// Regex para extraer hashtags (soporta caracteres unicode, números y guiones bajos)
// Requiere espacio o inicio de string antes del #
const HASHTAG_REGEX = /(?:^|\s)#([\p{L}\p{N}_-]+)/gu;

// Regex para extraer @mentions (para responsables/contactos)
// Requiere espacio o inicio de string antes del @
const MENTION_REGEX = /(?:^|\s)@([\p{L}\p{N}_-]+)/gu;

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
 * Extrae todas las @mentions de un string de contenido
 */
export function extractMentions(content: string): string[] {
  const matches = content.matchAll(MENTION_REGEX);
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
 * Busca en name, lastname, y también en el nombre completo concatenado (sin espacio)
 * para soportar menciones como @lilianaferro cuando el contacto es "Liliana Ferro"
 */
function findContactMatch(query: string, contacts: Contact[]): Contact | null {
  if (contacts.length === 0) return null;

  // Crear objetos con campos adicionales para buscar
  const searchableContacts = contacts.map(contact => ({
    ...contact,
    fullNameNoSpace: `${contact.name}${contact.lastname}`.toLowerCase(),
    fullName: `${contact.name} ${contact.lastname}`.toLowerCase(),
  }));

  const fuse = new Fuse(searchableContacts, {
    ...FUSE_OPTIONS,
    keys: ['name', 'lastname', 'fullNameNoSpace', 'fullName'],
  });
  const results = fuse.search(query);

  // Retornar el contacto original (sin los campos adicionales)
  if (results.length > 0) {
    const matchedId = results[0].item.id;
    return contacts.find(c => c.id === matchedId) || null;
  }
  return null;
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
 * Parsea hashtags y @mentions del contenido y los resuelve a categorías, contactos y labels
 *
 * Sintaxis:
 * - @mention → Responsable (contacto por nombre o apellido, fuzzy match)
 * - #hashtag → Categoría, label existente, o nuevo label
 *
 * Orden de procesamiento:
 * 1. @mentions → Contactos (todos se agregan como responsables)
 * 2. #hashtags → Categorías (todo, followup, notes, meeting)
 * 3. #hashtags → Labels existentes (por nombre, fuzzy match)
 * 4. #hashtags → Crear nuevo label si no hay match
 */
export function parseHashtags(
  content: string,
  context: HashtagParseContext
): HashtagParseResult {
  const hashtags = extractHashtags(content);
  const mentions = extractMentions(content);

  const result: HashtagParseResult = {
    cleanedContent: content,
    originalContent: content,
    category: null,
    assigneeId: null,
    labelIds: [],
    newLabelNames: [],
    parsedHashtags: [],
  };

  if (hashtags.length === 0 && mentions.length === 0) {
    return result;
  }

  const processedTags = new Set<string>();
  const hashtagsToRemove = new Set<string>();
  const mentionsToRemove = new Set<string>();

  // 1. Procesar @mentions para contactos
  for (const mention of mentions) {
    const normalizedMention = mention.toLowerCase();
    if (processedTags.has(`@${normalizedMention}`)) {
      mentionsToRemove.add(mention);
      continue;
    }
    processedTags.add(`@${normalizedMention}`);

    const contactMatch = findContactMatch(normalizedMention, context.contacts);
    if (contactMatch) {
      // El primer contacto se asigna como assigneeId principal (para compatibilidad)
      if (!result.assigneeId) {
        result.assigneeId = contactMatch.id;
      }
      // Todos los contactos se agregan a parsedHashtags para ser procesados
      result.parsedHashtags.push({ tag: mention, type: 'contact', matchedId: contactMatch.id });
    }
    mentionsToRemove.add(mention);
  }

  // 2. Procesar #hashtags para categorías y labels
  for (const tag of hashtags) {
    const normalizedTag = tag.toLowerCase();
    if (processedTags.has(`#${normalizedTag}`)) {
      hashtagsToRemove.add(tag);
      continue;
    }
    processedTags.add(`#${normalizedTag}`);

    // 2a. Verificar si es una categoría (fuzzy match)
    const categoryMatch = findCategoryMatch(normalizedTag);
    if (categoryMatch) {
      result.category = categoryMatch;
      result.parsedHashtags.push({ tag, type: 'category' });
      hashtagsToRemove.add(tag);
      continue;
    }

    // 2b. Verificar si es un label existente (fuzzy match)
    const labelMatch = findLabelMatch(normalizedTag, context.labels);
    if (labelMatch) {
      if (!result.labelIds.includes(labelMatch.id)) {
        result.labelIds.push(labelMatch.id);
        result.parsedHashtags.push({ tag, type: 'label', matchedId: labelMatch.id });
      }
      hashtagsToRemove.add(tag);
      continue;
    }

    // 2c. No hay match - crear nuevo label
    if (!result.newLabelNames.includes(tag)) {
      result.newLabelNames.push(tag);
      result.parsedHashtags.push({ tag, type: 'new_label' });
    }
    hashtagsToRemove.add(tag);
  }

  // Eliminar los hashtags y mentions procesados del contenido
  if (hashtagsToRemove.size > 0 || mentionsToRemove.size > 0) {
    result.cleanedContent = removeTagsFromContent(content, hashtagsToRemove, mentionsToRemove);
  }

  return result;
}

/**
 * Elimina los hashtags y mentions especificados del contenido
 */
function removeTagsFromContent(
  content: string,
  hashtagsToRemove: Set<string>,
  mentionsToRemove: Set<string>
): string {
  let cleaned = content;

  // Remover #hashtags
  for (const tag of hashtagsToRemove) {
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tagRegex = new RegExp(`(^|\\s)#${escapedTag}(?=\\s|$)`, 'gi');
    cleaned = cleaned.replace(tagRegex, '$1');
  }

  // Remover @mentions
  for (const mention of mentionsToRemove) {
    const escapedMention = mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mentionRegex = new RegExp(`(^|\\s)@${escapedMention}(?=\\s|$)`, 'gi');
    cleaned = cleaned.replace(mentionRegex, '$1');
  }

  // Limpiar espacios múltiples y trim
  return cleaned.replace(/\s+/g, ' ').trim();
}
