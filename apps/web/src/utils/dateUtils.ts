/**
 * Parse a date string as a local date to avoid timezone issues
 * Handles both "yyyy-MM-dd" and ISO datetime formats
 * Preserves time information if present in the string
 * new Date("2025-02-15") creates UTC midnight, which is previous day in negative UTC offsets
 */
export function parseLocalDate(dateStr: string): Date {
  // Check if there's a time component
  const hasTime = dateStr.includes('T');
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    // Fallback to native parsing if format is unexpected
    return new Date(dateStr);
  }

  // Parse time if present
  if (hasTime) {
    // Check if it's a UTC/ISO timestamp (ends with Z or has timezone offset)
    const isUTC = dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr);
    if (isUTC) {
      // Parse as UTC and let JavaScript convert to local time
      return new Date(dateStr);
    }
    // No timezone info - treat as local time
    const timePart = dateStr.split('T')[1];
    const [hours = 0, minutes = 0, seconds = 0] = timePart.split(':').map(Number);
    return new Date(year, month - 1, day, hours || 0, minutes || 0, seconds || 0);
  }

  return new Date(year, month - 1, day);
}

/**
 * Format a Date object to a local date string in YYYY-MM-DD format
 * Avoids timezone issues that occur with toISOString() which converts to UTC
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get start of day (00:00:00.000) for a given date
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day (23:59:59.999) for a given date
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Extract the local date key (YYYY-MM-DD) from a deadline string
 * Properly handles UTC timestamps by converting to local time first
 * This fixes the timezone bug where a deadline like "2026-01-26T18:00" in UTC-6
 * would be stored as "2026-01-27T00:00:00Z" and incorrectly show on Jan 27
 */
export function getLocalDateKey(deadlineStr: string): string {
  const date = parseLocalDate(deadlineStr);
  return formatLocalDate(date);
}

/**
 * Check if a deadline string has a meaningful time component (not midnight)
 * Returns false for dates without time or dates at exactly 00:00:00
 */
export function hasTimeComponent(deadlineStr: string): boolean {
  const date = parseLocalDate(deadlineStr);
  return date.getHours() !== 0 || date.getMinutes() !== 0;
}

/**
 * Extract the hour (0-23) from a deadline string in local time
 */
export function getHourFromDeadline(deadlineStr: string): number {
  const date = parseLocalDate(deadlineStr);
  return date.getHours();
}

/**
 * Extract the minutes (0-59) from a deadline string in local time
 */
export function getMinutesFromDeadline(deadlineStr: string): number {
  const date = parseLocalDate(deadlineStr);
  return date.getMinutes();
}

/**
 * Format a date for display, showing relative dates like "today" or "tomorrow"
 * with the time included (e.g., "hoy 14:30:00", "mañana 09:15:00")
 * @param date - The date to format
 * @param language - The language code ('es' or 'en')
 * @param todayText - Translation for "today"
 * @param tomorrowText - Translation for "tomorrow"
 * @returns Formatted date string with time
 */
export function formatRelativeDateWithTime(
  date: Date,
  language: string,
  todayText: string,
  tomorrowText: string
): string {
  const today = new Date();
  const isToday = date.getDate() === today.getDate() &&
                  date.getMonth() === today.getMonth() &&
                  date.getFullYear() === today.getFullYear();

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = date.getDate() === tomorrow.getDate() &&
                     date.getMonth() === tomorrow.getMonth() &&
                     date.getFullYear() === tomorrow.getFullYear();

  // Format time as HH:mm:ss
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  if (isToday) return `${todayText} ${timeStr}`;
  if (isTomorrow) return `${tomorrowText} ${timeStr}`;

  // For other dates, show date + time
  const dateStr = date.toLocaleDateString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return `${dateStr} ${timeStr}`;
}
