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
 * Translations for relative date formatting
 */
export interface RelativeDateTranslations {
  today: string;
  tomorrow: string;
  yesterday: string;
  // Days
  inDays: string; // "in {{count}} days" or "en {{count}} días"
  daysAgo: string; // "{{count}} days ago" or "hace {{count}} días"
  // Weeks
  inAWeek: string;
  aWeekAgo: string;
  inWeeks: string; // "in {{count}} weeks"
  weeksAgo: string; // "{{count}} weeks ago"
  nextWeek: string;
  lastWeek: string;
  thisWeekday: string; // "this Monday" - {{weekday}} placeholder
  nextWeekday: string; // "next Monday" - {{weekday}} placeholder
  lastWeekday: string; // "last Monday" - {{weekday}} placeholder
  // Months
  inAMonth: string;
  aMonthAgo: string;
  inMonths: string; // "in {{count}} months"
  monthsAgo: string; // "{{count}} months ago"
  // Years
  inAYear: string;
  aYearAgo: string;
  inYears: string; // "in {{count}} years"
  yearsAgo: string; // "{{count}} years ago"
}

/**
 * Get the difference in calendar days between two dates (ignoring time)
 */
function getDaysDifference(date: Date, reference: Date): number {
  const d1 = startOfDay(date);
  const d2 = startOfDay(reference);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if two dates are the same calendar day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getDate() === date2.getDate() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getFullYear() === date2.getFullYear();
}

/**
 * Format a date as a relative date string (without time)
 * Supports: today, tomorrow, yesterday, this/next/last weekday, in X days, X days ago
 * @param date - The date to format
 * @param language - The language code ('es' or 'en')
 * @param translations - Translation strings for relative dates
 * @returns Formatted relative date string
 */
export function formatRelativeDate(
  date: Date,
  language: string,
  translations: RelativeDateTranslations
): string {
  const today = startOfDay(new Date());
  const targetDate = startOfDay(date);
  const daysDiff = getDaysDifference(targetDate, today);

  // Today
  if (daysDiff === 0) {
    return translations.today;
  }

  // Tomorrow
  if (daysDiff === 1) {
    return translations.tomorrow;
  }

  // Yesterday
  if (daysDiff === -1) {
    return translations.yesterday;
  }

  // Get weekday name
  const weekdayName = date.toLocaleDateString(language, { weekday: 'long' });
  const capitalizedWeekday = weekdayName.charAt(0).toUpperCase() + weekdayName.slice(1);

  // Within the next 7 days (2-7 days ahead)
  if (daysDiff >= 2 && daysDiff <= 7) {
    // Check if it's exactly a week
    if (daysDiff === 7) {
      return translations.inAWeek;
    }
    // This week vs next week
    const todayDayOfWeek = new Date().getDay();
    const targetDayOfWeek = date.getDay();

    // If target is in the same week (target weekday > today's weekday)
    if (targetDayOfWeek > todayDayOfWeek) {
      return translations.thisWeekday.replace('{{weekday}}', capitalizedWeekday);
    } else {
      return translations.nextWeekday.replace('{{weekday}}', capitalizedWeekday);
    }
  }

  // Within the past 7 days (-7 to -2 days)
  if (daysDiff >= -7 && daysDiff <= -2) {
    // Check if it's exactly a week ago
    if (daysDiff === -7) {
      return translations.aWeekAgo;
    }
    // This week vs last week
    const todayDayOfWeek = new Date().getDay();
    const targetDayOfWeek = date.getDay();

    // If target was earlier this week
    if (targetDayOfWeek < todayDayOfWeek) {
      return translations.thisWeekday.replace('{{weekday}}', capitalizedWeekday);
    } else {
      return translations.lastWeekday.replace('{{weekday}}', capitalizedWeekday);
    }
  }

  // 8-13 days ahead (next week)
  if (daysDiff > 7 && daysDiff <= 13) {
    return translations.nextWeek;
  }

  // 8-13 days ago - show days count for accuracy
  if (daysDiff < -7 && daysDiff >= -13) {
    return translations.daysAgo.replace('{{count}}', String(Math.abs(daysDiff)));
  }

  // Calculate weeks, months, years difference
  const absDaysDiff = Math.abs(daysDiff);
  const weeks = Math.floor(absDaysDiff / 7);
  const months = Math.floor(absDaysDiff / 30);
  const years = Math.floor(absDaysDiff / 365);

  // Future dates
  if (daysDiff > 0) {
    // Years (365+ days)
    if (years >= 1) {
      if (years === 1) {
        return translations.inAYear;
      }
      return translations.inYears.replace('{{count}}', String(years));
    }

    // Months (30-364 days)
    if (months >= 1) {
      if (months === 1) {
        return translations.inAMonth;
      }
      return translations.inMonths.replace('{{count}}', String(months));
    }

    // Weeks (14-29 days)
    if (weeks >= 2) {
      return translations.inWeeks.replace('{{count}}', String(weeks));
    }

    // Days (14+ days but less than 2 weeks - shouldn't happen but fallback)
    return translations.inDays.replace('{{count}}', String(daysDiff));
  }

  // Past dates
  if (daysDiff < 0) {
    // Years (365+ days ago)
    if (years >= 1) {
      if (years === 1) {
        return translations.aYearAgo;
      }
      return translations.yearsAgo.replace('{{count}}', String(years));
    }

    // Months (30-364 days ago)
    if (months >= 1) {
      if (months === 1) {
        return translations.aMonthAgo;
      }
      return translations.monthsAgo.replace('{{count}}', String(months));
    }

    // Weeks (14-29 days ago)
    if (weeks >= 2) {
      return translations.weeksAgo.replace('{{count}}', String(weeks));
    }

    // Days (14+ days ago but less than 2 weeks - shouldn't happen but fallback)
    return translations.daysAgo.replace('{{count}}', String(absDaysDiff));
  }

  // Fallback to formatted date
  return date.toLocaleDateString(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
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
  const isToday = isSameDay(date, today);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = isSameDay(date, tomorrow);

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

/**
 * Format a date for display with enhanced relative dates and optional time
 * Supports: today, tomorrow, yesterday, this/next/last weekday, in X days, X days ago
 * @param date - The date to format
 * @param language - The language code ('es' or 'en')
 * @param translations - Translation strings for relative dates
 * @param includeTime - Whether to include time in the output
 * @returns Formatted date string
 */
export function formatRelativeDateEnhanced(
  date: Date,
  language: string,
  translations: RelativeDateTranslations,
  includeTime: boolean = false
): string {
  const relativeStr = formatRelativeDate(date, language, translations);

  if (!includeTime) {
    return relativeStr;
  }

  // Calculate days difference to see if we should show time
  const today = startOfDay(new Date());
  const targetDate = startOfDay(date);
  const daysDiff = getDaysDifference(targetDate, today);

  // Don't show time if:
  // 1. It's too far away (more than 6 days)
  // 2. It's exactly midnight (00:00) which often means no time was set/all-day
  const isTooDistant = Math.abs(daysDiff) > 6;
  const isMidnight = date.getHours() === 0 && date.getMinutes() === 0;

  if (isTooDistant || isMidnight) {
    return relativeStr;
  }

  // Format time as HH:mm
  const timeStr = date.toLocaleTimeString(language, {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `${relativeStr} ${timeStr}`;
}
