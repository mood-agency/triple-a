import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
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
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TrendDataPoint {
  date: string;
  created: number;
  completed: number;
}

interface TrendChartProps {
  data: TrendDataPoint[];
}

export function TrendChart({ data }: TrendChartProps) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <span>{t('analytics.chart.title')}</span>
          <UITooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <p className="text-sm">{t('analytics.chart.info')}</p>
            </TooltipContent>
          </UITooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fill: 'hsl(var(--muted-foreground))' }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '6px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="created"
              name={t('analytics.chart.created')}
              stroke="hsl(var(--chart-1))"
              fillOpacity={1}
              fill="url(#colorCreated)"
            />
            <Area
              type="monotone"
              dataKey="completed"
              name={t('analytics.chart.completed')}
              stroke="hsl(var(--chart-2))"
              fillOpacity={1}
              fill="url(#colorCompleted)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
