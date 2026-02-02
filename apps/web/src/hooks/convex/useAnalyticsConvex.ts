import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export type DateRange = "7d" | "30d" | "90d";

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
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  now.setDate(now.getDate() - days);
  return now;
}

function formatDateForDisplay(dateStr: string): string {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getDateOnly(isoString: string): string {
  return isoString.split("T")[0];
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Convex-based analytics hook
 */
export function useAnalyticsConvex(dateRange: DateRange = "7d"): AnalyticsData {
  const data = useQuery(api.notes.listAllForAnalytics);

  const analytics = useMemo(() => {
    const defaultKpis: KPIs = {
      completionRate: 0,
      onTimeRate: 0,
      overdueCount: 0,
      avgPostponements: 0,
      totalCompleted: 0,
      totalTasks: 0,
      completedWithDeadline: 0,
      postponedTasksCount: 0,
    };

    if (!data) {
      return {
        kpis: defaultKpis,
        trend: [],
        problems: { mostPostponed: [], overdue: [] },
      };
    }

    const { notes: allNotes, actions: allHistory } = data;
    const startDate = getStartDate(dateRange);
    const today = getTodayString();

    // Filter notes created after startDate for trend analysis
    const notes = allNotes.filter((n) => {
      const createdDate = new Date(n.createdAt);
      return createdDate >= startDate;
    });

    // 1. Completion rate
    const totalTasks = notes.length;
    const totalCompleted = notes.filter((n) => n.completed).length;
    const completionRate =
      totalTasks > 0 ? (totalCompleted / totalTasks) * 100 : 0;

    // 2. On-time rate - completed tasks with deadlines
    const completedWithDeadlineNotes = notes.filter(
      (n) => n.completed && n.deadline && n.completedAt
    );
    const onTimeNotes = completedWithDeadlineNotes.filter((n) => {
      const completedDate = new Date(n.completedAt!);
      const deadlineDate = new Date(n.deadline!);
      return completedDate <= deadlineDate;
    });
    const completedWithDeadline = completedWithDeadlineNotes.length;
    const onTimeRate =
      completedWithDeadline > 0
        ? (onTimeNotes.length / completedWithDeadline) * 100
        : 0;

    // 3. Overdue count - uncompleted tasks past deadline (exclude meetings)
    const overdueNotes = allNotes.filter((n) => {
      if (n.completed || !n.deadline || n.category === "meeting") return false;
      const deadlineDate = getDateOnly(n.deadline);
      return deadlineDate < today;
    });
    const overdueCount = overdueNotes.length;

    // 4. Average postponements per postponed task (within date range)
    const historyInRange = allHistory.filter((h) => {
      const changedDate = new Date(h.createdAt);
      return changedDate >= startDate;
    });

    const postponedNoteIds = new Set(historyInRange.map((h) => h.noteId));
    const postponedTasksCount = postponedNoteIds.size;
    const totalPostpones = historyInRange.length;
    const avgPostponements =
      postponedTasksCount > 0 ? totalPostpones / postponedTasksCount : 0;

    const kpis: KPIs = {
      completionRate,
      onTimeRate,
      overdueCount,
      avgPostponements,
      totalCompleted,
      totalTasks,
      completedWithDeadline,
      postponedTasksCount,
    };

    // 5. Trend data - created per day
    const createdByDay: Record<string, number> = {};
    notes.forEach((n) => {
      const day = getDateOnly(n.createdAt);
      createdByDay[day] = (createdByDay[day] || 0) + 1;
    });

    // 6. Trend data - completed per day
    const completedByDay: Record<string, number> = {};
    notes
      .filter((n) => n.completed && n.completedAt)
      .forEach((n) => {
        const day = getDateOnly(n.completedAt!);
        completedByDay[day] = (completedByDay[day] || 0) + 1;
      });

    // Merge trend data
    const allDays = new Set([
      ...Object.keys(createdByDay),
      ...Object.keys(completedByDay),
    ]);
    const trend: TrendDataPoint[] = Array.from(allDays)
      .sort()
      .map((day) => ({
        date: formatDateForDisplay(day),
        created: createdByDay[day] || 0,
        completed: completedByDay[day] || 0,
      }));

    // 7. Most postponed tasks (top 5) - active tasks with postpone history
    const postponeCountByNote: Record<string, number> = {};
    allHistory.forEach((h) => {
      postponeCountByNote[h.noteId] = (postponeCountByNote[h.noteId] || 0) + 1;
    });

    const notesMap = new Map(allNotes.map((n) => [n._id, n]));

    const mostPostponed: PostponedTask[] = Object.entries(postponeCountByNote)
      .filter(([noteId]) => {
        const note = notesMap.get(noteId as any);
        return note && !note.completed;
      })
      .map(([noteId, count]) => ({
        id: noteId,
        content: notesMap.get(noteId as any)?.content || "",
        postponeCount: count,
      }))
      .sort((a, b) => b.postponeCount - a.postponeCount)
      .slice(0, 5);

    // 8. Overdue tasks (top 5)
    const overdueTasks: OverdueTask[] = overdueNotes
      .map((n) => {
        const deadlineDate = new Date(n.deadline!);
        const todayDate = new Date(today);
        const daysOverdue = Math.floor(
          (todayDate.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: n._id,
          content: n.content,
          deadline: n.deadline!,
          daysOverdue,
        };
      })
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 5);

    return {
      kpis,
      trend,
      problems: {
        mostPostponed,
        overdue: overdueTasks,
      },
    };
  }, [data, dateRange]);

  return {
    ...analytics,
    loading: data === undefined,
  };
}
