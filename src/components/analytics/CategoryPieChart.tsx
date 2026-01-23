import { useTranslation } from 'react-i18next';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { CategoryMetrics } from '@/types/analytics';
import type { NoteCategory } from '@/types/note';

interface CategoryPieChartProps {
  data: CategoryMetrics[];
}

const CATEGORY_COLORS: Record<NoteCategory, string> = {
  todo: 'hsl(221, 83%, 53%)',      // Blue
  followup: 'hsl(262, 83%, 58%)',  // Purple
  meeting: 'hsl(25, 95%, 53%)',    // Orange
  notes: 'hsl(142, 76%, 36%)',     // Green
};

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const { t } = useTranslation();

  const chartData = data
    .filter((item) => item.count > 0)
    .map((item) => ({
      name: t(`categories.${item.category}`),
      value: item.count,
      completed: item.completed,
      completionRate: item.completionRate,
      category: item.category,
    }));

  const totalTasks = data.reduce((sum, item) => sum + item.count, 0);

  if (totalTasks === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('analytics.charts.categoryBreakdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            {t('analytics.noData')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('analytics.charts.categoryBreakdown')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.category}
                    fill={CATEGORY_COLORS[entry.category]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                formatter={(value, _name, props) => {
                  const item = props.payload;
                  return [
                    `${value} ${t('analytics.metrics.tasks')} (${item.completionRate.toFixed(0)}% ${t('analytics.metrics.completed').toLowerCase()})`,
                    item.name,
                  ];
                }}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
