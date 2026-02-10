import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useSettings } from '@/hooks/useSettings';

// Helper to read the sidebar cookie
function getSidebarCookie(): boolean | null {
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'sidebar_state') {
      return value === 'true';
    }
  }
  return null;
}

export function MainLayout() {
  const { settings, updateSettings } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    // Priority: 1. Cookie 2. Settings 3. Default (false)
    const cookieValue = getSidebarCookie();
    if (cookieValue !== null) {
      return cookieValue;
    }
    return settings.showSidebar;
  });

  // Sync sidebar state with settings
  useEffect(() => {
    if (sidebarOpen !== settings.showSidebar) {
      updateSettings({ showSidebar: sidebarOpen });
    }
  }, [sidebarOpen, settings.showSidebar, updateSettings]);

  return (
    <CommandPaletteProvider>
      <div className="flex flex-col h-screen">
        <OfflineBanner />
        <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col py-4 px-4 relative">
            <div className="w-full flex flex-col flex-1 min-h-0">
              <Outlet context={{ sidebarTrigger: <SidebarTrigger variant="outline" className="h-8 w-8 shadow-none" /> }} />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </CommandPaletteProvider>
  );
}
