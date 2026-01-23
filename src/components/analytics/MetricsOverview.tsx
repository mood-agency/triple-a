import { useTranslation } from 'react-i18next';
import { ListTodo, CheckCircle2, Percent, AlertTriangle } from 'lucide-react';
import { MetricCard } from './MetricCard';
import type { TaskMetrics } from '@/types/analytics';

interface MetricsOverviewProps {
  metrics: TaskMetrics;
}

export function MetricsOverview({ metrics }: MetricsOverviewProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title={t('analytics.metrics.created')}
        value={metrics.totalCreated}
        icon={ListTodo}
        subtitle={t('analytics.metrics.tasks')}
      />
      <MetricCard
        title={t('analytics.metrics.completed')}
        value={metrics.totalCompleted}
        icon={CheckCircle2}
        subtitle={`${metrics.pendingCount} ${t('analytics.metrics.pending')}`}
      />
      <MetricCard
        title={t('analytics.metrics.completionRate')}
        value={`${metrics.completionRate.toFixed(1)}%`}
        icon={Percent}
      />
      <MetricCard
        title={t('analytics.metrics.overdue')}
        value={metrics.overdueCount}
        icon={AlertTriangle}
        className={metrics.overdueCount > 0 ? 'border-red-200 dark:border-red-900' : ''}
      />
    </div>
  );
}
