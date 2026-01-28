import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, AlertTriangle, Info } from 'lucide-react';

interface PostponedTask {
  id: string;
  content: string;
  postponeCount: number;
}

interface OverdueTask {
  id: string;
  content: string;
  daysOverdue: number;
}

interface ProblemsPanelProps {
  mostPostponed: PostponedTask[];
  overdue: OverdueTask[];
}

export function ProblemsPanel({ mostPostponed, overdue }: ProblemsPanelProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleTaskClick = (taskId: string) => {
    navigate(`/?note=${taskId}`);
  };

  const hasProblems = mostPostponed.length > 0 || overdue.length > 0;

  if (!hasProblems) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('analytics.problems.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t('analytics.problems.noProblems')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Most Postponed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t('analytics.problems.mostPostponed')}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{t('analytics.problems.mostPostponedInfo')}</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mostPostponed.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('analytics.problems.noProblems')}</p>
          ) : (
            <ul className="space-y-2">
              {mostPostponed.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => handleTaskClick(task.id)}
                >
                  <span className="text-sm truncate flex-1">{task.content}</span>
                  <Badge variant="secondary">
                    {t('analytics.problems.postponedTimes', { count: task.postponeCount })}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Overdue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              {t('analytics.problems.overdue')}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{t('analytics.problems.overdueInfo')}</p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {overdue.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t('analytics.problems.noProblems')}</p>
          ) : (
            <ul className="space-y-2">
              {overdue.map((task) => (
                <li
                  key={task.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-md hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => handleTaskClick(task.id)}
                >
                  <span className="text-sm truncate flex-1">{task.content}</span>
                  <Badge variant="destructive">
                    {t('analytics.problems.daysOverdue', { count: task.daysOverdue })}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
