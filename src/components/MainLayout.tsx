import { Outlet } from 'react-router-dom';
import { AppSidebar } from '@/components/AppSidebar';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';

export function MainLayout() {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <SidebarInset className="h-screen flex flex-col py-8 px-4">
        <div className="w-full px-4 flex flex-col flex-1 min-h-0">
          <Outlet context={{ sidebarTrigger: <SidebarTrigger className="h-8 w-8 shadow-none" /> }} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
