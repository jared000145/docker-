import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle2, FileWarning, GraduationCap, Lock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EVAL_MODE_BADGE } from "@/pages/admin/AdminSubjectsPage";

interface Props {
  onScheduleExam?: (subject: any, kind: "final" | "rattrapage") => void;
}

const ExamPlanningView = ({ onScheduleExam }: Props) => {
  const { profile } = useAuth();
  const { selectedYear, isViewingHistory } = useAcademicYear();
  const instId = profile?.institution_id;
  const qc = useQueryClient();
  const [filterFiliere, setFilterFiliere] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");

  const { data: subjects = [] } = useQuery({
    queryKey: ["exam-planning-subjects", instId, selectedYear],
    queryFn: async () => {
      if (!instId) return [];
      const { data } = await supabase
        .from("subjects")
        .select("id, name, code, filiere_id, level, professor, evaluation_mode, semester, academic_year, filieres(name)")
        .eq("institution_id", instId);
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["exam-planning-filieres", instId],
    queryFn: async () => {
      if (!instId) return [];
      const { data } = await supabase.from("filieres").select("id, name").eq("institution_id", instId);
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["exam-planning-grades", instId, selectedYear],
    queryFn: async () => {
      if (!instId) return [];
      const { data } = await supabase
        .from("grades")
        .select("subject_id, exam_grade, average, user_id")
        .eq("institution_id", instId)
        .eq("academic_year", selectedYear);
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: scheduled = [] } = useQuery({
    queryKey: ["exam-planning-schedule", instId, selectedYear],
    queryFn: async () => {
      if (!instId) return [];
      const { data } = await supabase
        .from("schedule_events")
        .select("id, subject_id, event_type, exam_kind, start_time, end_time")
        .eq("institution_id", instId)
        .eq("academic_year", selectedYear)
        .in("event_type", ["exam", "rattrapage"]);
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: validations = [] } = useQuery({
    queryKey: ["exam-planning-validations", instId, selectedYear],
    queryFn: async () => {
      if (!instId) return [];
      const { data } = await supabase
        .from("course_validation")
        .select("id, subject_id, filiere_id, is_validated, academic_year")
        .eq("institution_id", instId)
        .eq("academic_year", selectedYear);
      return data || [];
    },
    enabled: !!instId,
  });

  const validateMutation = useMutation({
    mutationFn: async ({ subject, validated }: { subject: any; validated: boolean }) => {
      if (!instId || !subject.filiere_id) throw new Error("Filière requise");
      const existing = validations.find(
        (v: any) => v.subject_id === subject.id && v.filiere_id === subject.filiere_id,
      );
      if (existing) {
        const { error } = await supabase
          .from("course_validation")
          .update({ is_validated: validated, validated_by: profile?.user_id, validated_at: new Date().toISOString() })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("course_validation").insert({
          institution_id: instId,
          filiere_id: subject.filiere_id,
          subject_id: subject.id,
          academic_year: selectedYear,
          is_validated: validated,
          validated_by: profile?.user_id,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exam-planning-validations"] });
      toast.success("Validation mise à jour");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Compute per-subject status
  const rows = useMemo(() => {
    return subjects
      .filter((s: any) => filterFiliere === "all" || s.filiere_id === filterFiliere)
      .filter((s: any) => filterLevel === "all" || s.level === filterLevel)
      .map((s: any) => {
        const subjGrades = grades.filter((g: any) => g.subject_id === s.id);
        const examGrades = subjGrades.filter((g: any) => g.exam_grade !== null && g.exam_grade !== undefined);
        const hasExamGrade = examGrades.length > 0;

        const failingStudents = subjGrades.filter(
          (g: any) => g.average !== null && g.average !== undefined && Number(g.average) < 10,
        );
        const allValidatedByStudents = subjGrades.length > 0 && failingStudents.length === 0;

        const scheduledFinal = scheduled.find((e: any) => e.subject_id === s.id && (e.exam_kind === "final" || (e.event_type === "exam" && !e.exam_kind)));
        const scheduledRattrapage = scheduled.find((e: any) => e.subject_id === s.id && (e.exam_kind === "rattrapage" || e.event_type === "rattrapage"));

        const validation = validations.find(
          (v: any) => v.subject_id === s.id && v.filiere_id === s.filiere_id,
        );
        const isValidated = validation?.is_validated === true || allValidatedByStudents;

        let status: "validated" | "needs_final" | "needs_rattrapage" | "in_progress" = "in_progress";
        if (isValidated) status = "validated";
        else if (!hasExamGrade) status = "needs_final";
        else if (failingStudents.length > 0) status = "needs_rattrapage";

        return {
          subject: s,
          status,
          hasExamGrade,
          examGradesCount: examGrades.length,
          gradesCount: subjGrades.length,
          failingCount: failingStudents.length,
          scheduledFinal,
          scheduledRattrapage,
          validation,
          isValidated,
        };
      });
  }, [subjects, grades, scheduled, validations, filterFiliere, filterLevel]);

  const needsFinal = rows.filter((r) => r.status === "needs_final");
  const needsRattrapage = rows.filter((r) => r.status === "needs_rattrapage");
  const validated = rows.filter((r) => r.status === "validated");
  const inProgress = rows.filter((r) => r.status === "in_progress");

  const Section = ({
    title,
    icon,
    items,
    tone,
    emptyText,
    kind,
  }: any) => (
    <Card className="glass-card-elevated border-border/50">
      <CardContent className="p-0">
        <div className={`flex items-center gap-2 p-4 border-b border-border/50 ${tone}`}>
          {icon}
          <h3 className="font-semibold text-sm">{title}</h3>
          <Badge variant="outline" className="ml-auto">{items.length}</Badge>
        </div>
        <div className="divide-y divide-border/40">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">{emptyText}</p>
          ) : items.map((r: any) => (
            <div key={r.subject.id} className={`p-3 flex flex-wrap items-center gap-3 hover:bg-secondary/20 transition-colors ${r.status === "validated" ? "opacity-60" : ""}`}>
              <div className="flex-1 min-w-[200px]">
                <p className="text-sm font-medium text-foreground">{r.subject.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.subject.filieres?.name || "—"} · {r.subject.level} · {r.subject.semester}
                  {" · "}
                  <span className="text-accent">{EVAL_MODE_BADGE[r.subject.evaluation_mode || "prof_full"]}</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {r.gradesCount} note(s) · {r.examGradesCount} examen(s) saisi(s)
                  {r.failingCount > 0 && <span className="text-destructive"> · {r.failingCount} étudiant(s) en échec</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {r.status === "needs_final" && !isViewingHistory && (
                  <Button size="sm" variant="outline" onClick={() => onScheduleExam?.(r.subject, "final")}>
                    Programmer
                  </Button>
                )}
                {r.status === "needs_rattrapage" && !isViewingHistory && (
                  <Button size="sm" variant="outline" onClick={() => onScheduleExam?.(r.subject, "rattrapage")}>
                    Programmer rattrapage
                  </Button>
                )}
                {r.status !== "validated" && !isViewingHistory && r.subject.filiere_id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => validateMutation.mutate({ subject: r.subject, validated: true })}
                    disabled={validateMutation.isPending}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Valider
                  </Button>
                )}
                {r.status === "validated" && r.validation && !isViewingHistory && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => validateMutation.mutate({ subject: r.subject, validated: false })}
                    disabled={validateMutation.isPending}
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Rouvrir
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Select value={filterFiliere} onValueChange={setFilterFiliere}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filière" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les filières</SelectItem>
            {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Niveau" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous niveaux</SelectItem>
            {["L1","L2","L3","M1","M2"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Section
          title="Matières nécessitant un examen final"
          icon={<FileWarning className="w-4 h-4 text-amber-500" />}
          tone="bg-amber-500/5"
          items={needsFinal}
          kind="final"
          emptyText="Aucune matière en attente d'examen final."
        />
        <Section
          title="Matières nécessitant un rattrapage"
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
          tone="bg-destructive/5"
          items={needsRattrapage}
          kind="rattrapage"
          emptyText="Aucune matière à rattraper."
        />
        <Section
          title="En cours / sans notes"
          icon={<GraduationCap className="w-4 h-4 text-info" />}
          tone="bg-info/5"
          items={inProgress}
          emptyText="Aucune matière en cours."
        />
        <Section
          title="Matières validées (clôturées)"
          icon={<Lock className="w-4 h-4 text-emerald-500" />}
          tone="bg-emerald-500/5"
          items={validated}
          emptyText="Aucune matière validée."
        />
      </div>
    </div>
  );
};

export default ExamPlanningView;
