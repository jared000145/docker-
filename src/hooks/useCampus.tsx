import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

export interface Campus {
  id: string;
  institution_id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  cycle: "lmd" | "bts";
  is_active: boolean;
  is_main: boolean;
}

interface CampusContextValue {
  /** All campuses available to the user (admin: every campus of his institution; otherwise just his own). */
  campuses: Campus[];
  /** Currently selected campus (or null = all/global view for super admin & admin only). */
  currentCampus: Campus | null;
  /** Active campus id used for filtering queries (null means "all campuses"). */
  campusId: string | null;
  /** Whether the user can switch campus (super admin & admin). */
  canSwitch: boolean;
  canViewAll: boolean;
  /** Pick a new campus (null = all). */
  setCampusId: (id: string | null) => void;
  isLoading: boolean;
  refetch: () => void;
}

const CampusContext = createContext<CampusContextValue | undefined>(undefined);

const STORAGE_KEY = "scolarplus:active-campus";

export const CampusProvider = ({ children }: { children: ReactNode }) => {
  const { user, profile } = useAuth();
  const { isPrincipal, isLoading: permissionsLoading } = usePermissions();
  const { isSuperAdmin } = useSuperAdmin();
  const scope = useQuery({queryKey:['my-campus-scope',user?.id],enabled:!!user,refetchInterval:15000,queryFn:async()=>{const {data,error}=await (supabase as any).rpc('my_campus_scope');if(error)throw error;return data===true;}});
  const canSwitch = isSuperAdmin || isPrincipal || scope.data===true;

  const { data: campuses = [], isLoading, refetch } = useQuery({
    queryKey: ["campuses-for-user", user?.id, profile?.institution_id, canSwitch],
    enabled: !!user && !permissionsLoading,
    queryFn: async () => {
      if (!profile?.institution_id) return [];
      const q = (supabase as any).from("campuses").select("*").eq("institution_id", profile.institution_id).order("is_main", { ascending: false }).order("name");
      const { data, error } = await q;
      if (error) throw error;
      const all = (data || []) as Campus[];
      if (canSwitch) return all;
      // Non-admin users: only their own campus (from profile or campus_staff)
      const ownIds = new Set<string>();
      if (profile?.campus_id) ownIds.add(profile.campus_id);
      const { data: staff } = await (supabase as any)
        .from("campus_staff")
        .select("campus_id")
        .eq("user_id", user!.id);
      (staff || []).forEach((s: any) => ownIds.add(s.campus_id));
      const filtered = all.filter((c) => ownIds.has(c.id));
      return filtered.filter(c => c.is_active);
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [campusId, setCampusIdState] = useState<string | null>(() => {
    try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
  });

  // When list loads, ensure the chosen id is valid
  useEffect(() => {
    if (!campuses.length) { if (!isLoading) setCampusIdState(null); return; }
    if (canSwitch) {
      if (campusId && !campuses.find((c) => c.id === campusId)) setCampusIdState(null);
      return;
    }
    // Non-admin: lock to first available campus
    if (!campusId || !campuses.find((c) => c.id === campusId)) {
      const next = campuses[0].id;
      setCampusIdState(next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch { /* ignore */ }
    }
  }, [campuses, canSwitch, campusId]);

  const setCampusId = (id: string | null) => {
    if (id && !campuses.some(c => c.id === id)) return;
    if (!id && !canSwitch) return;
    setCampusIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  };

  const currentCampus = useMemo(
    () => campuses.find((c) => c.id === campusId) || null,
    [campuses, campusId],
  );

  return (
    <CampusContext.Provider value={{ campuses, currentCampus, campusId: currentCampus?.id || null, canSwitch: canSwitch || campuses.length > 1, canViewAll: canSwitch, setCampusId, isLoading: isLoading || permissionsLoading || scope.isLoading, refetch }}>
      {children}
    </CampusContext.Provider>
  );
};

export const useCampus = () => {
  const ctx = useContext(CampusContext);
  if (!ctx) {
    // Safe fallback (e.g. used outside admin layout)
    return {
      campuses: [] as Campus[],
      currentCampus: null,
      campusId: null,
      canSwitch: false,
      canViewAll: false,
      setCampusId: () => {},
      isLoading: false,
      refetch: () => {},
    } as CampusContextValue;
  }
  return ctx;
};
