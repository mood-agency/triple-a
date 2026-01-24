import { Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type KPIVariant = 'default' | 'success' | 'warning' | 'danger';

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: KPIVariant;
  info?: string;
}

const variantStyles: Record<KPIVariant, string> = {
  default: 'text-foreground',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  danger: 'text-red-600 dark:text-red-400',
};

export function KPICard({ title, value, subtitle, variant = 'default', info }: KPICardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
          <span>{title}</span>
          {info && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{info}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-bold', variantStyles[variant])}>{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
