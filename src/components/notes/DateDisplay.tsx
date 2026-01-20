import { useTranslation } from 'react-i18next';

interface DateDisplayProps {
  date: Date;
}

export function DateDisplay({ date }: DateDisplayProps) {
  const { i18n } = useTranslation();

  const dayName = date.toLocaleDateString(i18n.language, { weekday: 'long' });
  const fullDate = date.toLocaleDateString(i18n.language, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="text-center mb-8">
      <h1 className="text-4xl font-bold capitalize">{dayName}</h1>
      <p className="text-xl text-muted-foreground mt-2">{fullDate}</p>
    </div>
  );
}
