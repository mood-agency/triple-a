import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { UserMenu } from '@/components/auth/UserMenu';
import { SettingsMenu } from '@/components/SettingsMenu';

interface HeaderProps {
  onCreateTask?: () => void;
  children?: React.ReactNode;
}

export function Header({
  onCreateTask,
  children,
}: HeaderProps) {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="flex justify-between items-center mb-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Triple A</h1>
        {onCreateTask && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onCreateTask} size="icon" variant="outline">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('newTask')}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
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
