import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns only profiles that have role='user' (students) for the current institution.
 * Excludes admins, professors, super_admins from student lists.
 */
export const useInstitutionStudents = (selectFields?: string) => {
  const { profile } = useAuth();
  const instId = profile?.institution_id;

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["institution-students", instId, selectFields],
    queryFn: async () => {
      // First get all user_ids with role 'user' (students)
      const { data: studentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "user");
      
      if (!studentRoles || studentRoles.length === 0) return [];
      
      const studentUserIds = studentRoles.map((r: any) => r.user_id);
      
      // Then get profiles for these users, filtered by institution
      let q = supabase.from("profiles").select(selectFields || "*");
      if (instId) q = q.eq("institution_id", instId);
      q = q.in("user_id", studentUserIds);
      const { data } = await q.order("last_name");
      return data || [];
    },
    enabled: !!instId,
  });

  return { students, isLoading, instId };
};
