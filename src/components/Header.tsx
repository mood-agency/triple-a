import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { UserMenu } from '@/components/auth/UserMenu';
import { SettingsMenu } from '@/components/SettingsMenu';

interface HeaderProps {
  children?: React.ReactNode;
}

export function Header({
  children,
}: HeaderProps) {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="flex justify-end items-center mb-6 flex-shrink-0">
      <div className="flex items-center gap-2">
        {children}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={toggleLanguage}>
              {i18n.language.toUpperCase()}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('toggleLanguage')}</p>
          </TooltipContent>
        </Tooltip>
        <ThemeToggle />
        <SettingsMenu />
        <UserMenu />
      </div>
    </div>
  );
}
