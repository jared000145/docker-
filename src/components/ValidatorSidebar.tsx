import WorkspaceBrand from '@/components/account/WorkspaceBrand';
import AccountMenu from '@/components/account/AccountMenu';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { usePermissions } from "@/hooks/usePermissions";
import { usePendingValidationsCount } from "@/hooks/usePendingValidationsCount";
import { useModuleBadges } from "@/hooks/useModuleBadges";
import { FileCheck2, PenSquare, LogOut, ShieldCheck, LayoutDashboard, Wallet, Users, BookMarked, FileSpreadsheet, ClipboardCheck, ClipboardList, Award, Calendar, DoorOpen, CalendarDays, PartyPopper, Bell, Library, GraduationCap, BookOpen, Layers, Sliders, Settings, UserCheck, Lock, ShieldAlert, UserX } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import type { ValidatorRoleConfig } from "@/lib/validatorRoles";

export function ValidatorSidebar({ role }: { role: ValidatorRoleConfig }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { institution } = useInstitution();
  const { hasPerm, can, allowedModules } = usePermissions();
  const pendingCount = usePendingValidationsCount();
  const moduleBadges = useModuleBadges();

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const baseItems = [
    { title: "Tableau de bord", url: `${role.routePrefix}`, icon: LayoutDashboard, end: true, perm: null as string | null, badge: 0 },
    { title: "Documents à valider", url: `${role.routePrefix}/documents`, icon: FileCheck2, end: true, perm: "validate_releve", badge: pendingCount },
    { title: "Signature & cachet", url: `${role.routePrefix}/signature`, icon: PenSquare, end: true, perm: "manage_signature", badge: 0 },
  ];
  const items = baseItems.filter((it) => !it.perm || hasPerm(it.perm));

  // Extra admin modules granted to this validator: surface them as direct links
  // into the admin area so the user can actually use what was assigned to them.
  type Extra = { title: string; url: string; icon: any; module: string };
  const ALL_EXTRAS: Extra[] = [
    { title: "Filières", url: "/admin/filieres", icon: GraduationCap, module: "parametres_academiques" },
    { title: "Matières", url: "/admin/subjects", icon: BookOpen, module: "parametres_academiques" },
    { title: "Unités d'Enseignement", url: "/admin/ues", icon: Layers, module: "parametres_academiques" },
    { title: "Planning", url: "/admin/schedule", icon: Calendar, module: "planning" },
    { title: "Salles", url: "/admin/classrooms", icon: DoorOpen, module: "salles" },
    { title: "Étudiants", url: "/admin/students", icon: Users, module: "etudiants" },
    { title: "Professeurs", url: "/admin/professors", icon: BookMarked, module: "profs" },
    { title: "Parents", url: "/admin/parents", icon: Users, module: "parents" },
    { title: "Inscriptions & accès", url: "/admin/access-control", icon: UserCheck, module: "etudiants" },
    { title: "Exclusions & abandons", url: "/admin/exclusions", icon: UserX, module: "exclusions" },
    { title: "Notes", url: "/admin/grades", icon: FileSpreadsheet, module: "notes" },
    { title: "Présences", url: "/admin/attendance", icon: ClipboardCheck, module: "presences" },
    { title: "Rattrapages", url: "/admin/rattrapages", icon: ClipboardList, module: "rattrapage" },
    { title: "Soutenances", url: "/admin/soutenances", icon: Award, module: "soutenances" },
    { title: "Espace Finances", url: "/admin/finances", icon: Wallet, module: "paiements" },
    { title: "Clôture de l'exercice", url: "/admin/closure", icon: Lock, module: "cloture" },
    { title: "Événements", url: "/admin/events", icon: CalendarDays, module: "communaute" },
    { title: "BDE", url: "/admin/bde", icon: PartyPopper, module: "communaute" },
    { title: "Notifications", url: "/admin/notifications", icon: Bell, module: "communaute" },
    { title: "Bibliothèque", url: "/admin/library", icon: Library, module: "documents" },
    { title: "Paramètres", url: "/admin/settings", icon: Settings, module: "parametres_academiques" },
    { title: "Règles académiques", url: "/admin/academic-settings", icon: Sliders, module: "parametres_academiques" },
    { title: "Gestion d'équipe", url: "/admin/team", icon: ShieldCheck, module: "equipe" },
    { title: "Audit", url: "/admin/audit", icon: ShieldAlert, module: "audit" },
  ];
  const seen = new Set<string>();
  const extras = ALL_EXTRAS.filter((e) => {
    if (!can(e.module as any)) return false;
    if (seen.has(e.url)) return false;
    seen.add(e.url);
    return true;
  });
  void allowedModules;

  const displayName = institution?.name || "Rectorplus";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border/50"><WorkspaceBrand label="Responsable pédagogique" /><div className="mt-5 group-data-[collapsible=icon]:hidden"><AccountMenu sidebar role="Responsable pédagogique" /></div></SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-[11px] uppercase tracking-wider font-semibold px-3">
            {!collapsed && `Espace ${role.shortLabel}`}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((it) => (
                <SidebarMenuItem key={it.title}>
                  <SidebarMenuButton asChild className="h-auto rounded-lg">
                    <NavLink to={it.url} end={it.end} className="app-simple-link" activeClassName="app-simple-link-active">
                      <it.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span className="text-sm truncate flex-1">{it.title}</span>}
                      {it.badge > 0 && (
                        <span className={`${collapsed ? "absolute top-1 right-1" : "ml-auto"} inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold animate-pulse`}>
                          {it.badge > 99 ? "99+" : it.badge}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {extras.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/60 text-[11px] uppercase tracking-wider font-semibold px-3">
              {!collapsed && "Modules supplémentaires"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {extras.map((it) => {
                  const badge = moduleBadges[it.module] || 0;
                  return (
                    <SidebarMenuItem key={it.url}>
                      <SidebarMenuButton asChild className="h-auto rounded-lg">
                        <NavLink to={it.url} end className="app-simple-link relative" activeClassName="app-simple-link-active">
                          <it.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                          {!collapsed && <span className="text-sm truncate flex-1">{it.title}</span>}
                          {badge > 0 && (
                            <span className={`${collapsed ? "absolute top-1 right-1 w-2 h-2 rounded-full bg-destructive" : "ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold animate-pulse"}`}>
                              {!collapsed && (badge > 99 ? "99+" : badge)}
                            </span>
                          )}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="h-auto rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/75 hover:bg-destructive/10 hover:text-destructive transition-colors"
            >
              <LogOut className="mr-3 h-5 w-5" />
              {!collapsed && <span>Quitter</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
