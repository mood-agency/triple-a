import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Calendar, RefreshCw, Loader2, CheckCircle2, AlertCircle, Unlink, Plus, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CalendarSelector } from './CalendarSelector';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { toast } from 'sonner';

export function GoogleCalendarSettings() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const {
    isConnected,
    isLoading,
    error,
    accounts,
    calendars,
    loadingCalendars,
    config,
    syncStatus,
    lastSyncResult,
    connect,
    addAccount,
    removeAccount,
    disconnect,
    refreshCalendars,
    updateConfig,
    syncNow,
    handleOAuthCallback,
  } = useGoogleCalendar();

  // State for account removal confirmation
  const [accountToRemove, setAccountToRemove] = useState<{ id: string; email: string } | null>(null);

  // Ref to prevent double execution of OAuth callback (React Strict Mode)
  const oauthHandledRef = useRef(false);

  // Handle OAuth callback
  useEffect(() => {
    const code = searchParams.get('code');
    if (code && !oauthHandledRef.current) {
      oauthHandledRef.current = true;
      handleOAuthCallback(code).then(() => {
        // Remove code from URL
        navigate('/settings/calendar', { replace: true });
      });
    }
  }, [searchParams, handleOAuthCallback, navigate]);

  const handleToggleEnabled = async (enabled: boolean) => {
    await updateConfig({ enabled });
  };

  const handleCalendarsChange = async (calendarIds: string[]) => {
    await updateConfig({ calendars_to_sync: calendarIds });
  };

  const handleSyncNow = async () => {
    const result = await syncNow();

    if (result.success) {
      toast.success(t('gcal.syncSuccess', {
        imported: result.eventsImported,
        updated: result.eventsUpdated,
        deleted: result.eventsDeleted,
      }));
    } else {
      toast.error(t('gcal.syncError'), {
        description: result.errors.join(', '),
      });
    }
  };

  const formatLastSync = (timestamp: string | null) => {
    if (!timestamp) return t('gcal.neverSynced');
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const handleRemoveAccount = async () => {
    if (accountToRemove) {
      await removeAccount(accountToRemove.id);
      setAccountToRemove(null);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('gcal.title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            {t('gcal.title')}
          </CardTitle>
          <CardDescription>{t('gcal.connectDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}
          <Button onClick={connect} className="w-full sm:w-auto">
            <Calendar className="h-4 w-4 mr-2" />
            {t('gcal.connect')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Connected state
  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-green-600" />
                {t('gcal.title')}
                <Badge variant="outline" className="text-green-600 border-green-600">
                  {t('gcal.connected')}
                </Badge>
              </CardTitle>
              <CardDescription className="mt-1">
                {t('gcal.lastSync')}: {formatLastSync(config?.last_sync_at ?? null)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error.message}</AlertDescription>
            </Alert>
          )}

          {/* Sync status message */}
          {lastSyncResult && (
            <Alert variant={lastSyncResult.success ? 'default' : 'destructive'}>
              {lastSyncResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {lastSyncResult.success
                  ? t('gcal.syncSuccess', {
                    imported: lastSyncResult.eventsImported,
                    updated: lastSyncResult.eventsUpdated,
                    deleted: lastSyncResult.eventsDeleted,
                  })
                  : lastSyncResult.errors.join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {/* Connected accounts section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('gcal.accounts')}</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={addAccount}
              >
                <Plus className="h-4 w-4 mr-1" />
                {t('gcal.addAccount')}
              </Button>
            </div>
            {accounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('gcal.noAccounts')}</p>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{account.email}</p>
                        {account.display_name && (
                          <p className="text-xs text-muted-foreground">{account.display_name}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAccountToRemove({ id: account.id, email: account.email })}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Enable/Disable sync */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="gcal-enabled">{t('gcal.enableSync')}</Label>
              <p className="text-sm text-muted-foreground">{t('gcal.enableSyncDescription')}</p>
            </div>
            <Switch
              id="gcal-enabled"
              checked={config?.enabled ?? false}
              onCheckedChange={handleToggleEnabled}
            />
          </div>

          <Separator />

          {/* Calendars to sync */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('gcal.selectCalendars')}</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshCalendars}
                disabled={loadingCalendars}
              >
                <RefreshCw className={`h-4 w-4 ${loadingCalendars ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <CalendarSelector
              calendars={calendars}
              selectedIds={config?.calendars_to_sync ?? []}
              onChange={handleCalendarsChange}
              loading={loadingCalendars}
            />
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleSyncNow}
              disabled={syncStatus === 'syncing' || !config?.enabled || (config?.calendars_to_sync?.length ?? 0) === 0}
              className="flex-1"
            >
              {syncStatus === 'syncing' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              {t('gcal.syncNow')}
            </Button>
            <Button variant="outline" onClick={disconnect} className="flex-1">
              <Unlink className="h-4 w-4 mr-2" />
              {t('gcal.disconnect')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account removal confirmation dialog */}
      <AlertDialog open={!!accountToRemove} onOpenChange={() => setAccountToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('gcal.removeAccount')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('gcal.confirmRemoveAccount')}
              {accountToRemove && (
                <span className="block mt-2 font-medium">{accountToRemove.email}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
