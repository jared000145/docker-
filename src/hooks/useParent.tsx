import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export const useParent = () => {
  const { user } = useAuth();

  const { data: isParent = false, isLoading } = useQuery({
    queryKey: ["is-parent", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "parent" as any)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: children = [], isLoading: childrenLoading, error: childrenError } = useQuery({
    queryKey: ["parent-children", user?.id],
    refetchInterval: 15000,
    queryFn: async () => {
      if (!user) return [];
      const { data: parentRow } = await supabase
        .from("parents" as any)
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!parentRow) return [];
      const { data: links } = await supabase
        .from("parent_students" as any)
        .select("student_user_id")
        .eq("parent_id", (parentRow as any).id);
      const ids = (links || []).map((l: any) => l.student_user_id);
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, avatar_url, student_number, level, filiere_id, email, phone, academic_year, date_of_birth, birth_place, classe_id")
        .in("user_id", ids);
      return profs || [];
    },
    enabled: !!user && isParent,
  });

  return { isParent, isLoading: isLoading || childrenLoading, children, childrenError };
};
