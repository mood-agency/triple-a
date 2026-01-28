import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Settings, Download, Upload, AlertCircle, CheckCircle, MessageCircle, Users, BarChart3, Cloud, CloudOff, RefreshCw, Check, CloudUpload, CloudDownload, Loader2, MoreVertical, Calendar, Save, Key } from 'lucide-react';
import { useSync } from '@/contexts/SyncContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
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
import { toast } from 'sonner';
import {
  exportAllData,
  downloadExportFile,
  importData,
  readFileAsJson,
  validateImportData,
} from '@/utils/dataExport';
import type { ImportResult } from '@/types/note';
import { APIKeysDialog } from '@/components/settings/APIKeysDialog';

export function SettingsMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { store } = useTinyBase();
  const { settings, updateSettings } = useSettings();
  const { user } = useAuth();
  const { connectionStatus, syncState, lastSyncedAt, pendingCount, error: syncError, syncNow, pushAllToSupabase, pullAllFromSupabase, isPushingAll, isPullingAll } = useSync();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Beeper token dialog state
  const [beeperDialogOpen, setBeeperDialogOpen] = useState(false);
  const [beeperTokenInput, setBeeperTokenInput] = useState('');

  // API Keys dialog state
  const [apiKeysDialogOpen, setApiKeysDialogOpen] = useState(false);

  // Push/Pull dialogs state
  const [showPushConfirmDialog, setShowPushConfirmDialog] = useState(false);
  const [showPullConfirmDialog, setShowPullConfirmDialog] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; item: string } | null>(null);

  // Diagnostic state
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnosticData, setDiagnosticData] = useState<Record<string, { total: number; pending: number; local: number }> | null>(null);

  const handleExport = () => {
    if (!store) return;

    try {
      const data = exportAllData(store);
      downloadExportFile(data);
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store) return;

    setImporting(true);
    setError(null);
    setImportResult(null);
    setImportDialogOpen(true);

    try {
      const json = await readFileAsJson(file);

      if (!validateImportData(json)) {
        setError(t('importExport.invalidFormat'));
        setImporting(false);
        return;
      }

      const result = await importData(store, json, { useCurrentDate: true });
      setImportResult(result);

      if (!result.success && result.errors.length > 0) {
        setError(result.errors[0]);
      }
    } catch (err) {
      setError(t('importExport.importError'));
      console.error('Import error:', err);
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDialogClose = () => {
    setImportDialogOpen(false);
    setImportResult(null);
    setError(null);
  };

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

  // Push/Pull handlers
  const handlePushAll = async () => {
    setShowPushConfirmDialog(false);
    setSyncProgress({ current: 0, total: 0, item: '' });

    const result = await pushAllToSupabase((progress) => {
      setSyncProgress(progress);
    });

    setSyncProgress(null);

    if (result.success) {
      toast.success(t('sync.pushAll'), {
        description: t('sync.pushSuccess', {
          notes: result.pushed.notes,
          labels: result.pushed.labels,
          noteLabels: result.pushed.noteLabels,
          history: result.pushed.noteHistory,
          contacts: result.pushed.contacts,
        }),
      });
    } else {
      toast.error(t('sync.pushError'), {
        description: result.error,
      });
    }
  };

  const handlePullAll = async () => {
    setShowPullConfirmDialog(false);
    setSyncProgress({ current: 0, total: 0, item: '' });

    const result = await pullAllFromSupabase((progress) => {
      setSyncProgress(progress);
    });

    setSyncProgress(null);

    if (result.success) {
      toast.success(t('sync.pullAll'), {
        description: t('sync.pullSuccess', {
          notes: result.pulled.notes,
          labels: result.pulled.labels,
          noteLabels: result.pulled.noteLabels,
          contacts: result.pulled.contacts,
        }),
      });
      // Reload to show new data
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast.error(t('sync.pullError'), {
        description: result.error,
      });
    }
  };

  const canPush = user && connectionStatus === 'online' && !isPushingAll && !isPullingAll;
  const canPull = user && connectionStatus === 'online' && !isPushingAll && !isPullingAll;

  // Sync helpers
  const getSyncIcon = () => {
    if (connectionStatus === 'offline') {
      return <CloudOff className="h-4 w-4 mr-2" />;
    }
    if (syncState === 'syncing') {
      return <RefreshCw className="h-4 w-4 mr-2 animate-spin" />;
    }
    if (syncState === 'error' || syncError) {
      return <AlertCircle className="h-4 w-4 mr-2 text-destructive" />;
    }
    if (pendingCount > 0) {
      return <Cloud className="h-4 w-4 mr-2 text-yellow-500" />;
    }
    return <Check className="h-4 w-4 mr-2 text-green-500" />;
  };

  const getSyncStatusText = () => {
    if (connectionStatus === 'offline') {
      return t('sync.offline');
    }
    if (syncState === 'syncing') {
      return t('sync.syncing');
    }
    if (syncState === 'error' || syncError) {
      return t('sync.error');
    }
    if (pendingCount > 0) {
      return t('sync.pending');
    }
    return t('sync.synced');
  };

  const formatLastSync = () => {
    if (!lastSyncedAt) return t('sync.never');

    const date = new Date(lastSyncedAt);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;

    return date.toLocaleDateString();
  };

  const collectDiagnosticData = () => {
    if (!store) return;

    const tables = ['notes', 'labels', 'contacts', 'note_labels', 'note_history'] as const;
    const data: Record<string, { total: number; pending: number; local: number }> = {};

    tables.forEach((tableName) => {
      const table = store.getTable(tableName) || {};
      const rows = Object.values(table);
      data[tableName] = {
        total: rows.length,
        pending: rows.filter((row) => (row as Record<string, unknown>).sync_status === 'pending').length,
        local: rows.filter((row) => (row as Record<string, unknown>).sync_status === 'local').length,
      };
    });

    setDiagnosticData(data);
    setShowDiagnostics(true);
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
                  <span className="text-muted-foreground">{getSyncStatusText()}</span>
                  <span className="text-xs text-muted-foreground">{formatLastSync()}</span>
                </div>
              </div>
              <DropdownMenuItem
                onClick={() => syncNow()}
                disabled={syncState === 'syncing' || connectionStatus === 'offline'}
              >
                {getSyncIcon()}
                {t('sync.syncNow')}
                {pendingCount > 0 && (
                  <span className="ml-auto text-xs text-muted-foreground">{pendingCount}</span>
                )}
              </DropdownMenuItem>
              <div className="px-2 py-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-sync" className="cursor-pointer text-sm font-normal">
                    {t('settingsMenu.autoSync')}
                  </Label>
                  <Switch
                    id="auto-sync"
                    checked={settings.autoSync}
                    onCheckedChange={(checked) => updateSettings({ autoSync: checked })}
                  />
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
              <DropdownMenuItem
                onClick={() => setShowPullConfirmDialog(true)}
                disabled={!canPull}
              >
                {isPullingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CloudDownload className="h-4 w-4 mr-2" />
                )}
                {t('sync.pullAll')}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowPushConfirmDialog(true)}
                disabled={!canPush}
              >
                {isPushingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CloudUpload className="h-4 w-4 mr-2" />
                )}
                {t('sync.pushAll')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={collectDiagnosticData}>
                <BarChart3 className="h-4 w-4 mr-2 text-blue-500" />
                Sync Diagnostics
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            {t('importExport.export')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleImportClick}>
            <Upload className="h-4 w-4 mr-2" />
            {t('importExport.import')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
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

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      <Dialog open={importDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('importExport.import')}</DialogTitle>
            <DialogDescription>
              {importing ? t('importExport.importing') : t('importExport.importDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {error && (
              <div className="flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            {importResult && importResult.success && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                <CheckCircle className="h-4 w-4" />
                {t('importExport.importSuccess', {
                  notes: importResult.notesImported,
                  history: importResult.historyImported,
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Sync progress indicator */}
      {syncProgress && (
        <div className="fixed bottom-4 right-4 w-64 rounded-lg border bg-background/95 backdrop-blur shadow-lg z-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">
              {isPushingAll ? t('sync.pushing') : t('sync.pulling')}
            </span>
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {syncProgress.item}
          </div>
          <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-200"
              style={{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            {syncProgress.current} / {syncProgress.total}
          </div>
        </div>
      )}

      {/* Push confirmation dialog */}
      <Dialog open={showPushConfirmDialog} onOpenChange={setShowPushConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sync.pushAll')}</DialogTitle>
            <DialogDescription>
              {t('sync.pushAllConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPushConfirmDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handlePushAll}>
              {t('sync.pushAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pull confirmation dialog */}
      <Dialog open={showPullConfirmDialog} onOpenChange={setShowPullConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('sync.pullAll')}</DialogTitle>
            <DialogDescription>
              {t('sync.pullAllConfirm')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPullConfirmDialog(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={handlePullAll}>
              {t('sync.pullAll')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* API Keys dialog */}
      <APIKeysDialog
        open={apiKeysDialogOpen}
        onOpenChange={setApiKeysDialogOpen}
      />

      {/* Sync Diagnostics Dialog */}
      <Dialog open={showDiagnostics} onOpenChange={setShowDiagnostics}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sync Diagnostics</DialogTitle>
            <DialogDescription>
              Detailed sync status for all tables
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {diagnosticData && Object.entries(diagnosticData).map(([table, stats]) => (
              <div key={table} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{table}</span>
                  <span className="text-xs text-muted-foreground">{stats.total} total</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center justify-between px-2 py-1 bg-yellow-500/10 rounded">
                    <span>Pending:</span>
                    <span className={stats.pending > 0 ? 'font-semibold text-yellow-600' : ''}>{stats.pending}</span>
                  </div>
                  <div className="flex items-center justify-between px-2 py-1 bg-blue-500/10 rounded">
                    <span>Local:</span>
                    <span className={stats.local > 0 ? 'font-semibold text-blue-600' : ''}>{stats.local}</span>
                  </div>
                </div>
              </div>
            ))}
            {syncError && (
              <div className="mt-4 p-3 bg-destructive/10 text-destructive text-sm rounded">
                <div className="font-semibold mb-1">Sync Error:</div>
                <div className="text-xs">{syncError}</div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              onClick={async () => {
                await pushAllToSupabase();
                collectDiagnosticData();
              }}
              disabled={!canPush}
              className="w-full"
            >
              <CloudUpload className="h-4 w-4 mr-2" />
              Force Push All
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDiagnostics(false)}
              className="w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
