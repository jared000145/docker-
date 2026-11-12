import {useDirector} from '@/hooks/useDirector';
import DirectorLayout from '@/components/DirectorLayout';
import AccountMenu from '@/components/account/AccountMenu';
import PageTransition from "@/components/PageTransition";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import { Shield } from "lucide-react";
import { AcademicYearProvider } from "@/hooks/useAcademicYear";
import { GlobalSearchBar } from "@/components/admin/GlobalSearchBar";
import { SubscriptionBanner } from "@/components/admin/SubscriptionBanner";
import { SubscriptionExpiredScreen } from "@/components/admin/SubscriptionExpiredScreen";
import { useSubscription } from "@/hooks/useSubscription";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import AdminChatbot from "@/components/admin/AdminChatbot";
import { CampusProvider } from "@/hooks/useCampus";
import { CampusSelector } from "@/components/admin/CampusSelector";

const AdminLayout = () => {

  const { isExpired, isLoading: subLoading } = useSubscription();
  const { isSuperAdmin } = useSuperAdmin();
  const {isDirector}=useDirector();

  if (!subLoading && isExpired && !isSuperAdmin) {
    return <SubscriptionExpiredScreen />;
  }

  if(isDirector)return <DirectorLayout/>;
  return (
    <AcademicYearProvider>
    <CampusProvider>
    <SidebarProvider>
      <div className="app-shell min-h-svh flex w-full overflow-x-hidden">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <SubscriptionBanner />
          <header className="app-header min-h-16 flex items-center justify-between gap-2 px-3 py-2 sm:px-4 lg:px-6 sticky top-0 z-10">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4 flex-1">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="hidden lg:flex min-w-0 items-center gap-2">
                <Shield className="w-4 h-4 text-accent" />
                <span className="truncate text-sm font-medium text-accent">Panneau Admin</span>
              </div>
              <div className="flex-1 max-w-md ml-2">
                <GlobalSearchBar />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <CampusSelector />
              <AccountMenu role="Administrateur" />
            </div>
          </header>
          <main className="app-surface flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-6">
            <PageTransition />
          </main>
        </div>
      </div>
      <AdminChatbot />
    </SidebarProvider>
    </CampusProvider>
    </AcademicYearProvider>
  );
};

export default AdminLayout;
