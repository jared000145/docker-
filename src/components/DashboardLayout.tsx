import AccountMenu from '@/components/account/AccountMenu';
import PageTransition from "@/components/PageTransition";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useNavigate } from "react-router-dom";
import { Bell, Search, CalendarDays, History } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { AcademicYearProvider, useAcademicYear } from "@/hooks/useAcademicYear";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSubscription } from "@/hooks/useSubscription";
import { SubscriptionExpiredScreen } from "@/components/admin/SubscriptionExpiredScreen";
import AdminChatbot from "@/components/admin/AdminChatbot";
import { AccessBanner } from "@/components/AccessGuard";
import { useCycle } from "@/hooks/useCycle";

const DashboardLayoutInner = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { selectedYear, setSelectedYear, availableYears, isViewingHistory, currentYear, isStudent, selectedYearLevel, currentLevel } = useAcademicYear();
  const { isExpired, isLoading: subLoading } = useSubscription();

  const { hasCollege, hasLycee, hasUniversite } = useCycle();
  const isSchool = (hasCollege || hasLycee) && !hasUniversite;

  const { data: filiereName } = useQuery({
    queryKey: ["filiere-name", profile?.filiere_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("filieres")
        .select("name")
        .eq("id", profile!.filiere_id!)
        .single();
      return data?.name || null;
    },
    enabled: !!profile?.filiere_id && !isSchool,
  });

  const { data: classeInfo } = useQuery({
    queryKey: ["header-classe", (profile as any)?.classe_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("nom, niveau, serie")
        .eq("id", (profile as any)!.classe_id!)
        .maybeSingle();
      return data as any;
    },
    enabled: !!(profile as any)?.classe_id && isSchool,
  });

  const headerSubtitle = isSchool
    ? classeInfo?.nom ||
      [(classeInfo as any)?.niveau || profile?.level, (classeInfo as any)?.serie]
        .filter(Boolean)
        .join(" ") ||
      "Classe non affectée"
    : `${profile?.level || ""} ${filiereName || profile?.department || ""}`.trim();

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

  if (!subLoading && isExpired) return <SubscriptionExpiredScreen />;

  return (
    <SidebarProvider>
      <div className="app-shell min-h-svh flex w-full overflow-x-hidden">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="app-header min-h-16 flex items-center justify-between gap-2 px-3 py-2 sm:px-4 lg:px-6 sticky top-0 z-10">
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
              <SidebarTrigger className="text-foreground hover:bg-muted hover:text-foreground" />
              {/* Academic Year Selector */}
              {availableYears.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="h-11 w-[150px] bg-card text-xs font-semibold border-border sm:w-[170px] sm:text-sm [&>span]:flex [&>span]:items-center [&>span]:truncate">
                      <CalendarDays className="w-3.5 h-3.5 mr-1 text-muted-foreground flex-shrink-0" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="min-w-[190px]">
                      {availableYears.map(y => (
                        <SelectItem key={y} value={y} textValue={y} className="py-2 pr-3">
                          <span className="inline-flex items-center gap-2 whitespace-nowrap font-medium leading-none">
                            <span>{y}</span>
                            {y === currentYear && <span className="text-[11px] font-semibold text-muted-foreground">actuelle</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isViewingHistory && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-warning/10 text-warning border-warning/30 gap-1 hidden sm:flex">
                      <History className="w-3 h-3" /> Historique
                    </Badge>
                  )}
                </div>
              )}
              {/* Show current year badge when only one year */}
              {availableYears.length <= 1 && (
                <Badge variant="secondary" className="text-xs px-2 py-1 gap-1.5 max-w-[48vw] truncate">
                  <CalendarDays className="w-3.5 h-3.5" /> {currentYear}
                </Badge>
              )}
              <div className="hidden lg:block relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  className="h-11 w-64 bg-muted border-border pl-9 font-medium"
                />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              <button onClick={() => navigate("/notifications")} className="relative flex min-h-11 min-w-11 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted" aria-label="Notifications">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
              <AccountMenu role="Mon espace" />
            </div>
          </header>

          {/* History banner */}
          {isViewingHistory && (
            <div className="bg-gradient-to-r from-warning/15 via-warning/10 to-transparent border-b border-warning/30 px-4 sm:px-6 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/20 text-warning">
                    <History className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm sm:text-base font-bold text-foreground truncate">
                        {selectedYearLevel ? `${selectedYearLevel} (${selectedYear})` : `Année académique ${selectedYear}`}
                      </h2>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wide bg-warning/15 text-warning border-warning/40">
                        Historique
                      </Badge>
                    </div>
                    {isStudent && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Vous consultez votre année passée{selectedYearLevel ? ` : ${selectedYearLevel} (${selectedYear})` : ` : ${selectedYear}`}. Revenez à l'année en cours pour voir vos données actuelles.
                      </p>
                    )}
                    {!isStudent && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Vous consultez l'historique de l'année <strong>{selectedYear}</strong>.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedYear(currentYear)}
                  className="shrink-0 inline-flex items-center gap-2 rounded-full bg-warning text-warning-foreground hover:bg-warning/90 px-4 py-2 text-xs sm:text-sm font-semibold transition-colors shadow-sm"
                >
                  <CalendarDays className="w-4 h-4" />
                  Retour à l'année en cours ({currentYear})
                </button>
              </div>
            </div>
          )}

          {/* Current year indicator for students */}
          {!isViewingHistory && isStudent && currentLevel && (
            <div className="bg-primary/5 border-b border-primary/15 px-4 sm:px-6 py-2 flex items-center justify-between gap-2">
              <p className="text-xs sm:text-sm text-foreground flex items-center gap-2 min-w-0">
                <CalendarDays className="w-4 h-4 text-primary shrink-0" />
                <span className="font-semibold truncate">{currentLevel} ({currentYear})</span>
                <Badge variant="secondary" className="text-[10px] bg-primary/15 text-primary border-primary/30 hidden sm:inline-flex">
                  Année en cours
                </Badge>
              </p>
            </div>
          )}

          <main className="app-surface flex-1 min-w-0 overflow-x-hidden overflow-y-auto p-3 sm:p-5 lg:p-7">
            <AccessBanner />
            <PageTransition />
          </main>
        </div>
      </div>
      <AdminChatbot />
    </SidebarProvider>
  );
};

const DashboardLayout = () => (
  <AcademicYearProvider>
    <DashboardLayoutInner />
  </AcademicYearProvider>
);

export default DashboardLayout;
