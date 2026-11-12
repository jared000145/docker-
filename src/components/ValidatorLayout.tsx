import {CampusProvider} from "@/hooks/useCampus";
import {CampusSelector} from "@/components/admin/CampusSelector";
import AccountMenu from '@/components/account/AccountMenu';
import PageTransition from "@/components/PageTransition";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { ValidatorSidebar } from "@/components/ValidatorSidebar";
import { AcademicYearProvider } from "@/hooks/useAcademicYear";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";
import type { ValidatorRoleConfig } from "@/lib/validatorRoles";

const ValidatorLayout = ({ role }: { role: ValidatorRoleConfig }) => (
  <AcademicYearProvider><CampusProvider>
    <SidebarProvider>
      <div className="app-shell min-h-svh flex w-full overflow-x-hidden">
        <ValidatorSidebar role={role} />
        <SidebarInset className="flex-1 bg-transparent">
          <header className="app-header flex min-h-14 items-center gap-3 px-3 py-2 sm:px-6">
            <SidebarTrigger className="-ml-1" /><CampusSelector />
            <span className="truncate text-sm font-medium text-muted-foreground">Rectorplus • Espace {role.label}</span>
            <Badge variant="outline" className="ml-auto border-accent/40 text-accent bg-accent/10 gap-1">
              <ShieldCheck className="w-3 h-3" /> {role.shortLabel}
            </Badge>
          <div className="ml-auto"><AccountMenu role="Responsable pédagogique" /></div></header>
          <main className="app-surface flex-1 min-w-0 overflow-x-hidden p-3 sm:p-4 lg:p-6">
            <PageTransition />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  </CampusProvider></AcademicYearProvider>
);

export default ValidatorLayout;
