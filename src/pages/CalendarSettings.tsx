import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { Link, useOutletContext } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { GoogleCalendarSettings } from '@/components/settings/GoogleCalendarSettings';

interface OutletContext {
  sidebarTrigger: React.ReactNode;
}

export function CalendarSettings() {
  const { t } = useTranslation();
  const { sidebarTrigger } = useOutletContext<OutletContext>();

  return (
    <div className="container max-w-2xl py-6 space-y-6">
      <div className="flex items-center gap-4">
        {sidebarTrigger}
        <Button variant="ghost" size="icon" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold">{t('gcal.settingsTitle')}</h1>
      </div>

      <GoogleCalendarSettings />
    </div>
  );
}
