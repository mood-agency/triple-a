/**
 * Utility for detecting and parsing URLs in text
 */

// Regex to match URLs (http, https)
const URL_REGEX = /(https?:\/\/[^\s<>[\](){}'"]+[^\s<>[\](){}'".,;:!?])/g;

export interface TextSegment {
  type: 'text' | 'link';
  value: string;
}

/**
 * Parse text and split it into segments of plain text and URLs
 */
export function parseTextWithLinks(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  // Reset regex state
  URL_REGEX.lastIndex = 0;

  let match;
  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        value: text.slice(lastIndex, match.index),
      });
    }

    // Add the URL
    segments.push({
      type: 'link',
      value: match[0],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last URL
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      value: text.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Check if a string contains any URLs
 */
export function containsUrl(text: string): boolean {
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}

/**
 * Extract all URLs from text
 */
export function extractUrls(text: string): string[] {
  URL_REGEX.lastIndex = 0;
  return text.match(URL_REGEX) || [];
}
