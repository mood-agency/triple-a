import type { NoteCategory } from './note';

export type AnalyticsPeriodType = '7d' | '30d' | '90d' | 'year' | 'all';

export interface AnalyticsPeriod {
  type: AnalyticsPeriodType;
  start: Date;
  end: Date;
  label: string;
}

export interface TaskMetrics {
  totalCreated: number;
  totalCompleted: number;
  completionRate: number;
  averageCompletionTimeHours: number | null;
  overdueCount: number;
  pendingCount: number;
}

export interface CategoryMetrics {
  category: NoteCategory;
  count: number;
  completed: number;
  completionRate: number;
}

export interface TrendDataPoint {
  date: string;
  created: number;
  completed: number;
}

export interface PostponementMetrics {
  totalPostponed: number;
  avgPostponementsPerTask: number;
  tasksWithMultiplePostponements: number;
}

export interface ProductivityByDay {
  day: number; // 0-6 (Sunday-Saturday)
  dayName: string;
  completed: number;
}

export interface TaskAgeGroup {
  label: string;
  count: number;
  minDays: number;
  maxDays: number | null;
}

export interface AnalyticsData {
  metrics: TaskMetrics;
  categoryBreakdown: CategoryMetrics[];
  trendData: TrendDataPoint[];
  postponementMetrics: PostponementMetrics;
  productivityByDay: ProductivityByDay[];
  taskAgeDistribution: TaskAgeGroup[];
}
