import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';

export type DateRange = '7d' | '30d' | '90d';

interface KPIs {
  completionRate: number;
  onTimeRate: number;
  overdueCount: number;
  avgPostponements: number;
  totalCompleted: number;
  totalTasks: number;
  completedWithDeadline: number;
  postponedTasksCount: number;
}

interface TrendDataPoint {
  date: string;
  created: number;
  completed: number;
}

interface PostponedTask {
  id: string;
  content: string;
  postponeCount: number;
}

interface OverdueTask {
  id: string;
  content: string;
  daysOverdue: number;
  deadline: string;
}

interface Problems {
  mostPostponed: PostponedTask[];
  overdue: OverdueTask[];
}

export interface AnalyticsData {
  kpis: KPIs;
  trend: TrendDataPoint[];
  problems: Problems;
  loading: boolean;
}

function getStartDate(range: DateRange): string {
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now.toISOString();
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function useAnalytics(dateRange: DateRange = '7d'): AnalyticsData {
  const { db, isReady } = useDatabase();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs>({
    completionRate: 0,
    onTimeRate: 0,
    overdueCount: 0,
    avgPostponements: 0,
    totalCompleted: 0,
    totalTasks: 0,
    completedWithDeadline: 0,
    postponedTasksCount: 0,
  });
  const [trend, setTrend] = useState<TrendDataPoint[]>([]);
  const [problems, setProblems] = useState<Problems>({
    mostPostponed: [],
    overdue: [],
  });

  const startDate = useMemo(() => getStartDate(dateRange), [dateRange]);

  const loadAnalytics = useCallback(() => {
    if (!db || !isReady) return;

    setLoading(true);

    try {
      // 1. Completion rate - tasks created in date range
      const completionResult = db.exec(
        `SELECT
          COUNT(CASE WHEN completed = 1 THEN 1 END) as completed,
          COUNT(*) as total
        FROM notes
        WHERE deleted_at IS NULL AND created_at >= ?`,
        [startDate]
      );

      let totalCompleted = 0;
      let totalTasks = 0;
      if (completionResult.length > 0 && completionResult[0].values.length > 0) {
        totalCompleted = (completionResult[0].values[0][0] as number) || 0;
        totalTasks = (completionResult[0].values[0][1] as number) || 0;
      }
      const completionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

      // 2. On-time rate - completed tasks with deadlines
      const onTimeResult = db.exec(
        `SELECT
          COUNT(CASE WHEN datetime(completed_at) <= datetime(deadline) THEN 1 END) as on_time,
          COUNT(*) as with_deadline
        FROM notes
        WHERE deleted_at IS NULL
          AND completed = 1
          AND deadline IS NOT NULL
          AND completed_at >= ?`,
        [startDate]
      );

      let onTimeCount = 0;
      let completedWithDeadline = 0;
      if (onTimeResult.length > 0 && onTimeResult[0].values.length > 0) {
        onTimeCount = (onTimeResult[0].values[0][0] as number) || 0;
        completedWithDeadline = (onTimeResult[0].values[0][1] as number) || 0;
      }
      const onTimeRate = completedWithDeadline > 0 ? (onTimeCount / completedWithDeadline) * 100 : 0;

      // 3. Overdue count - uncompleted tasks past deadline
      const overdueResult = db.exec(
        `SELECT COUNT(*) as overdue_count
        FROM notes
        WHERE deleted_at IS NULL
          AND completed = 0
          AND deadline IS NOT NULL
          AND date(deadline) < date('now')`
      );

      let overdueCount = 0;
      if (overdueResult.length > 0 && overdueResult[0].values.length > 0) {
        overdueCount = (overdueResult[0].values[0][0] as number) || 0;
      }

      // 4. Average postponements per postponed task
      const postponeResult = db.exec(
        `SELECT
          COUNT(*) as total_postpones,
          COUNT(DISTINCT note_id) as postponed_tasks
        FROM note_history
        WHERE action_type = 'postponed' AND changed_at >= ?`,
        [startDate]
      );

      let totalPostpones = 0;
      let postponedTasksCount = 0;
      if (postponeResult.length > 0 && postponeResult[0].values.length > 0) {
        totalPostpones = (postponeResult[0].values[0][0] as number) || 0;
        postponedTasksCount = (postponeResult[0].values[0][1] as number) || 0;
      }
      const avgPostponements = postponedTasksCount > 0 ? totalPostpones / postponedTasksCount : 0;

      setKpis({
        completionRate,
        onTimeRate,
        overdueCount,
        avgPostponements,
        totalCompleted,
        totalTasks,
        completedWithDeadline,
        postponedTasksCount,
      });

      // 5. Trend data - created per day
      const createdTrendResult = db.exec(
        `SELECT date(created_at) as day, COUNT(*) as count
        FROM notes
        WHERE deleted_at IS NULL AND created_at >= ?
        GROUP BY date(created_at)
        ORDER BY day ASC`,
        [startDate]
      );

      const createdByDay: Record<string, number> = {};
      if (createdTrendResult.length > 0) {
        createdTrendResult[0].values.forEach((row) => {
          const day = row[0] as string;
          const count = row[1] as number;
          createdByDay[day] = count;
        });
      }

      // 6. Trend data - completed per day
      const completedTrendResult = db.exec(
        `SELECT date(completed_at) as day, COUNT(*) as count
        FROM notes
        WHERE deleted_at IS NULL AND completed = 1 AND completed_at >= ?
        GROUP BY date(completed_at)
        ORDER BY day ASC`,
        [startDate]
      );

      const completedByDay: Record<string, number> = {};
      if (completedTrendResult.length > 0) {
        completedTrendResult[0].values.forEach((row) => {
          const day = row[0] as string;
          const count = row[1] as number;
          completedByDay[day] = count;
        });
      }

      // Merge trend data
      const allDays = new Set([...Object.keys(createdByDay), ...Object.keys(completedByDay)]);
      const trendData: TrendDataPoint[] = Array.from(allDays)
        .sort()
        .map((day) => ({
          date: formatDateForDisplay(day),
          created: createdByDay[day] || 0,
          completed: completedByDay[day] || 0,
        }));

      setTrend(trendData);

      // 7. Most postponed tasks (top 5)
      const mostPostponedResult = db.exec(
        `SELECT
          n.id,
          n.content,
          COUNT(h.id) as postpone_count
        FROM notes n
        LEFT JOIN note_history h ON n.id = h.note_id AND h.action_type = 'postponed'
        WHERE n.deleted_at IS NULL AND n.completed = 0
        GROUP BY n.id
        HAVING postpone_count > 0
        ORDER BY postpone_count DESC
        LIMIT 5`
      );

      const mostPostponed: PostponedTask[] = [];
      if (mostPostponedResult.length > 0) {
        mostPostponedResult[0].values.forEach((row) => {
          mostPostponed.push({
            id: row[0] as string,
            content: row[1] as string,
            postponeCount: row[2] as number,
          });
        });
      }

      // 8. Overdue tasks (top 5)
      const overdueTasksResult = db.exec(
        `SELECT
          id,
          content,
          deadline,
          CAST(julianday('now') - julianday(deadline) AS INTEGER) as days_overdue
        FROM notes
        WHERE deleted_at IS NULL
          AND completed = 0
          AND deadline IS NOT NULL
          AND date(deadline) < date('now')
        ORDER BY days_overdue DESC
        LIMIT 5`
      );

      const overdueTasks: OverdueTask[] = [];
      if (overdueTasksResult.length > 0) {
        overdueTasksResult[0].values.forEach((row) => {
          overdueTasks.push({
            id: row[0] as string,
            content: row[1] as string,
            deadline: row[2] as string,
            daysOverdue: row[3] as number,
          });
        });
      }

      setProblems({
        mostPostponed,
        overdue: overdueTasks,
      });
    } finally {
      setLoading(false);
    }
  }, [db, isReady, startDate]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    kpis,
    trend,
    problems,
    loading,
  };
}
