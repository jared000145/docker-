import AccountMenu from '@/components/account/AccountMenu';
import PageTransition from "@/components/PageTransition";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "@/components/SuperAdminSidebar";
import { AcademicYearProvider } from "@/hooks/useAcademicYear";
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';

const SuperAdminLayout = () => {
  useRealtimeSubscription('institutions',[['sa-institutions'],['sa-subscription-institutions']]);
  useRealtimeSubscription('profiles',[['sa-student-profiles'],['sa-admins-count']]);
  useRealtimeSubscription('user_roles',[['sa-student-roles'],['sa-admins-count']]);
  return (
  <AcademicYearProvider>
    <SidebarProvider>
      <div className="app-shell min-h-svh flex w-full overflow-x-hidden">
        <SuperAdminSidebar />
        <SidebarInset className="flex-1 bg-transparent">
          <header className="app-header flex min-h-14 items-center gap-3 px-3 py-2 sm:px-6">
            <SidebarTrigger className="-ml-1" />
            <span className="truncate text-sm font-medium text-muted-foreground">Rectorplus • Super Administration</span>
          <div className="ml-auto"><AccountMenu role="Super administrateur" /></div></header>
          <main className="app-surface flex-1 min-w-0 overflow-x-hidden p-3 sm:p-4 lg:p-6">
            <PageTransition />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  </AcademicYearProvider>
);
};

export default SuperAdminLayout;
