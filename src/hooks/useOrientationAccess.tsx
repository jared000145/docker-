import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const FINAL_LEVEL_RE = /(terminale|tle|term\.|t-?le|bac\s*\+?\s*0)/i;

export function isFinalYearLevel(level?: string | null) {
  if (!level) return false;
  return FINAL_LEVEL_RE.test(level.trim());
}

/**
 * L'orientation post-BAC n'est ouverte qu'aux élèves de dernière année (Terminale)
 * et aux étudiants déjà post-bac.
 */
export function useOrientationAccess() {
  const { user, profile } = useAuth();
  const classeId = (profile as any)?.classe_id as string | undefined;

  const { data: classe, isLoading } = useQuery({
    queryKey: ["orientation-classe", classeId],
    enabled: !!classeId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("nom, niveau, cycle, serie")
        .eq("id", classeId!)
        .maybeSingle();
      return data as any;
    },
  });

  const postBac = !!(profile as any)?.post_bac || /^(L[1-3]|M[12]|D[1-3]|BTS|Licence|Master|Doctorat)/i.test(String(profile?.level||'').trim());
  const levelFromProfile = (profile as any)?.level as string | undefined;
  const isFinalYear =
    isFinalYearLevel(classe?.niveau) ||
    isFinalYearLevel(classe?.nom) ||
    isFinalYearLevel(levelFromProfile);

  return {
    loading: !!classeId && isLoading,
    canAccess: !!user && (postBac || isFinalYear),
    isFinalYear,
    postBac,
    classe,
  };
}
