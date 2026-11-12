import { useState } from "react";
import WorkspaceBrand from '@/components/account/WorkspaceBrand';
import AccountMenu from '@/components/account/AccountMenu';
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { usePermissions } from "@/hooks/usePermissions";
import {
  LayoutDashboard, Users, ClipboardList, CreditCard, BookOpen,
  Calendar, LogOut, GraduationCap, Bell,
  CalendarDays, Settings, Layers, ClipboardCheck, UserCheck, Mail,
  Sliders, BookMarked, FileSpreadsheet, Library, PartyPopper, Award,
  ShieldCheck, DoorOpen, Wallet, Lock, ShieldAlert, UserX, School, LayoutGrid, FileCheck2, Inbox,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import type { ModuleKey } from "@/lib/permissions";
import { useCycle } from "@/hooks/useCycle";
import { useTerms } from "@/hooks/useTerms";

type CycleScope = "all" | "uni" | "scolaire";
type Item = { title: string; url: string; icon: any; end?: boolean; module?: ModuleKey | null; scope?: CycleScope };

const SECTIONS: { label: string; scope?: CycleScope; items: Item[] }[] = [
  {
    label: "Vue d'ensemble",
    items: [
      { title: "Tableau de bord", url: "/admin", icon: LayoutDashboard, end: true, module: null },
    ],
  },
  {
    label: "Académique (Université)",
    scope: "uni",
    items: [
      { title: "Filières", url: "/admin/filieres", icon: GraduationCap, module: "parametres_academiques", scope: "uni" },
      { title: "Matières", url: "/admin/subjects", icon: BookOpen, module: "parametres_academiques", scope: "uni" },
      { title: "Unités d’enseignement", url: "/admin/ues", icon: Layers, module: "parametres_academiques", scope: "uni" },
    ],
  },
  {
    label: "Collège & Lycée",
    scope: "scolaire",
    items: [
      { title: "Cycles activés", url: "/admin/cycles", icon: Layers, module: "parametres_academiques" },
      { title: "Classes", url: "/admin/classes", icon: School, module: "parametres_academiques", scope: "scolaire" },
      { title: "Matières & coefficients", url: "/admin/subjects", icon: BookOpen, module: "parametres_academiques", scope: "scolaire" },
      { title: "Notes trimestrielles", url: "/admin/grades-trimestre", icon: FileSpreadsheet, module: "notes", scope: "scolaire" },
    ],
  },
  {
    label: "Logistique",
    items: [
      { title: "Planning", url: "/admin/schedule", icon: Calendar, module: "planning" },
      { title: "Salles", url: "/admin/classrooms", icon: DoorOpen, module: "salles" },
      { title: "Classes", url: "/admin/groups", icon: LayoutGrid, module: "parametres_academiques", scope: "uni" },
    ],
  },
  {
    label: "Personnes",
    items: [
      { title: "__STUDENTS__", url: "/admin/students", icon: Users, module: "etudiants" },
      { title: "Professeurs", url: "/admin/professors", icon: BookMarked, module: "profs" },
      { title: "Parents", url: "/admin/parents", icon: Users, module: "parents" },
      { title: "Inscriptions & accès", url: "/admin/access-control", icon: UserCheck, module: "etudiants" },
      { title: "Exclusions & abandons", url: "/admin/exclusions", icon: UserX, module: "exclusions" },
    ],
  },
  {
    label: "Suivi pédagogique (Université)",
    scope: "uni",
    items: [
      { title: "Notes", url: "/admin/grades", icon: FileSpreadsheet, module: "notes", scope: "uni" },
      { title: "PV des matières", url: "/admin/pv", icon: FileCheck2, module: "notes", scope: "uni" },
      { title: "Rattrapages", url: "/admin/rattrapages", icon: ClipboardList, module: "rattrapage", scope: "uni" },
      { title: "Soutenances", url: "/admin/soutenances", icon: Award, module: "soutenances", scope: "uni" },
    ],
  },
  {
    label: "Présences",
    items: [
      { title: "Présences", url: "/admin/attendance", icon: ClipboardCheck, module: "presences" },
    ],
  },
  {
    label: "Finances",
    items: [
      { title: "Espace Finances", url: "/admin/finances", icon: Wallet, module: "paiements" },
      { title: "Clôture de l'exercice", url: "/admin/closure", icon: Lock, module: "cloture", scope: "uni" },
      { title: "Clôture trimestrielle", url: "/admin/closure-trimestre", icon: Lock, module: "cloture", scope: "scolaire" },
    ],
  },
  {
    label: "Vie étudiante",
    scope: "uni" as CycleScope,
    items: [
      { title: "Événements", url: "/admin/events", icon: CalendarDays, module: "communaute", scope: "uni" as CycleScope },
      { title: "BDE", url: "/admin/bde", icon: PartyPopper, module: "communaute", scope: "uni" as CycleScope },
    ],
  },
  {
    label: "Orientation post-BAC",
    scope: "all" as CycleScope,
    items: [
      { title: "Formations et orientation", url: "/admin/admissions", icon: DoorOpen, module: "parametres_academiques", scope: "all" as CycleScope },
      { title: "Candidatures reçues", url: "/admin/applications", icon: Inbox, module: "etudiants", scope: "uni" as CycleScope },
    ],
  },
  {
    label: "Communication",
    items: [
      { title: "Messagerie", url: "/admin/messages", icon: Mail, module: null },
      { title: "Notifications", url: "/admin/notifications", icon: Bell, module: "communaute" },
      { title: "Bibliothèque", url: "/admin/library", icon: Library, module: "documents" },
    ],
  },
  {
    label: "Configuration",
    items: [
      { title: "Paramètres", url: "/admin/settings", icon: Settings, module: "parametres_academiques" },
      { title: "Règles académiques", url: "/admin/academic-settings", icon: Sliders, module: "parametres_academiques" },
      { title: "Gestion d'équipe", url: "/admin/team", icon: ShieldCheck, module: "equipe" },
      { title: "Audit", url: "/admin/audit", icon: ShieldAlert, module: "audit" },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [search, setSearch] = useState("");
  const { signOut } = useAuth();
  const { institution } = useInstitution();
  const { isPrincipal, can } = usePermissions();
  const { hasUniversite, hasCollege, hasLycee } = useCycle();
  const terms = useTerms();
  const hasScolaire = hasCollege || hasLycee;
  // Si l'établissement n'a QUE le scolaire, on masque tout l'univers universitaire, et inversement.
  const showUni = hasUniversite;
  const showScolaire = hasScolaire;

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const scopeAllowed = (scope?: CycleScope) => {
    if (!scope || scope === "all") return true;
    if (scope === "uni") return showUni;
    if (scope === "scolaire") return showScolaire;
    return true;
  };

  const navigationGroups = [
    { label: "Mon espace", sources: ["Vue d'ensemble", "Communication"] },
    { label: "Scolarité & personnes", sources: ["Personnes", "Orientation post-BAC"] },
    { label: "Enseignement & résultats", sources: ["Académique (Université)", "Collège & Lycée", "Suivi pédagogique (Université)"] },
    { label: "Organisation & présence", sources: ["Logistique", "Présences"] },
    { label: "Finances", sources: ["Finances"] },
    { label: "Vie étudiante", sources: ["Vie étudiante"] },
    { label: "Administration", sources: ["Configuration"] },
  ].map(group => ({ label: group.label, items: SECTIONS.filter(section => group.sources.includes(section.label) && scopeAllowed(section.scope)).flatMap(section => section.items) }));
  const needle = search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const visibleSections = navigationGroups

    .map((section) => ({
      ...section,
      items: section.items
        .filter((it) => {
          if (!scopeAllowed(it.scope)) return false;
          if (it.url === "/admin/settings" && !isPrincipal) return false;
          if (needle && !(it.title === "__STUDENTS__" ? terms.Students : it.title).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(needle)) return false;
          if (it.module === "equipe") return isPrincipal || can("equipe");
          if (it.module === null || it.module === undefined) return true;
          return can(it.module);
        })
        .map((it) => ({
          ...it,
          title: it.title === "__STUDENTS__" ? `${terms.Students}` : it.title,
        })),
    }))
    .filter((s) => s.items.length > 0);

  const displayName = institution?.name || "Rectorplus";
  const linkClass = "app-simple-link";
  const activeClass = "app-simple-link-active";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border/50"><WorkspaceBrand label="Administration" /><div className="mt-5 group-data-[collapsible=icon]:hidden"><AccountMenu sidebar role="Administration" /></div></SidebarHeader>

      <SidebarContent className="admin-navigation px-2 py-3">
        {!collapsed && <div className="px-3 pb-3"><input className="sidebar-search" aria-label="Rechercher un menu" placeholder="Rechercher un menu…" value={search} onChange={event => setSearch(event.target.value)} /></div>}
        {visibleSections.map((section) => (
          <SidebarGroup key={section.label} className="mb-1"><details key={`${section.label}:${pathname}:${!!needle}`} open={collapsed || !!needle || section.label === "Mon espace" || section.items.some(item => item.end ? pathname === item.url : pathname === item.url || pathname.startsWith(item.url + "/"))}>
            <summary className="sidebar-section-summary"><SidebarGroupLabel asChild><span className="text-sidebar-foreground/60 text-[11px] uppercase tracking-wider font-semibold px-3">
              {!collapsed && section.label}
            </span></SidebarGroupLabel></summary>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="h-auto rounded-lg">
                      <NavLink
                        to={item.url}
                        end={item.end ?? true}
                        className={linkClass}
                        activeClassName={activeClass}
                      >
                        <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span className="text-sm truncate">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </details></SidebarGroup>
        ))}
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
