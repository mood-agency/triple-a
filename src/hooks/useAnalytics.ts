import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTinyBase } from '@/contexts/TinyBaseContext';

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

function getStartDate(range: DateRange): Date {
  const now = new Date();
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now;
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getDateOnly(isoString: string): string {
  return isoString.split('T')[0];
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function useAnalytics(dateRange: DateRange = '7d'): AnalyticsData {
  const { store, isReady } = useTinyBase();
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
    if (!store || !isReady) return;

    setLoading(true);

    try {
      const notesTable = store.getTable('notes') || {};
      const historyTable = store.getTable('note_history') || {};
      const today = getTodayString();

      // Filter notes - exclude deleted, include only those created after startDate
      const notes = Object.entries(notesTable)
        .filter(([_, note]) => {
          const n = note as Record<string, unknown>;
          if (n.deleted_at) return false;
          const createdDate = new Date(n.created_at as string);
          return createdDate >= startDate;
        })
        .map(([id, note]) => {
          const n = note as Record<string, unknown>;
          return {
            id,
            content: n.content as string,
            completed: Boolean(n.completed),
            completed_at: n.completed_at as string | null,
            deadline: n.deadline as string | null,
            deleted_at: n.deleted_at as string | null,
            created_at: n.created_at as string,
          };
        });

      // 1. Completion rate
      const totalTasks = notes.length;
      const totalCompleted = notes.filter((n) => n.completed).length;
      const completionRate = totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

      // 2. On-time rate - completed tasks with deadlines
      const completedWithDeadlineNotes = notes.filter(
        (n) => n.completed && n.deadline && n.completed_at
      );
      const onTimeNotes = completedWithDeadlineNotes.filter((n) => {
        const completedDate = new Date(n.completed_at!);
        const deadlineDate = new Date(n.deadline!);
        return completedDate <= deadlineDate;
      });
      const completedWithDeadline = completedWithDeadlineNotes.length;
      const onTimeRate = completedWithDeadline > 0 ? (onTimeNotes.length / completedWithDeadline) * 100 : 0;

      // 3. Overdue count - uncompleted tasks past deadline (all tasks, not just in date range)
      // Meetings are excluded since they are scheduled events, not tasks with deadlines
      const allNotes = Object.entries(notesTable)
        .filter(([_, note]) => !(note as Record<string, unknown>).deleted_at)
        .map(([id, note]) => {
          const n = note as Record<string, unknown>;
          return {
            id,
            content: n.content as string,
            completed: Boolean(n.completed),
            deadline: n.deadline as string | null,
            category: n.category as string | null,
          };
        });

      const overdueNotes = allNotes.filter((n) => {
        if (n.completed || !n.deadline || n.category === 'meeting') return false;
        const deadlineDate = getDateOnly(n.deadline);
        return deadlineDate < today;
      });
      const overdueCount = overdueNotes.length;

      // 4. Average postponements per postponed task
      const historyEntries = Object.entries(historyTable)
        .filter(([_, h]) => {
          const history = h as Record<string, unknown>;
          if (history.action_type !== 'postponed') return false;
          const changedDate = new Date(history.changed_at as string);
          return changedDate >= startDate;
        })
        .map(([id, h]) => {
          const history = h as Record<string, unknown>;
          return {
            id,
            note_id: history.note_id as string,
          };
        });

      const postponedNoteIds = new Set(historyEntries.map((h) => h.note_id));
      const postponedTasksCount = postponedNoteIds.size;
      const totalPostpones = historyEntries.length;
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
      const createdByDay: Record<string, number> = {};
      notes.forEach((n) => {
        const day = getDateOnly(n.created_at);
        createdByDay[day] = (createdByDay[day] || 0) + 1;
      });

      // 6. Trend data - completed per day
      const completedByDay: Record<string, number> = {};
      notes
        .filter((n) => n.completed && n.completed_at)
        .forEach((n) => {
          const day = getDateOnly(n.completed_at!);
          completedByDay[day] = (completedByDay[day] || 0) + 1;
        });

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

      // 7. Most postponed tasks (top 5) - active tasks with postpone history
      const allHistory = Object.entries(historyTable)
        .filter(([_, h]) => (h as Record<string, unknown>).action_type === 'postponed')
        .map(([id, h]) => {
          const history = h as Record<string, unknown>;
          return {
            id,
            note_id: history.note_id as string,
          };
        });

      const postponeCountByNote: Record<string, number> = {};
      allHistory.forEach((h) => {
        postponeCountByNote[h.note_id] = (postponeCountByNote[h.note_id] || 0) + 1;
      });

      const mostPostponed: PostponedTask[] = Object.entries(postponeCountByNote)
        .filter(([noteId]) => {
          const note = notesTable[noteId] as Record<string, unknown> | undefined;
          return note && !note.deleted_at && !note.completed;
        })
        .map(([noteId, count]) => ({
          id: noteId,
          content: (notesTable[noteId] as Record<string, unknown>).content as string,
          postponeCount: count,
        }))
        .sort((a, b) => b.postponeCount - a.postponeCount)
        .slice(0, 5);

      // 8. Overdue tasks (top 5)
      const overdueTasks: OverdueTask[] = overdueNotes
        .map((n) => {
          const deadlineDate = new Date(n.deadline!);
          const todayDate = new Date(today);
          const daysOverdue = Math.floor((todayDate.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: n.id,
            content: n.content,
            deadline: n.deadline!,
            daysOverdue,
          };
        })
        .sort((a, b) => b.daysOverdue - a.daysOverdue)
        .slice(0, 5);

      setProblems({
        mostPostponed,
        overdue: overdueTasks,
      });
    } finally {
      setLoading(false);
    }
  }, [store, isReady, startDate]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Listen to store changes to refresh analytics (debounced to avoid blocking main thread)
  useEffect(() => {
    if (!store) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadAnalytics(), 300);
    };

    const notesListenerId = store.addTableListener('notes', debouncedLoad);
    const historyListenerId = store.addTableListener('note_history', debouncedLoad);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      store.delListener(notesListenerId);
      store.delListener(historyListenerId);
    };
  }, [store, loadAnalytics]);

  return {
    kpis,
    trend,
    problems,
    loading,
  };
}
