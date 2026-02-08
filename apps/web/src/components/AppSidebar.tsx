import { useState } from 'react';
import { Home, Users, BarChart3, Moon, Sun, Languages, LogOut, User, Cloud, CloudOff, Tag, FolderKanban, Calendar, Smartphone, Key, Sparkles, Bot } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSync } from '@/contexts/SyncContext';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { APIKeysDialog } from '@/components/settings/APIKeysDialog';
import { AIProviderDialog } from '@/components/settings/AIProviderDialog';

export function AppSidebar() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const { connectionStatus } = useSync();
  const { canInstall, promptInstall } = usePWAInstall();

  // API Keys dialog state
  const [apiKeysDialogOpen, setApiKeysDialogOpen] = useState(false);

  // AI Provider dialog state
  const [aiDialogOpen, setAiDialogOpen] = useState(false);

  const LANGUAGE_CYCLE = ['es', 'en', 'pt'] as const;
  const toggleLanguage = () => {
    const currentIndex = LANGUAGE_CYCLE.indexOf(i18n.language as typeof LANGUAGE_CYCLE[number]);
    const newLang = LANGUAGE_CYCLE[(currentIndex + 1) % LANGUAGE_CYCLE.length];
    i18n.changeLanguage(newLang);
    localStorage.setItem('app-language', newLang);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
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
    {
      title: t('nav.chat', 'AI Chat'),
      url: '/chat',
      icon: Bot,
    },
  ];

  return (
    <Sidebar side="left" collapsible="offcanvas">
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <ProjectSelector />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-2 py-1">
          <SidebarGroupLabel className="h-6 px-1">{t('nav.navigation', 'Navigation')}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url} size="sm">
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
          <SidebarGroup className="p-2 py-1">
            <SidebarGroupLabel className="h-6 px-1">{t('sync.status', 'Connection')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                <SidebarMenuItem>
                  <div className="flex items-center gap-2 px-2 py-1.5">
                    {connectionStatus === 'online' ? (
                      <Cloud className="h-4 w-4 text-green-500" />
                    ) : (
                      <CloudOff className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      {connectionStatus === 'online' ? t('sync.online', 'Online') : t('sync.offline', 'Offline')}
                    </span>
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu className="gap-0.5">
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleLanguage} size="sm">
              <Languages />
              <span>{t('language', 'Language')}: {i18n.language.toUpperCase()}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={toggleTheme} size="sm">
              {theme === 'dark' ? <Sun /> : <Moon />}
              <span>{theme === 'dark' ? t('theme.light', 'Light Mode') : t('theme.dark', 'Dark Mode')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {canInstall && (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={promptInstall} size="sm">
                <Smartphone className="text-green-600" />
                <span>{t('pwa.installApp')}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setApiKeysDialogOpen(true)} size="sm">
              <Key className="text-amber-600" />
              <span>{t('apiKeys.title')}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={location.pathname === '/settings/calendar'} size="sm">
              <Link to="/settings/calendar">
                <Calendar className="text-blue-600" />
                <span>{t('gcal.title')}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setAiDialogOpen(true)} size="sm">
              <Sparkles className="text-purple-600" />
              <span>{t('ai.menuTitle')}</span>
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
                <SidebarMenuButton onClick={signOut} className="text-destructive hover:text-destructive" size="sm">
                  <LogOut />
                  <span>{t('auth.signOut', 'Sign Out')}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
        </SidebarMenu>
      </SidebarFooter>

      {/* API Keys dialog — only mount when open to avoid fetching /api/keys on every page load */}
      {apiKeysDialogOpen && <APIKeysDialog open={apiKeysDialogOpen} onOpenChange={setApiKeysDialogOpen} />}

      {/* AI Provider dialog */}
      <AIProviderDialog open={aiDialogOpen} onOpenChange={setAiDialogOpen} />
    </Sidebar>
  );
}
