import * as chrono from 'chrono-node';

/**
 * Parse natural language date string into a Date object
 * Examples: "tomorrow", "next friday", "in 3 days", "Aug 17"
 */
export function parseNaturalDate(
  text: string,
  referenceDate?: Date
): Date | null {
  if (!text.trim()) return null;
  return chrono.parseDate(text, referenceDate);
}

/**
 * Parse and get detailed result with start/end dates if available
 */
export function parseNaturalDateDetailed(
  text: string,
  referenceDate?: Date
): { start: Date | null; end: Date | null; text: string } | null {
  if (!text.trim()) return null;

  const results = chrono.parse(text, referenceDate);
  if (results.length === 0) return null;

  const result = results[0];
  return {
    start: result.start?.date() ?? null,
    end: result.end?.date() ?? null,
    text: result.text,
  };
}
