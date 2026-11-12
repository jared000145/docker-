import {useAcademicYear} from '@/hooks/useAcademicYear';
import {useStudentPlacement} from '@/hooks/useStudentPlacement';
import WorkspaceBrand from '@/components/account/WorkspaceBrand';
import AccountMenu from '@/components/account/AccountMenu';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrientationAccess } from "@/hooks/useOrientationAccess";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import {
  LayoutDashboard, BookOpen, ClipboardList, Calendar, CreditCard,
  GraduationCap, MessageSquare, Bell, Settings, LogOut,
  CalendarDays, Users, Globe, IdCard, Video, ClipboardCheck,
  Compass, Briefcase,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Tableau de bord", url: "/dashboard", icon: LayoutDashboard },
  { title: "Mes notes", url: "/grades", icon: ClipboardList },
  { title: "Mes absences", url: "/absences", icon: ClipboardCheck },
  { title: "Mes cours", url: "/courses", icon: BookOpen },
  { title: "Planning", url: "/calendar", icon: Calendar },
  { title: "Paiements", url: "/payments", icon: CreditCard },
  { title: "Mon cursus", url: "/curriculum", icon: GraduationCap },
];

const socialItems = [
  { title: "Événements", url: "/events", icon: CalendarDays },
  { title: "Soutenances", url: "/soutenances", icon: GraduationCap },
  { title: "BDE", url: "/bde", icon: Users },
  { title: "Communauté", url: "/community", icon: Globe },
];

const secondaryItems = [
  { title: "Messages", url: "/messages", icon: MessageSquare },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Cours en visio", url: "/visio", icon: Video },
  { title: "Bibliothèque", url: "/library", icon: BookOpen },
  { title: "Carte virtuelle", url: "/card", icon: IdCard },
  { title: "Paramètres", url: "/settings", icon: Settings },
];

const simpleLinkClass = "app-simple-link relative";
const simpleActiveClass = "app-simple-link-active";

const orientationItems = [
  { title: "Orientation", url: "/orientation", icon: Compass },
  { title: "Mes candidatures", url: "/candidatures", icon: Briefcase },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut, user, profile } = useAuth();
  const { institution } = useInstitution();
  const {selectedYear}=useAcademicYear();
  const {isUniversity:hasUniversite,isSchool}=useStudentPlacement(undefined,selectedYear);
  // Orientation : réservée aux élèves de Terminale (dernière année) et aux post-bac
  const { canAccess: showOrientation } = useOrientationAccess();
  // Collège / Lycée : pas de BDE, événements, soutenances, cursus LMD ni visio
  const visibleSocialItems = hasUniversite
    ? socialItems
    : socialItems.filter((i) => !["/events", "/bde", "/soutenances"].includes(i.url));
  const visibleMainItems = hasUniversite ? mainItems : mainItems.filter((i) => i.url !== "/curriculum");
  const visibleSecondaryItems = hasUniversite ? secondaryItems : secondaryItems.filter((i) => i.url !== "/visio");


  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notif-count", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  useRealtimeSubscription("notifications", [["unread-notif-count", user?.id || ""]], user ? { column: "user_id", value: user.id } : undefined);

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = institution?.name?.trim() || "";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border"><WorkspaceBrand label={isSchool?"Espace élève":"Espace étudiant"} /><div className="mt-5 group-data-[collapsible=icon]:hidden"><AccountMenu sidebar role={isSchool?"Espace élève":"Espace étudiant"} /></div></SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70 text-[11px] uppercase tracking-normal font-semibold px-3">
            {!collapsed && "Académique"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-auto rounded-lg">
                    <NavLink to={item.url} end={item.url === "/dashboard"} className={simpleLinkClass} activeClassName={simpleActiveClass}>
                      <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70 text-[11px] uppercase tracking-normal font-semibold px-3">
            {!collapsed && (isSchool?"Vie scolaire":"Vie étudiante")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSocialItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-auto rounded-lg">
                    <NavLink to={item.url} end className={simpleLinkClass} activeClassName={simpleActiveClass}>
                      <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {showOrientation && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70 text-[11px] uppercase tracking-normal font-semibold px-3">
              {!collapsed && "Orientation"}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {orientationItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild className="h-auto rounded-lg">
                      <NavLink to={item.url} end className={simpleLinkClass} activeClassName={simpleActiveClass}>
                        <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup>
            <SidebarGroupLabel className="text-sidebar-foreground/70 text-[11px] uppercase tracking-normal font-semibold px-3">
            {!collapsed && "Autre"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleSecondaryItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-auto rounded-lg">
                    <NavLink to={item.url} end className={simpleLinkClass} activeClassName={simpleActiveClass}>
                      <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                      {item.url === "/notifications" && unreadCount > 0 && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[20px] h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold flex items-center justify-center">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="min-h-11 rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="mr-3 h-5 w-5" />
              {!collapsed && <span>Quitter</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
