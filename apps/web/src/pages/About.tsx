import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function About() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="text-4xl font-bold">{t('about')}</h1>
      <Button asChild>
        <Link to="/">{t('home')}</Link>
      </Button>
    </div>
  );
}
