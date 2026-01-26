import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { CommandPaletteProvider } from '@/contexts/CommandPaletteContext';

export function MainLayout() {
  return (
    <CommandPaletteProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <SidebarInset className="h-screen flex flex-col py-4 px-4">
          <div className="w-full px-4 flex flex-col flex-1 min-h-0">
            <Outlet context={{ sidebarTrigger: <SidebarTrigger variant="outline" className="h-8 w-8 shadow-none" /> }} />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </CommandPaletteProvider>
  );
}
