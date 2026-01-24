import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trash2, ClipboardList, Users, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { SyncStatus } from '@/components/sync/SyncStatus';
import { UserMenu } from '@/components/auth/UserMenu';
import { SettingsMenu } from '@/components/SettingsMenu';
import { AIStatusIndicator } from '@/components/ai/AIStatusIndicator';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onCreateTask?: () => void;
  onShowDeletedTasks?: () => void;
  children?: React.ReactNode;
}

export function Header({
  onCreateTask,
  onShowDeletedTasks,
  children,
}: HeaderProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  const isNotesActive = location.pathname === '/';
  const isContactsActive = location.pathname === '/contacts';
  const isAnalyticsActive = location.pathname === '/analytics';

  return (
    <div className="flex justify-between items-center mb-6 flex-shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold">Triple A</h1>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Link to="/">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded-md",
                isNotesActive && "bg-background shadow-sm"
              )}
            >
              <ClipboardList className="h-4 w-4" />
              <span>{t('notes')}</span>
            </Button>
          </Link>
          <Link to="/contacts">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded-md",
                isContactsActive && "bg-background shadow-sm"
              )}
            >
              <Users className="h-4 w-4" />
              <span>{t('contacts.title')}</span>
            </Button>
          </Link>
          <Link to="/analytics">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1.5 rounded-md",
                isAnalyticsActive && "bg-background shadow-sm"
              )}
            >
              <BarChart3 className="h-4 w-4" />
              <span>{t('analytics.title')}</span>
            </Button>
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {children}
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
        {onShowDeletedTasks && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onShowDeletedTasks} size="icon" variant="outline">
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('trash.title')}</p>
            </TooltipContent>
          </Tooltip>
        )}
        <AIStatusIndicator compact />
        <SyncStatus />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="secondary" size="sm" onClick={toggleLanguage}>
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
