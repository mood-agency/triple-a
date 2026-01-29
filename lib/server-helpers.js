/**
 * Pure helper functions used by the server
 * Extracted for testability
 */

/**
 * Decode HTML entities in transcript text
 */
export function decodeHtmlEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
}

/**
 * Parse JSON from AI response (handles markdown code blocks)
 */
export function parseJsonResponse(content) {
  try {
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : content.trim();
    return JSON.parse(jsonStr);
  } catch {
    return {
      summary: content,
      keyPoints: [],
      topics: [],
    };
  }
}

/**
 * Extract email address from 'from' field
 */
export function extractEmail(from) {
  if (!from) return null;

  const bracketMatch = from.match(/<([^>]+@[^>]+)>/);
  if (bracketMatch) {
    return bracketMatch[1].toLowerCase().trim();
  }

  const emailMatch = from.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  if (emailMatch) {
    return from.toLowerCase().trim();
  }

  return null;
}
