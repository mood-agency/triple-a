/**
 * Parse a date string as a local date to avoid timezone issues
 * Handles both "yyyy-MM-dd" and ISO datetime formats
 * new Date("2025-02-15") creates UTC midnight, which is previous day in negative UTC offsets
 */
export function parseLocalDate(dateStr: string): Date {
  // Handle ISO datetime format (e.g., "2025-02-15T00:00:00.000Z")
  const datePart = dateStr.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    // Fallback to native parsing if format is unexpected
    return new Date(dateStr);
  }
  return new Date(year, month - 1, day);
}
