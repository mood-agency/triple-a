import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings, CheckCircle, MessageCircle, Users, BarChart3, Cloud, CloudOff, MoreVertical, Calendar, Save, Key } from 'lucide-react';
import { useSync } from '@/contexts/SyncContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSettings } from '@/hooks/useSettings';
import { APIKeysDialog } from '@/components/settings/APIKeysDialog';

export function SettingsMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, updateSettings } = useSettings();
  const { user } = useAuth();
  const { connectionStatus } = useSync();

  // Beeper token dialog state
  const [beeperDialogOpen, setBeeperDialogOpen] = useState(false);
  const [beeperTokenInput, setBeeperTokenInput] = useState('');

  // API Keys dialog state
  const [apiKeysDialogOpen, setApiKeysDialogOpen] = useState(false);

  const handleBeeperDialogOpen = () => {
    setBeeperTokenInput(settings.beeperToken || '');
    setBeeperDialogOpen(true);
  };

  const handleBeeperDialogClose = () => {
    setBeeperDialogOpen(false);
    setBeeperTokenInput('');
  };

  const handleBeeperTokenSave = () => {
    updateSettings({ beeperToken: beeperTokenInput || null });
    setBeeperDialogOpen(false);
  };

  // Connection status helpers
  const getConnectionIcon = () => {
    if (connectionStatus === 'offline') {
      return <CloudOff className="h-4 w-4 mr-2" />;
    }
    return <Cloud className="h-4 w-4 mr-2 text-green-500" />;
  };

  const getConnectionStatusText = () => {
    if (connectionStatus === 'offline') {
      return t('sync.offline');
    }
    return t('sync.online');
  };

  return (
    <>
      {/* Navigation menu (3 dots) */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('menu')}</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => navigate('/contacts')}>
            <Users className="h-4 w-4 mr-2" />
            {t('contacts.title')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/analytics')}>
            <BarChart3 className="h-4 w-4 mr-2" />
            {t('analytics.title')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings menu (gear icon) */}
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('settings')}</p>
          </TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          {user && (
            <>
              <div className="px-2 py-2">
                <div className="flex items-center justify-between text-sm">
                  {getConnectionIcon()}
                  <span className="text-muted-foreground">{getConnectionStatusText()}</span>
                </div>
              </div>
              <div className="px-2 py-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Save className="h-3.5 w-3.5 text-muted-foreground" />
                    <Label className="text-sm font-normal">
                      {t('settingsMenu.autoSave')}
                    </Label>
                  </div>
                  <Select
                    value={String(settings.autoSaveInterval)}
                    onValueChange={(value) => updateSettings({ autoSaveInterval: Number(value) })}
                  >
                    <SelectTrigger className="h-7 w-[70px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">{t('settingsMenu.autoSaveOff')}</SelectItem>
                      <SelectItem value="2">2s</SelectItem>
                      <SelectItem value="3">3s</SelectItem>
                      <SelectItem value="5">5s</SelectItem>
                      <SelectItem value="10">10s</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={handleBeeperDialogOpen}>
            <MessageCircle className="h-4 w-4 mr-2 text-green-600" />
            {t('settingsMenu.beeperConfig')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate('/settings/calendar')}>
            <Calendar className="h-4 w-4 mr-2 text-blue-600" />
            {t('gcal.title')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setApiKeysDialogOpen(true)}>
            <Key className="h-4 w-4 mr-2 text-amber-600" />
            {t('apiKeys.title')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={beeperDialogOpen} onOpenChange={handleBeeperDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-green-600" />
              {t('settingsMenu.beeperConfig')}
            </DialogTitle>
            <DialogDescription>
              {t('settingsMenu.beeperDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="beeper-token">{t('settingsMenu.beeperToken')}</Label>
              <Input
                id="beeper-token"
                type="password"
                value={beeperTokenInput}
                onChange={(e) => setBeeperTokenInput(e.target.value)}
                placeholder={t('settingsMenu.beeperTokenPlaceholder')}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('settingsMenu.beeperHelp')}
            </p>
            {settings.beeperToken && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <CheckCircle className="h-4 w-4" />
                {t('settingsMenu.beeperConfigured')}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleBeeperDialogClose}>
              {t('cancel')}
            </Button>
            <Button onClick={handleBeeperTokenSave} className="bg-green-600 hover:bg-green-700">
              {t('save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Keys dialog */}
      <APIKeysDialog
        open={apiKeysDialogOpen}
        onOpenChange={setApiKeysDialogOpen}
      />
    </>
  );
}
