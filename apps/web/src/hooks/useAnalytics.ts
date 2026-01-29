import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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
  const { user } = useAuth();
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

  const loadAnalytics = useCallback(async () => {
    if (!supabase || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const today = getTodayString();

      // Fetch all notes (non-deleted) for the user
      const { data: allNotesData, error: notesError } = await supabase
        .from('notes')
        .select('id, content, completed, completed_at, deadline, deleted_at, created_at, category')
        .eq('user_id', user.id)
        .is('deleted_at', null);

      if (notesError) {
        console.error('[useAnalytics] Error fetching notes:', notesError);
        setLoading(false);
        return;
      }

      // Fetch note_history for postponed actions (table not in generated types)
      const { data: historyData, error: historyError } = await (supabase as any)
        .from('note_history')
        .select('id, note_id, changed_at, action_type')
        .eq('action_type', 'postponed');

      if (historyError) {
        console.error('[useAnalytics] Error fetching history:', historyError);
        setLoading(false);
        return;
      }

      const allNotes = allNotesData || [];
      const allHistory: Array<{ id: string; note_id: string; changed_at: string; action_type: string }> = historyData || [];

      // Filter notes created after startDate for trend analysis
      const notes = allNotes.filter((n) => {
        const createdDate = new Date(n.created_at);
        return createdDate >= startDate;
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

      // 3. Overdue count - uncompleted tasks past deadline (exclude meetings)
      const overdueNotes = allNotes.filter((n) => {
        if (n.completed || !n.deadline || n.category === 'meeting') return false;
        const deadlineDate = getDateOnly(n.deadline);
        return deadlineDate < today;
      });
      const overdueCount = overdueNotes.length;

      // 4. Average postponements per postponed task (within date range)
      const historyInRange = allHistory.filter((h) => {
        const changedDate = new Date(h.changed_at);
        return changedDate >= startDate;
      });

      const postponedNoteIds = new Set(historyInRange.map((h) => h.note_id));
      const postponedTasksCount = postponedNoteIds.size;
      const totalPostpones = historyInRange.length;
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
      const postponeCountByNote: Record<string, number> = {};
      allHistory.forEach((h) => {
        postponeCountByNote[h.note_id] = (postponeCountByNote[h.note_id] || 0) + 1;
      });

      const notesMap = new Map(allNotes.map((n) => [n.id, n]));

      const mostPostponed: PostponedTask[] = Object.entries(postponeCountByNote)
        .filter(([noteId]) => {
          const note = notesMap.get(noteId);
          return note && !note.completed;
        })
        .map(([noteId, count]) => ({
          id: noteId,
          content: notesMap.get(noteId)?.content || '',
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
    } catch (err) {
      console.error('[useAnalytics] Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, startDate]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Realtime subscriptions for notes and note_history
  useEffect(() => {
    if (!supabase || !user) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => loadAnalytics(), 300);
    };

    const notesChannel = supabase
      .channel('analytics-notes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notes',
          filter: `user_id=eq.${user.id}`,
        },
        debouncedLoad
      )
      .subscribe();

    const historyChannel = supabase
      .channel('analytics-history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'note_history',
        },
        debouncedLoad
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (supabase) {
        supabase.removeChannel(notesChannel);
        supabase.removeChannel(historyChannel);
      }
    };
  }, [user, loadAnalytics]);

  return {
    kpis,
    trend,
    problems,
    loading,
  };
}
