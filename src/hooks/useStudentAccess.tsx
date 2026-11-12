import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type StudentAccess = {
  allowed: boolean;
  status: string;
  reason: string | null;
  restricted: string[];
};

export function useStudentAccess() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["student-access", user?.id],
    enabled: !!user?.id,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<StudentAccess> => {
      const { data, error } = await supabase.rpc("get_student_access", { _user_id: user!.id });
      if (error) throw error;
      const r = data as any;
      return {
        allowed: !!r?.allowed,
        status: r?.status ?? "active",
        reason: r?.reason ?? null,
        restricted: Array.isArray(r?.restricted) ? r.restricted : [],
      };
    },
  });
}

export function useFeatureBlocked(feature: string): boolean {
  const { data } = useStudentAccess();
  if (!data) return false;
  if (!data.allowed) return true;
  return data.restricted.includes("all") || data.restricted.includes(feature);
}
