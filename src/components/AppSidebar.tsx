import { useRef, useState } from 'react';
import { Home, Users, BarChart3, Moon, Sun, Languages, LogOut, User, Cloud, CloudOff, RefreshCw, AlertCircle, Check, CloudUpload, CloudDownload, Download, Upload, Loader2, Tag, FolderKanban, Calendar } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ProjectSelector } from '@/components/projects/ProjectSelector';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { useTinyBase } from '@/contexts/TinyBaseContext';
import {
  exportAllData,
  downloadExportFile,
  importData,
  readFileAsJson,
  validateImportData,
} from '@/utils/dataExport';

export function AppSidebar() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { connectionStatus, syncState, lastSyncedAt, pendingCount, error: syncError, syncNow, pushAllToSupabase, pullAllFromSupabase, isPushingAll, isPullingAll } = useSync();
  const { store } = useTinyBase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [showPushConfirmDialog, setShowPushConfirmDialog] = useState(false);
  const [showPullConfirmDialog, setShowPullConfirmDialog] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; item: string } | null>(null);

  const canPush = user && connectionStatus === 'online' && !isPushingAll && !isPullingAll;
  const canPull = user && connectionStatus === 'online' && !isPushingAll && !isPullingAll;

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
      setTimeout(() => window.location.reload(), 1500);
    } else {
      toast.error(t('sync.pullError'), {
        description: result.error,
      });
    }
  };

  // Import/Export handlers
  const handleExport = () => {
    if (!store) return;

    try {
      const data = exportAllData(store);
      downloadExportFile(data);
      toast.success(t('toast.exportSuccess'));
    } catch (err) {
      console.error('Export error:', err);
      toast.error(t('toast.exportError'));
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !store) return;

    try {
      const json = await readFileAsJson(file);

      if (!validateImportData(json)) {
        toast.error(t('importExport.invalidFormat'));
        return;
      }

      const result = await importData(store, json, { useCurrentDate: true });

      if (result.success) {
        toast.success(t('importExport.importSuccess', {
          notes: result.notesImported,
          history: result.historyImported,
        }));
      } else if (result.errors.length > 0) {
        toast.error(t('toast.importError'), { description: result.errors[0] });
      }
    } catch (err) {
      toast.error(t('toast.importError'));
      console.error('Import error:', err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'es' ? 'en' : 'es';
    i18n.changeLanguage(newLang);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const getSyncIcon = () => {
    if (connectionStatus === 'offline') {
      return <CloudOff className="h-4 w-4" />;
    }
    if (syncState === 'syncing') {
      return <RefreshCw className="h-4 w-4 animate-spin" />;
    }
    if (syncState === 'error' || syncError) {
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    }
    if (pendingCount > 0) {
      return <Cloud className="h-4 w-4 text-yellow-500" />;
    }
    return <Check className="h-4 w-4 text-green-500" />;
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

  const menuItems = [
    {
      title: t('nav.home', 'Home'),
      url: '/',
      icon: Home,
    },
    {
      title: t('nav.contacts', 'Contacts'),
      url: '/contacts',
      icon: Users,
    },
    {
      title: t('nav.analytics', 'Analytics'),
      url: '/analytics',
      icon: BarChart3,
    },
    {
      title: t('manageLabels'),
      url: '/labels',
      icon: Tag,
    },
    {
      title: t('nav.projects', 'Projects'),
      url: '/projects',
      icon: FolderKanban,
    },
  ];

  return (
    <Sidebar side="left" collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="px-2 py-2">
          <ProjectSelector />
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t('nav.navigation', 'Navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {user && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('sync.status', 'Sync')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => syncNow()}
                    disabled={syncState === 'syncing' || connectionStatus === 'offline'}
                  >
                    {getSyncIcon()}
                    <span className="flex-1">{getSyncStatusText()}</span>
                    <span className="text-xs text-muted-foreground">
                      {pendingCount > 0 ? `(${pendingCount})` : formatLastSync()}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setShowPullConfirmDialog(true)}
                    disabled={!canPull}
                  >
                    {isPullingAll ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CloudDownload className="h-4 w-4" />
                    )}
                    <span>{t('sync.pullAll')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => setShowPushConfirmDialog(true)}
                    disabled={!canPush}
                  >
                    {isPushingAll ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CloudUpload className="h-4 w-4" />
                    )}
                    <span>{t('sync.pushAll')}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarGroup>
          <SidebarGroupLabel>{t('importExport.title', 'Data')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleExport}>
                  <Download className="h-4 w-4" />
                  <span>{t('importExport.export')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={handleImportClick}>
                  <Upload className="h-4 w-4" />
                  <span>{t('importExport.import')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleLanguage}>
              <Languages />
              <span>{t('language', 'Language')}: {i18n.language.toUpperCase()}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme}>
              {theme === 'dark' ? <Sun /> : <Moon />}
              <span>{theme === 'dark' ? t('theme.light', 'Light Mode') : t('theme.dark', 'Dark Mode')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === '/settings/calendar'}>
              <Link to="/settings/calendar">
                <Calendar className="text-blue-600" />
                <span>{t('gcal.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {user && (
            <>
              <SidebarSeparator />
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-1.5">
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt={user.user_metadata?.full_name || 'User'}
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  <span className="text-sm truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </span>
                </div>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={signOut} className="text-destructive hover:text-destructive">
                  <LogOut />
                  <span>{t('auth.signOut', 'Sign Out')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarFooter>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

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

    </Sidebar>
  );
}
