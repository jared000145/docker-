import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

/**
 * Returns the number of document_validations pending for the current user's column
 * (pedagogique / cycle). Realtime via document_validations subscription.
 */
export const usePendingValidationsCount = () => {
  const { user, profile } = useAuth();
  const { hasPerm, isLoading } = usePermissions();

  const seesPedagogique = hasPerm("view_pedagogique_validation");
  const seesCycle = hasPerm("view_cycle_validation");
  const instId = profile?.institution_id;

  const query = useQuery({
    queryKey: ["pending-validations-count", user?.id, instId, seesPedagogique, seesCycle],
    queryFn: async () => {
      if (!instId || (!seesPedagogique && !seesCycle)) return 0;
      const q = supabase
        .from("document_validations")
        .select("id, document_type, pedagogique_status, cycle_status", { count: "exact", head: false })
        .eq("institution_id", instId)
        .eq("status", "pending");
      const { data, error } = await q;
      if (error) return 0;
      return (data || []).filter((d: any) => {
        // Attestations: only pédagogique validates
        if (d.document_type === "attestation") {
          return seesPedagogique && d.pedagogique_status === "pending";
        }
        const ped = d.pedagogique_status === "pending" && seesPedagogique;
        const cyc = d.cycle_status === "pending" && seesCycle;
        return ped || cyc;
      }).length;
    },
    enabled: !!user && !isLoading && !!instId,
    staleTime: 15_000,
  });

  useRealtimeSubscription(
    "document_validations",
    [["pending-validations-count", user?.id || "", instId || "", String(seesPedagogique), String(seesCycle)]],
    instId ? { column: "institution_id", value: instId } : undefined
  );

  return query.data ?? 0;
};
