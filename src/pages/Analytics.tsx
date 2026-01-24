import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useAnalytics, type DateRange } from '@/hooks/useAnalytics';
import { Header } from '@/components/Header';
import { KPICard } from '@/components/analytics/KPICard';
import { TrendChart } from '@/components/analytics/TrendChart';
import { ProblemsPanel } from '@/components/analytics/ProblemsPanel';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type KPIVariant = 'default' | 'success' | 'warning' | 'danger';

function getCompletionRateVariant(rate: number): KPIVariant {
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'warning';
  return 'danger';
}

function getOnTimeRateVariant(rate: number): KPIVariant {
  if (rate >= 80) return 'success';
  if (rate >= 50) return 'warning';
  return 'danger';
}

function getOverdueVariant(count: number): KPIVariant {
  if (count === 0) return 'success';
  if (count <= 3) return 'warning';
  return 'danger';
}

function getPostponementVariant(avg: number): KPIVariant {
  if (avg <= 1) return 'success';
  if (avg <= 2) return 'warning';
  return 'danger';
}

export function Analytics() {
  const { t } = useTranslation();
  const { isReady } = useDatabase();
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const { kpis, trend, problems, loading } = useAnalytics(dateRange);

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col py-8 px-4">
      <div className="w-full px-4 flex flex-col flex-1 min-h-0">
        <Header />

        <main className="flex-1 overflow-auto min-h-0">
          <div className="mx-auto max-w-6xl space-y-6 pb-8">
            {/* Header with title and date range selector */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
              <Select value={dateRange} onValueChange={(value) => setDateRange(value as DateRange)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t('analytics.dateRange')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">{t('analytics.last7Days')}</SelectItem>
                  <SelectItem value="30d">{t('analytics.last30Days')}</SelectItem>
                  <SelectItem value="90d">{t('analytics.last90Days')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-muted-foreground">{t('common.loading')}</div>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <KPICard
                    title={t('analytics.kpi.completionRate')}
                    value={`${kpis.completionRate.toFixed(0)}%`}
                    subtitle={t('analytics.tasksCompleted', {
                      completed: kpis.totalCompleted,
                      total: kpis.totalTasks,
                    })}
                    variant={getCompletionRateVariant(kpis.completionRate)}
                    info={t('analytics.kpi.completionRateInfo')}
                  />
                  <KPICard
                    title={t('analytics.kpi.onTimeRate')}
                    value={`${kpis.onTimeRate.toFixed(0)}%`}
                    subtitle={t('analytics.ofTasksWithDeadline', {
                      count: kpis.completedWithDeadline,
                    })}
                    variant={getOnTimeRateVariant(kpis.onTimeRate)}
                    info={t('analytics.kpi.onTimeRateInfo')}
                  />
                  <KPICard
                    title={t('analytics.kpi.overdueCount')}
                    value={kpis.overdueCount}
                    subtitle={t('analytics.tasksPastDeadline')}
                    variant={getOverdueVariant(kpis.overdueCount)}
                    info={t('analytics.kpi.overdueCountInfo')}
                  />
                  <KPICard
                    title={t('analytics.kpi.avgPostponements')}
                    value={kpis.avgPostponements.toFixed(1)}
                    subtitle={t('analytics.perPostponedTask', {
                      count: kpis.postponedTasksCount,
                    })}
                    variant={getPostponementVariant(kpis.avgPostponements)}
                    info={t('analytics.kpi.avgPostponementsInfo')}
                  />
                </div>

                {/* Trend Chart */}
                <TrendChart data={trend} />

                {/* Problems Panel */}
                <ProblemsPanel mostPostponed={problems.mostPostponed} overdue={problems.overdue} />
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
