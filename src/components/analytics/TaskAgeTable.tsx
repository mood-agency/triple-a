import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import type { TaskAgeGroup } from '@/types/analytics';

interface TaskAgeTableProps {
  data: TaskAgeGroup[];
}

export function TaskAgeTable({ data }: TaskAgeTableProps) {
  const { t } = useTranslation();

  const totalPending = data.reduce((sum, group) => sum + group.count, 0);

  if (totalPending === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('analytics.charts.taskAge')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            {t('analytics.noPendingTasks')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('analytics.charts.taskAge')}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('analytics.age')}</TableHead>
              <TableHead className="text-right">{t('analytics.metrics.tasks')}</TableHead>
              <TableHead className="w-[200px]">{t('analytics.distribution')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((group) => {
              const percentage = totalPending > 0 ? (group.count / totalPending) * 100 : 0;
              return (
                <TableRow key={group.label}>
                  <TableCell className="font-medium">{group.label}</TableCell>
                  <TableCell className="text-right">{group.count}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={percentage} className="h-2" />
                      <span className="text-xs text-muted-foreground w-12">
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
