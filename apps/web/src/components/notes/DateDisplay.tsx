import { useTranslation } from 'react-i18next';
import { formatRelativeDate } from '@/utils/dateUtils';

interface DateDisplayProps {
  date: Date;
}

export function DateDisplay({ date }: DateDisplayProps) {
  const { t, i18n } = useTranslation();

  const relativeDate = formatRelativeDate(date, i18n.language, {
    today: t('date.today'),
    tomorrow: t('date.tomorrow'),
    yesterday: t('date.yesterday'),
    inDays: t('date.inDays'),
    daysAgo: t('date.daysAgo'),
    inAWeek: t('date.inAWeek'),
    aWeekAgo: t('date.aWeekAgo'),
    inWeeks: t('date.inWeeks'),
    weeksAgo: t('date.weeksAgo'),
    nextWeek: t('date.nextWeek'),
    lastWeek: t('date.lastWeek'),
    thisWeekday: t('date.thisWeekday'),
    nextWeekday: t('date.nextWeekday'),
    lastWeekday: t('date.lastWeekday'),
    inAMonth: t('date.inAMonth'),
    aMonthAgo: t('date.aMonthAgo'),
    inMonths: t('date.inMonths'),
    monthsAgo: t('date.monthsAgo'),
    inAYear: t('date.inAYear'),
    aYearAgo: t('date.aYearAgo'),
    inYears: t('date.inYears'),
    yearsAgo: t('date.yearsAgo'),
  });

  const fullDate = date.toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="text-center mb-8">
      <h1 className="text-4xl font-bold capitalize">{relativeDate}</h1>
      <p className="text-xl text-muted-foreground mt-2">{fullDate}</p>
    </div>
  );
}
