import WorkspaceBrand from '@/components/account/WorkspaceBrand';
import AccountMenu from '@/components/account/AccountMenu';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useCycle } from "@/hooks/useCycle";
import {
  LayoutDashboard, BookOpen, ClipboardList, Calendar,
  MessageSquare, Bell, LogOut, GraduationCap, Video, ClipboardCheck, Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const profItems = [
  { title: "Tableau de bord", url: "/professor", icon: LayoutDashboard },
  { title: "Mes cours", url: "/professor/subjects", icon: BookOpen },
  { title: "Saisie des notes", url: "/professor/grades", icon: ClipboardList },
  { title: "Faire l'appel", url: "/professor/attendance", icon: ClipboardCheck },
  { title: "Visioconférence", url: "/professor/visio", icon: Video },
  { title: "Planning", url: "/professor/schedule", icon: Calendar },
  { title: "Messages", url: "/professor/messages", icon: MessageSquare },
  { title: "Notifications", url: "/professor/notifications", icon: Bell },
  { title: "Paramètres", url: "/professor/settings", icon: Settings },
];


export function ProfessorSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { institution } = useInstitution();
  const { hasUniversite } = useCycle();
  const visibleItems = hasUniversite ? profItems : profItems.filter((i) => i.url !== "/professor/visio");

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const displayName = institution?.name || "Rectorplus";
  const linkClass = "app-simple-link";
  const activeClass = "app-simple-link-active";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border"><WorkspaceBrand label="Enseignement" /><div className="mt-5 group-data-[collapsible=icon]:hidden"><AccountMenu sidebar role="Enseignement" /></div></SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-[11px] uppercase tracking-wider font-semibold px-3">
            {!collapsed && "Enseignement"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-auto rounded-lg">
                    <NavLink to={item.url} end={item.url === "/professor"} className={linkClass} activeClassName={activeClass}>
                      <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
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
            <SidebarMenuButton onClick={handleLogout} className="h-auto rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/75 hover:bg-destructive/10 hover:text-destructive">
              <LogOut className="mr-3 h-5 w-5" />
              {!collapsed && <span>Quitter</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
