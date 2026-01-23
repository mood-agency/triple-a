import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MetricsOverview,
  CompletionTrendChart,
  CategoryPieChart,
  ProductivityBarChart,
  PeriodSelector,
  TaskAgeTable,
} from '@/components/analytics';
import { useAnalytics } from '@/hooks/useAnalytics';
import type { AnalyticsPeriodType } from '@/types/analytics';

export function Analytics() {
  const { t } = useTranslation();
  const [periodType, setPeriodType] = useState<AnalyticsPeriodType>('30d');
  const { data, loading, period, reload } = useAnalytics(periodType);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              <h1 className="text-2xl font-bold">{t('analytics.title')}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PeriodSelector value={periodType} onChange={setPeriodType} />
            <Button variant="outline" size="icon" onClick={reload} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Period label */}
        <p className="text-sm text-muted-foreground mb-6">
          {t('analytics.showingDataFor')}: {period.label}
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !data ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            {t('analytics.noData')}
          </div>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">{t('analytics.tabs.overview')}</TabsTrigger>
              <TabsTrigger value="trends">{t('analytics.tabs.trends')}</TabsTrigger>
              <TabsTrigger value="categories">{t('analytics.tabs.categories')}</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <MetricsOverview metrics={data.metrics} />
              <div className="grid gap-6 lg:grid-cols-2">
                <CompletionTrendChart data={data.trendData} />
                <CategoryPieChart data={data.categoryBreakdown} />
              </div>
            </TabsContent>

            {/* Trends Tab */}
            <TabsContent value="trends" className="space-y-6">
              <CompletionTrendChart data={data.trendData} expanded />
              <div className="grid gap-6 lg:grid-cols-2">
                <ProductivityBarChart data={data.productivityByDay} />
                <TaskAgeTable data={data.taskAgeDistribution} />
              </div>
            </TabsContent>

            {/* Categories Tab */}
            <TabsContent value="categories" className="space-y-6">
              <div className="grid gap-6 lg:grid-cols-2">
                <CategoryPieChart data={data.categoryBreakdown} />
                <div className="space-y-4">
                  {data.categoryBreakdown.map((cat) => (
                    <div
                      key={cat.category}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{t(`categories.${cat.category}`)}</p>
                        <p className="text-sm text-muted-foreground">
                          {cat.completed} / {cat.count} {t('analytics.metrics.completed').toLowerCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{cat.completionRate.toFixed(0)}%</p>
                        <p className="text-xs text-muted-foreground">
                          {t('analytics.metrics.completionRate')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
