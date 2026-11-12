import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

/**
 * Returns badge counts per "module" key used in the validator sidebar extras.
 * Currently surfaces:
 *  - paiements: payments en attente / partiels de l'établissement
 *  - communaute: notifications non lues pour l'utilisateur
 *  - releves: statuts annuels en attente (étudiants sans décision)
 *  - soutenances: soutenances à venir
 */
export const useModuleBadges = () => {
  const { user, profile } = useAuth();
  const instId = profile?.institution_id;

  const { data: paiements = 0 } = useQuery({
    queryKey: ["badge-paiements", instId],
    enabled: !!instId,
    queryFn: async () => {
      const { count } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("institution_id", instId!)
        .neq("status", "paid");
      return count || 0;
    },
    staleTime: 30_000,
  });

  const { data: notifications = 0 } = useQuery({
    queryKey: ["badge-notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      return count || 0;
    },
    staleTime: 15_000,
  });

  const { data: soutenances = 0 } = useQuery({
    queryKey: ["badge-soutenances", instId],
    enabled: !!instId,
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { count } = await supabase
        .from("soutenances")
        .select("id", { count: "exact", head: true })
        .eq("institution_id", instId!)
        .gte("soutenance_date", today);
      return count || 0;
    },
    staleTime: 60_000,
  });

  useRealtimeSubscription("payments", [["badge-paiements", instId || ""]], instId ? { column: "institution_id", value: instId } : undefined);
  useRealtimeSubscription("notifications", [["badge-notifications", user?.id || ""]], user ? { column: "user_id", value: user.id } : undefined);

  return {
    paiements,
    communaute: notifications,
    soutenances,
  } as Record<string, number>;
};
