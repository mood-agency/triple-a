/**
 * Shared helper functions for the API server
 */

/**
 * Decode HTML entities in a string
 * @param {string} text - Text with HTML entities
 * @returns {string} - Decoded text
 */
export function decodeHtmlEntities(text) {
  if (!text) return '';

  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&#x27;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#160;': ' ',
    '&#10;': '\n',
    '&#13;': '\r',
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'gi'), char);
  }

  // Handle numeric entities (decimal and hex)
  decoded = decoded.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)));
  decoded = decoded.replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  return decoded;
}

/**
 * Parse JSON from AI response content
 * Handles responses that may be wrapped in markdown code blocks
 * @param {string} content - Raw AI response content
 * @returns {object} - Parsed JSON object
 */
export function parseJsonResponse(content) {
  if (!content) {
    return { summary: '', keyPoints: [], topics: [] };
  }

  let jsonStr = content;

  // Remove markdown code block if present
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonStr.trim());
  } catch (error) {
    // If parsing fails, return the content as a summary
    return {
      summary: content,
      keyPoints: [],
      topics: [],
    };
  }
}

/**
 * Extract email address from a sender string
 * Handles formats like "Name <email@example.com>" or just "email@example.com"
 * @param {string} from - Email sender string
 * @returns {string|null} - Extracted email address or null
 */
export function extractEmail(from) {
  if (!from) return null;

  // Try to match email in angle brackets: "Name <email@example.com>"
  const bracketMatch = from.match(/<([^>]+@[^>]+)>/);
  if (bracketMatch) {
    return bracketMatch[1].toLowerCase().trim();
  }

  // Try to match a plain email address
  const emailMatch = from.match(/([^\s<>]+@[^\s<>]+\.[^\s<>]+)/);
  if (emailMatch) {
    return emailMatch[1].toLowerCase().trim();
  }

  return null;
}
