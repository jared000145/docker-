import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const normalize = (v?: string | null) =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const nameMatches = (profStr: string | null | undefined, profile?: { first_name?: string | null; last_name?: string | null }) => {
  const p = normalize(profStr);
  if (!p) return false;
  const first = normalize(profile?.first_name);
  const last = normalize(profile?.last_name);
  const full = normalize(`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`);
  const tokens = p.split(" ").filter(Boolean);
  if (full && (p === full || p.includes(full))) return true;
  if (first && last && tokens.includes(first) && tokens.includes(last)) return true;
  return p === first || p === last;
};

export interface ProfClassSubject {
  id: string;
  classe_id: string;
  subject_id: string;
  coefficient: number;
  classe: { id: string; nom: string; niveau: string; serie: string | null; cycle: string } | null;
  subject: { id: string; name: string; code: string | null; professor: string | null } | null;
}

/**
 * Affectations Collège/Lycée du professeur connecté (table subject_classes).
 * Renvoie la liste « matière × classe » dont il a la charge.
 */
export const useProfessorClasses = () => {
  const { user, profile } = useAuth();

  return useQuery({
    queryKey: ["prof-class-subjects", user?.id, profile?.institution_id, profile?.first_name, profile?.last_name],
    enabled: !!profile?.institution_id,
    queryFn: async (): Promise<ProfClassSubject[]> => {
      const { data, error } = await (supabase as any)
        .from("subject_classes")
        .select("id, classe_id, subject_id, coefficient, professor_user_id, professor_name, classe:classes(id,nom,niveau,serie,cycle), subject:subjects(id,name,code,professor)")
        .eq("institution_id", profile!.institution_id!);
      if (error) throw error;
      const rows = (data || []) as any[];
      const mine = rows.filter(r => r.professor_user_id === user?.id);
      return mine.sort((a, b) => {
        const ca = `${a.classe?.niveau || ""} ${a.classe?.nom || ""}`;
        const cb = `${b.classe?.niveau || ""} ${b.classe?.nom || ""}`;
        return ca.localeCompare(cb) || (a.subject?.name || "").localeCompare(b.subject?.name || "");
      });
    },
  });
};

/** Élèves rattachés à une classe */
export const useClassStudents = (classeId?: string) => {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ["class-students", classeId, profile?.institution_id],
    enabled: !!classeId && !!profile?.institution_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number, avatar_url, sexe")
        .eq("institution_id", profile!.institution_id!)
        .eq("classe_id", classeId!)
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return data || [];
    },
  });
};
