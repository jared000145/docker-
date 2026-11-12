import WorkspaceBrand from '@/components/account/WorkspaceBrand';
import AccountMenu from '@/components/account/AccountMenu';
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import {
  LayoutDashboard, Building2, Settings, LogOut, Globe2, Shield,
  BadgeCheck, Database, Upload, Wallet, RotateCcw, Inbox,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const p = "/super-admin";

const platformItems = [
  { title: "Tableau de bord", url: p, icon: LayoutDashboard },
  { title: "Préinscriptions", url: `${p}/preinscriptions`, icon: Inbox },
  { title: "Établissements", url: `${p}/institutions`, icon: Building2 },
  { title: "Finances", url: `${p}/finance`, icon: Wallet },
  { title: "Abonnements", url: `${p}/subscriptions`, icon: BadgeCheck },
  { title: "Administrateurs", url: `${p}/admins`, icon: Shield },
];

const settingsItems = [
  { title: "Importer", url: `${p}/import`, icon: Upload },
  { title: "Versions & restauration", url: `${p}/restore`, icon: RotateCcw },
  { title: "Paramètres", url: `${p}/settings`, icon: Settings },
];

const linkClass = "app-simple-link";
const activeClass = "app-simple-link-active";

function MenuGroup({ label, items, collapsed, endMatch, pending=0 }: { label: string; items: typeof platformItems; collapsed: boolean; endMatch?: string; pending?:number }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/60 text-[11px] uppercase tracking-wider font-semibold px-3">
        {!collapsed && label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild className="h-auto rounded-lg">
                <NavLink to={item.url} end={item.url === endMatch} className={linkClass} activeClassName={activeClass}>
                  <item.icon className="mr-3 h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.title}</span>}
                  {!collapsed && item.url.endsWith('/preinscriptions') && pending>0 && <span aria-label={`${pending} demande(s) en attente`} className="ml-auto rounded bg-white/15 px-2 text-xs">{pending}</span>}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function SuperAdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const navigate = useNavigate();
  const { signOut } = useAuth();
  useRealtimeSubscription('institution_preregistrations',[['sa-pending-requests']]);
  const {data:pending=0}=useQuery({queryKey:['sa-pending-requests'],queryFn:async()=>{
    const {count,error}=await supabase.from('institution_preregistrations').select('*',{count:'exact',head:true}).eq('status','pending');
    if(error) throw error;
    return count || 0;
  }});

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border/50"><WorkspaceBrand label="Super administration" /><div className="mt-5 group-data-[collapsible=icon]:hidden"><AccountMenu sidebar role="Super administration" /></div></SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <MenuGroup label="Plateforme" items={platformItems} collapsed={collapsed} endMatch={p} pending={pending} />
        <MenuGroup label="Configuration" items={settingsItems} collapsed={collapsed} />
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
