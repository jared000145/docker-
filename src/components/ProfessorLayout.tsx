import AccountMenu from '@/components/account/AccountMenu';
import PageTransition from "@/components/PageTransition";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ProfessorSidebar } from "@/components/ProfessorSidebar";
import { BookOpen } from "lucide-react";
import { AcademicYearProvider } from "@/hooks/useAcademicYear";
import { AcademicYearSelector } from "@/components/AcademicYearSelector";
import { useSubscription } from "@/hooks/useSubscription";
import { SubscriptionExpiredScreen } from "@/components/admin/SubscriptionExpiredScreen";

const ProfessorLayout = () => {

  const { isExpired, isLoading: subLoading } = useSubscription();
  if (!subLoading && isExpired) return <SubscriptionExpiredScreen />;

  return (
    <AcademicYearProvider>
    <SidebarProvider>
      <div className="app-shell min-h-svh flex w-full overflow-x-hidden">
        <ProfessorSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="app-header min-h-16 flex items-center justify-between gap-2 px-3 py-2 sm:px-4 lg:px-6 sticky top-0 z-10">
            <div className="flex min-w-0 items-center gap-2 sm:gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="flex min-w-0 items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent" />
                <span className="truncate text-sm font-medium text-accent">Espace Professeur</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <AcademicYearSelector showLabel={false} />
              <AccountMenu role="Enseignant" />
            </div>
          </header>
          <main className="app-surface flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:p-6">
            <PageTransition />
          </main>
        </div>
      </div>
    </SidebarProvider>
    </AcademicYearProvider>
  );
};

export default ProfessorLayout;
