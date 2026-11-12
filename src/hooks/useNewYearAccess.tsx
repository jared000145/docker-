import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Vérifie côté serveur si l'étudiant est à jour de ses frais
 * marqués "débloque la nouvelle année".
 */
export function useNewYearAccess() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["has-new-year-access", user?.id],
    queryFn: async () => {
      if (!user) return true;
      const { data, error } = await supabase.rpc("has_new_year_access", { _user_id: user.id });
      if (error) {
        console.error("has_new_year_access error", error);
        return true; // fail-open pour ne pas casser l'UX
      }
      return Boolean(data);
    },
    enabled: !!user,
    staleTime: 60_000,
  });
  return { hasAccess: data ?? true, isLoading };
}
