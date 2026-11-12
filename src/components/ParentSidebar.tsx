import WorkspaceBrand from '@/components/account/WorkspaceBrand';
import AccountMenu from '@/components/account/AccountMenu';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LayoutDashboard, FileSpreadsheet, ClipboardCheck, CreditCard, Calendar, FolderOpen, Bell, LogOut, Heart } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const ITEMS = [
  { title: "Tableau de bord", url: "/parent/dashboard", icon: LayoutDashboard, end: true },
  { title: "Notes",            url: "/parent/notes",      icon: FileSpreadsheet },
  { title: "Absences",         url: "/parent/absences",   icon: ClipboardCheck },
  { title: "Paiements",        url: "/parent/paiements",  icon: CreditCard },
  { title: "Planning",         url: "/parent/planning",   icon: Calendar },
  { title: "Documents",        url: "/parent/documents",  icon: FolderOpen },
  { title: "Notifications",    url: "/parent/notifications", icon: Bell },
];

export function ParentSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate("/parent/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border/50"><WorkspaceBrand label="Espace parent" /><div className="mt-5 group-data-[collapsible=icon]:hidden"><AccountMenu sidebar role="Espace parent" /></div></SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 text-[11px] uppercase tracking-wider font-semibold px-3">
            {!collapsed && "Suivi"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ITEMS.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-auto rounded-lg">
                    <NavLink to={item.url} end={item.end ?? true} className="app-simple-link" activeClassName="app-simple-link-active">
                      <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span className="text-sm truncate">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-sidebar-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout} className="h-auto rounded-lg px-3 py-2.5 text-sm font-semibold text-sidebar-foreground/75 hover:bg-destructive/10 hover:text-destructive transition-colors">
              <LogOut className="mr-3 h-5 w-5" />
              {!collapsed && <span>Déconnexion</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
