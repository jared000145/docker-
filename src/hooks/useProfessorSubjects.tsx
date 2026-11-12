import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const normalize = (v?: string | null) =>
  (v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const matches = (profStr?: string | null, profile?: { first_name?: string | null; last_name?: string | null }) => {
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

export interface ProfSubjectInfo {
  subject: any;
  studentCount: number;
  lastSessionEnd: Date | null;
  isArchived: boolean;
}

export const useProfessorSubjects = () => {
  const { profile, user } = useAuth();

  return useQuery({
    queryKey: ["prof-subjects-full", profile?.institution_id, user?.id],
    queryFn: async (): Promise<ProfSubjectInfo[]> => {
      if (!profile?.institution_id) return [];
      const [{ data: subjectsRaw }, { data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("subjects").select("*, filieres(name)").eq("institution_id", profile.institution_id).order("name"),
        supabase.from("profiles").select("user_id, filiere_id, level").eq("institution_id", profile.institution_id),
        supabase.from("user_roles").select("user_id, role").eq("role", "user" as any),
      ]);
      const mine = (subjectsRaw || []).filter((s: any) => s.professor_user_id === user?.id);
      if (mine.length === 0) return [];
      const studentIds = new Set((roles || []).map((r: any) => r.user_id));
      const students = (profiles || []).filter((p: any) => studentIds.has(p.user_id));

      const subjectIds = mine.map((s: any) => s.id);
      const [{ data: evts }, { data: enrolls }] = await Promise.all([
        supabase.from("schedule_events").select("subject_id, end_time").in("subject_id", subjectIds),
        supabase.from("enrollments").select("subject_id, user_id").in("subject_id", subjectIds),
      ]);
      const lastEnd: Record<string, Date> = {};
      (evts || []).forEach((e: any) => {
        const d = new Date(e.end_time);
        if (!lastEnd[e.subject_id] || d > lastEnd[e.subject_id]) lastEnd[e.subject_id] = d;
      });
      const enrollMap: Record<string, Set<string>> = {};
      (enrolls || []).forEach((e: any) => {
        (enrollMap[e.subject_id] ||= new Set()).add(e.user_id);
      });

      const now = new Date();
      return mine.map((s: any) => {
        const enrolled = enrollMap[s.id];
        let count = 0;
        if (enrolled && enrolled.size > 0) {
          count = enrolled.size;
        } else {
          count = students.filter((p: any) =>
            (!s.filiere_id || p.filiere_id === s.filiere_id) && (!s.level || p.level === s.level)
          ).length;
        }
        const last = lastEnd[s.id] || null;
        return {
          subject: s,
          studentCount: count,
          lastSessionEnd: last,
          isArchived: !!(last && last < now),
        };
      });
    },
    enabled: !!profile?.institution_id,
  });
};
