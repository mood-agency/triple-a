import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';
import { OfflineBanner } from '@/components/OfflineBanner';

export function MainLayout() {
  return (
    <CommandPaletteProvider>
      <div className="flex flex-col h-screen">
        <OfflineBanner />
        <SidebarProvider defaultOpen={false}>
          <AppSidebar />
          <SidebarInset className="flex-1 flex flex-col py-4 px-4">
            <div className="w-full px-4 flex flex-col flex-1 min-h-0">
              <Outlet context={{ sidebarTrigger: <SidebarTrigger variant="outline" className="h-8 w-8 shadow-none" /> }} />
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </CommandPaletteProvider>
  );
}
