import { useGoogleCalendarContext } from '@/contexts/GoogleCalendarContext';

export type { UseGoogleCalendarReturn } from '@/contexts/GoogleCalendarContext';

/**
 * Hook for managing Google Calendar integration
 * Re-exports from GoogleCalendarContext for backwards compatibility
 */
export function useGoogleCalendar() {
  return useGoogleCalendarContext();
}
