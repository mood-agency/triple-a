import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export function Home() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6">
      <h1 className="text-4xl font-bold">{t('welcome')}</h1>
      <nav className="flex gap-4">
        <Button asChild>
          <Link to="/">{t('home')}</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/about">{t('about')}</Link>
        </Button>
      </nav>
      <Button variant="secondary" onClick={toggleLanguage}>
        {t('language')}: {i18n.language.toUpperCase()}
      </Button>
    </div>
  );
}
