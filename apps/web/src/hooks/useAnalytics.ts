import {
  useAnalyticsConvex,
  type DateRange,
  type AnalyticsData,
} from "./convex/useAnalyticsConvex";

// Re-export types
export type { DateRange, AnalyticsData };

/**
 * Hook for analytics data
 * Now uses Convex for real-time data
 */
export function useAnalytics(dateRange: DateRange = "7d"): AnalyticsData {
  return useAnalyticsConvex(dateRange);
}
