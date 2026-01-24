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
