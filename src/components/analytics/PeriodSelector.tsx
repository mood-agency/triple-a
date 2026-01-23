import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AnalyticsPeriodType } from '@/types/analytics';

interface PeriodSelectorProps {
  value: AnalyticsPeriodType;
  onChange: (value: AnalyticsPeriodType) => void;
}

const PERIODS: AnalyticsPeriodType[] = ['7d', '30d', '90d', 'year', 'all'];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  const { t } = useTranslation();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder={t('analytics.selectPeriod')} />
      </SelectTrigger>
      <SelectContent>
        {PERIODS.map((period) => (
          <SelectItem key={period} value={period}>
            {t(`analytics.period.${period}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
