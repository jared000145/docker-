import {institutionCycles} from '@/lib/academicCycles';
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useInstitution = () => {
  const { user, profile } = useAuth();

  const { data: institutionData, isLoading } = useQuery({
    queryKey: ["user-institution", user?.id, profile?.institution_id],
    queryFn: async () => {
      let institutionId = profile?.institution_id;

      if (!institutionId && user?.id) {
        const { data: freshProfile, error: profileError } = await supabase
          .from("profiles")
          .select("institution_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        institutionId = freshProfile?.institution_id || null;
      }

      if (!institutionId) return null;

      const { data, error } = await (supabase as any)
        .from("institutions")
        .select("*")
        .eq("id", institutionId)
        .maybeSingle();

      if (error) throw error;

      return data as Record<string, any> | null;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const [institution, setInstitution] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    if (!user) {
      setInstitution(null);
      return;
    }

    if (institutionData) {
      setInstitution(institutionData);
    }
  }, [institutionData, user]);

  const UNIVERSITY_LEVELS = ["L1", "L2", "L3", "M1", "M2"];
  const COLLEGE_LEVELS = ["6e", "5e", "4e", "3e"];
  const LYCEE_LEVELS = ["2nde", "1ère", "Terminale"];
  const HIGHSCHOOL_LEVELS = [...COLLEGE_LEVELS, ...LYCEE_LEVELS];

  const enabledCycles = institutionCycles(institution);
  const hasUniversite = enabledCycles.includes('universite');
  const hasCollege = enabledCycles.includes('college');
  const hasLycee = enabledCycles.includes('lycee');
  const scolaireOnly = (hasCollege || hasLycee) && !hasUniversite;

  const getLevels = () => {
    if (scolaireOnly) {
      const levels = [...(hasCollege ? COLLEGE_LEVELS : []), ...(hasLycee ? LYCEE_LEVELS : [])];
      return levels.length > 0 ? levels : HIGHSCHOOL_LEVELS;
    }
    return UNIVERSITY_LEVELS;
  };

  const isUniversity = hasUniversite;
  const isHighschool = scolaireOnly;

  return { institution, isLoading, getLevels, isUniversity, isHighschool, UNIVERSITY_LEVELS, HIGHSCHOOL_LEVELS };
};
