import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProductivityByDay } from '@/types/analytics';

interface ProductivityBarChartProps {
  data: ProductivityByDay[];
}

export function ProductivityBarChart({ data }: ProductivityBarChartProps) {
  const { t } = useTranslation();

  // Find the most productive day
  const maxCompleted = Math.max(...data.map((d) => d.completed));

  // Reorder to start from Monday (day 1) instead of Sunday (day 0)
  const reorderedData = [...data.slice(1), data[0]];

  const chartData = reorderedData.map((item) => ({
    ...item,
    shortName: item.dayName.slice(0, 3),
    isMax: item.completed === maxCompleted && maxCompleted > 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('analytics.charts.productivityByDay')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
              <XAxis
                dataKey="shortName"
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                className="text-muted-foreground"
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px',
                }}
                formatter={(value) => [
                  `${value} ${t('analytics.metrics.tasks')}`,
                  t('analytics.metrics.completed'),
                ]}
                labelFormatter={(label) => {
                  const item = chartData.find((d) => d.shortName === label);
                  return item?.dayName || label;
                }}
              />
              <Bar dataKey="completed" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.isMax ? 'hsl(142, 76%, 36%)' : 'hsl(var(--primary))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {maxCompleted > 0 && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            {t('analytics.mostProductiveDay')}: {' '}
            <span className="font-medium text-foreground">
              {data.find((d) => d.completed === maxCompleted)?.dayName}
            </span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
