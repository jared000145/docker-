import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useProfessor = () => {
  const { user } = useAuth();

  const { data: isProfessor = false, isLoading } = useQuery({
    queryKey: ["user-role-professor", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "professor")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  return { isProfessor, isLoading };
};
