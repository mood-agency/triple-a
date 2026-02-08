import { useTranslation } from 'react-i18next';
import { formatRelativeDate, getDateTranslations } from '@/utils/dateUtils';

interface DateDisplayProps {
  date: Date;
}

export function DateDisplay({ date }: DateDisplayProps) {
  const { t, i18n } = useTranslation();

  const relativeDate = formatRelativeDate(date, i18n.language, getDateTranslations(t));

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
