import { useState, useCallback, useEffect, useMemo } from 'react';
import { useDatabase } from '@/contexts/DatabaseContext';
import {
  startOfDay,
  endOfDay,
  subDays,
  startOfYear,
  differenceInHours,
  differenceInDays,
  format,
  parseISO,
  isAfter,
  isBefore,
  eachDayOfInterval,
} from 'date-fns';
import type {
  AnalyticsPeriod,
  AnalyticsPeriodType,
  TaskMetrics,
  CategoryMetrics,
  TrendDataPoint,
  PostponementMetrics,
  ProductivityByDay,
  TaskAgeGroup,
  AnalyticsData,
} from '@/types/analytics';
import type { NoteCategory } from '@/types/note';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getPeriodDates(periodType: AnalyticsPeriodType): AnalyticsPeriod {
  const now = new Date();
  const end = endOfDay(now);

  switch (periodType) {
    case '7d':
      return {
        type: periodType,
        start: startOfDay(subDays(now, 6)),
        end,
        label: 'Last 7 days',
      };
    case '30d':
      return {
        type: periodType,
        start: startOfDay(subDays(now, 29)),
        end,
        label: 'Last 30 days',
      };
    case '90d':
      return {
        type: periodType,
        start: startOfDay(subDays(now, 89)),
        end,
        label: 'Last 90 days',
      };
    case 'year':
      return {
        type: periodType,
        start: startOfYear(now),
        end,
        label: 'This year',
      };
    case 'all':
    default:
      return {
        type: 'all',
        start: new Date(2000, 0, 1),
        end,
        label: 'All time',
      };
  }
}

export function useAnalytics(periodType: AnalyticsPeriodType = '30d') {
  const { db, isReady } = useDatabase();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);

  const period = useMemo(() => getPeriodDates(periodType), [periodType]);

  const loadAnalytics = useCallback(() => {
    if (!db || !isReady) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const startStr = period.start.toISOString();
      const endStr = period.end.toISOString();
      const now = new Date();

      // Get all notes in period (excluding deleted)
      const notesResult = db.exec(
        `SELECT id, content, category, completed, completed_at, deadline, created_at, pinned
         FROM notes
         WHERE deleted_at IS NULL
         AND created_at >= ? AND created_at <= ?`,
        [startStr, endStr]
      );

      const notes = notesResult.length > 0
        ? notesResult[0].values.map((row) => ({
            id: row[0] as string,
            content: row[1] as string,
            category: row[2] as NoteCategory,
            completed: Boolean(row[3]),
            completed_at: row[4] as string | null,
            deadline: row[5] as string | null,
            created_at: row[6] as string,
            pinned: Boolean(row[7]),
          }))
        : [];

      // Calculate basic metrics
      const totalCreated = notes.length;
      const completedNotes = notes.filter((n) => n.completed);
      const totalCompleted = completedNotes.length;
      const completionRate = totalCreated > 0 ? (totalCompleted / totalCreated) * 100 : 0;

      // Average completion time
      let averageCompletionTimeHours: number | null = null;
      const completionTimes = completedNotes
        .filter((n) => n.completed_at)
        .map((n) => differenceInHours(parseISO(n.completed_at!), parseISO(n.created_at)));

      if (completionTimes.length > 0) {
        averageCompletionTimeHours = completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length;
      }

      // Overdue and pending
      const overdueCount = notes.filter(
        (n) => !n.completed && n.deadline && isAfter(now, parseISO(n.deadline))
      ).length;
      const pendingCount = notes.filter((n) => !n.completed).length;

      const metrics: TaskMetrics = {
        totalCreated,
        totalCompleted,
        completionRate,
        averageCompletionTimeHours,
        overdueCount,
        pendingCount,
      };

      // Category breakdown
      const categories: NoteCategory[] = ['todo', 'followup', 'notes', 'meeting'];
      const categoryBreakdown: CategoryMetrics[] = categories.map((category) => {
        const categoryNotes = notes.filter((n) => n.category === category);
        const categoryCompleted = categoryNotes.filter((n) => n.completed).length;
        return {
          category,
          count: categoryNotes.length,
          completed: categoryCompleted,
          completionRate: categoryNotes.length > 0 ? (categoryCompleted / categoryNotes.length) * 100 : 0,
        };
      });

      // Trend data - daily created vs completed
      const days = eachDayOfInterval({ start: period.start, end: period.end });
      const trendData: TrendDataPoint[] = days.map((day) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);

        const createdOnDay = notes.filter((n) => {
          const created = parseISO(n.created_at);
          return !isBefore(created, dayStart) && !isAfter(created, dayEnd);
        }).length;

        const completedOnDay = notes.filter((n) => {
          if (!n.completed_at) return false;
          const completed = parseISO(n.completed_at);
          return !isBefore(completed, dayStart) && !isAfter(completed, dayEnd);
        }).length;

        return {
          date: dayStr,
          created: createdOnDay,
          completed: completedOnDay,
        };
      });

      // Postponement metrics from history
      const historyResult = db.exec(
        `SELECT note_id, action_type FROM note_history
         WHERE action_type = 'postponed'
         AND changed_at >= ? AND changed_at <= ?`,
        [startStr, endStr]
      );

      const postponements = historyResult.length > 0 ? historyResult[0].values : [];
      const postponementsByNote = new Map<string, number>();
      postponements.forEach((row) => {
        const noteId = row[0] as string;
        postponementsByNote.set(noteId, (postponementsByNote.get(noteId) || 0) + 1);
      });

      const totalPostponed = postponements.length;
      const tasksWithPostponements = postponementsByNote.size;
      const avgPostponementsPerTask = tasksWithPostponements > 0
        ? totalPostponed / tasksWithPostponements
        : 0;
      const tasksWithMultiplePostponements = Array.from(postponementsByNote.values())
        .filter((count) => count > 1).length;

      const postponementMetrics: PostponementMetrics = {
        totalPostponed,
        avgPostponementsPerTask,
        tasksWithMultiplePostponements,
      };

      // Productivity by day of week
      const productivityByDay: ProductivityByDay[] = Array.from({ length: 7 }, (_, i) => ({
        day: i,
        dayName: DAY_NAMES[i],
        completed: 0,
      }));

      completedNotes.forEach((n) => {
        if (n.completed_at) {
          const dayOfWeek = parseISO(n.completed_at).getDay();
          productivityByDay[dayOfWeek].completed++;
        }
      });

      // Task age distribution (for pending tasks)
      const pendingNotes = notes.filter((n) => !n.completed);
      const ageGroups: TaskAgeGroup[] = [
        { label: '< 1 day', minDays: 0, maxDays: 1, count: 0 },
        { label: '1-3 days', minDays: 1, maxDays: 3, count: 0 },
        { label: '3-7 days', minDays: 3, maxDays: 7, count: 0 },
        { label: '1-2 weeks', minDays: 7, maxDays: 14, count: 0 },
        { label: '2-4 weeks', minDays: 14, maxDays: 28, count: 0 },
        { label: '> 1 month', minDays: 28, maxDays: null, count: 0 },
      ];

      pendingNotes.forEach((n) => {
        const age = differenceInDays(now, parseISO(n.created_at));
        for (const group of ageGroups) {
          if (age >= group.minDays && (group.maxDays === null || age < group.maxDays)) {
            group.count++;
            break;
          }
        }
      });

      setData({
        metrics,
        categoryBreakdown,
        trendData,
        postponementMetrics,
        productivityByDay,
        taskAgeDistribution: ageGroups,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [db, isReady, period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  return {
    data,
    loading,
    period,
    reload: loadAnalytics,
  };
}
