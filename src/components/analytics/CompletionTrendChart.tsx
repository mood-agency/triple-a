import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import type { TrendDataPoint } from '@/types/analytics';

interface CompletionTrendChartProps {
  data: TrendDataPoint[];
  expanded?: boolean;
}

export function CompletionTrendChart({ data, expanded = false }: CompletionTrendChartProps) {
  const { t } = useTranslation();

  // Aggregate data if too many points (for non-expanded view)
  const displayData = !expanded && data.length > 30
    ? aggregateWeekly(data)
    : data;

  const formatXAxis = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'MMM d');
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className={expanded ? 'col-span-full' : ''}>
      <CardHeader>
        <CardTitle className="text-base">{t('analytics.charts.completionTrend')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={expanded ? 'h-[400px]' : 'h-[300px]'}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatXAxis}
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
                labelFormatter={(label) => {
                  try {
                    return format(parseISO(label as string), 'PPP');
                  } catch {
                    return label;
                  }
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="created"
                name={t('analytics.metrics.created')}
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorCreated)"
              />
              <Area
                type="monotone"
                dataKey="completed"
                name={t('analytics.metrics.completed')}
                stroke="hsl(142, 76%, 36%)"
                fillOpacity={1}
                fill="url(#colorCompleted)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function aggregateWeekly(data: TrendDataPoint[]): TrendDataPoint[] {
  const weeks: TrendDataPoint[] = [];
  let weekData = { date: '', created: 0, completed: 0 };

  data.forEach((point, index) => {
    if (index % 7 === 0 && index > 0) {
      weeks.push({ ...weekData });
      weekData = { date: point.date, created: 0, completed: 0 };
    }
    if (index % 7 === 0) {
      weekData.date = point.date;
    }
    weekData.created += point.created;
    weekData.completed += point.completed;
  });

  if (weekData.date) {
    weeks.push(weekData);
  }

  return weeks;
}
