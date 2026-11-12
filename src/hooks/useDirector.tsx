import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns whether the current user is a "Directeur" team member.
 * A directeur has its own dedicated interface and limited modules.
 */
export const useDirector = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["director-flag", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("team_members")
        .select("id, team_role, institution_id, first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 15_000,
    refetchInterval: 15_000,
  });

  return {
    isDirector: (data as any)?.team_role === "directeur",
    director: data,
    isLoading,
  };
};
