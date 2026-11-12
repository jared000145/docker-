import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { GraduationCap, ChevronRight, ArrowLeft, Save, Loader2, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { toast } from "sonner";

const parseGrade = (val: string): number | null => {
  if (val === "" || val == null) return null;
  const n = parseFloat(String(val).replace(",", "."));
  if (isNaN(n) || n < 0 || n > 20) return null;
  return n;
};
const calcAvg = (cc: number | null, exam: number | null): number | null => {
  if (cc !== null && exam !== null) return Number(Math.max(0, Math.min(20, cc * 0.4 + exam * 0.6)).toFixed(2));
  return null;
};

export function GradesMatrixView() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { getLevels } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const LEVELS = getLevels();
  const instId = profile?.institution_id;

  const [selectedFiliere, setSelectedFiliere] = useState<any>(null);
  const [level, setLevel] = useState<string>(LEVELS[0] || "L1");
  const [subjectId, setSubjectId] = useState<string>("");
  const [semester, setSemester] = useState<string>("S1");
  const [drafts, setDrafts] = useState<Record<string, { cc: string; exam: string }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: filieres = [] } = useQuery({
    queryKey: ["matrix-filieres", instId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: studentCounts = {} } = useQuery({
    queryKey: ["matrix-filiere-counts", instId],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!roles?.length) return {};
      const ids = roles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("filiere_id").in("user_id", ids);
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      const counts: Record<string, number> = {};
      (data || []).forEach((p: any) => { if (p.filiere_id) counts[p.filiere_id] = (counts[p.filiere_id] || 0) + 1; });
      return counts;
    },
    enabled: !!instId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["matrix-subjects", instId, selectedFiliere?.id, level],
    queryFn: async () => {
      if (!selectedFiliere) return [];
      let q = supabase.from("subjects").select("id, name, semester, pv_url").eq("filiere_id", selectedFiliere.id).eq("level", level).order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!selectedFiliere,
  });

  const selectedSubject = (subjects as any[]).find((s) => s.id === subjectId);

  const openPV = async () => {
    if (!selectedSubject?.pv_url) return;
    const { data, error } = await supabase.storage.from("pv-professeurs").createSignedUrl(selectedSubject.pv_url, 60);
    if (error || !data?.signedUrl) { toast.error("Impossible d'ouvrir le PV"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const { data: students = [] } = useQuery({
    queryKey: ["matrix-students", instId, selectedFiliere?.id, level],
    queryFn: async () => {
      if (!selectedFiliere) return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!roles?.length) return [];
      const ids = roles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("user_id, first_name, last_name, student_number").in("user_id", ids).eq("filiere_id", selectedFiliere.id).eq("level", level).order("last_name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!selectedFiliere,
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["matrix-grades", instId, subjectId, selectedYear],
    queryFn: async () => {
      if (!subjectId) return [];
      const { data } = await supabase.from("grades").select("*").eq("subject_id", subjectId).eq("academic_year", selectedYear);
      return data || [];
    },
    enabled: !!subjectId,
  });

  const gradeByUser = useMemo(() => {
    const m = new Map<string, any>();
    (grades as any[]).forEach((g) => m.set(g.user_id, g));
    return m;
  }, [grades]);

  const saveMutation = useMutation({
    mutationFn: async ({ userId, ccVal, examVal }: { userId: string; ccVal: string; examVal: string }) => {
      const cc = parseGrade(ccVal);
      const exam = parseGrade(examVal);
      if (ccVal !== "" && cc === null) throw new Error("CC invalide (0-20)");
      if (examVal !== "" && exam === null) throw new Error("Examen invalide (0-20)");
      const avg = calcAvg(cc, exam);
      const existing = gradeByUser.get(userId);
      if (existing) {
        const { error } = await supabase.from("grades").update({ cc_grade: cc, exam_grade: exam, average: avg, semester }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("grades").insert({
          user_id: userId, subject_id: subjectId, cc_grade: cc, exam_grade: exam, average: avg,
          semester, institution_id: instId || null, academic_year: selectedYear,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["matrix-grades"] });
      qc.invalidateQueries({ queryKey: ["admin-all-grades"] });
      setDrafts((d) => { const c = { ...d }; delete c[vars.userId]; return c; });
      toast.success("Note enregistrée");
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setSavingId(null),
  });

  if (!selectedFiliere) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <div>
          <h2 className="text-lg font-heading font-semibold">Sélectionnez une filière</h2>
          <p className="text-sm text-muted-foreground">Cliquez sur une filière pour saisir les notes de ses étudiants.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filieres.length === 0 ? (
            <Card className="col-span-full glass-card-elevated border-border/50">
              <CardContent className="p-8 text-center">
                <GraduationCap className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Aucune filière créée</p>
              </CardContent>
            </Card>
          ) : filieres.map((f: any) => (
            <button key={f.id} onClick={() => { setSelectedFiliere(f); setDrafts({}); setSubjectId(""); }} className="text-left">
              <Card className="glass-card-elevated border-border/50 hover:shadow-lg hover:border-accent/50 transition-all cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-accent/15 text-accent">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-heading font-semibold text-foreground text-lg">{f.name}</h3>
                  {f.description && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{f.description}</p>}
                  <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50">
                    <span className="text-xs text-muted-foreground">{(studentCounts as any)[f.id] || 0} étudiant(s)</span>
                    <Badge variant="secondary" className="text-[10px]">Saisir notes</Badge>
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedFiliere(null)} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Retour
          </Button>
          <div>
            <h2 className="text-lg font-heading font-semibold flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-accent" /> {selectedFiliere.name}
            </h2>
            <p className="text-xs text-muted-foreground">{students.length} étudiant(s) — {selectedYear}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={level} onValueChange={(v) => { setLevel(v); setSubjectId(""); setDrafts({}); }}>
            <SelectTrigger className="w-28 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={subjectId} onValueChange={(v) => {
            setSubjectId(v); setDrafts({});
            const subj = (subjects as any[]).find((s) => s.id === v);
            if (subj?.semester === "S1" || subj?.semester === "S2") setSemester(subj.semester);
          }}>
            <SelectTrigger className="w-56 h-9 text-xs"><SelectValue placeholder="Choisir une matière" /></SelectTrigger>
            <SelectContent>
              {subjects.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">Aucune matière pour {level}</div>
              ) : (subjects as any[]).map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name} {s.semester ? `· ${s.semester}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-20 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="S1">S1</SelectItem><SelectItem value="S2">S2</SelectItem></SelectContent>
          </Select>
          {selectedSubject?.pv_url && (
            <Button size="sm" variant="outline" onClick={openPV} className="h-9 gap-1.5 border-success/50 text-success hover:bg-success/10">
              <FileText className="w-3.5 h-3.5" /> PV disponible
            </Button>
          )}
        </div>
      </div>

      <Card className="glass-card-elevated border-border/50">
        <CardContent className="p-0">
          {!subjectId ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Sélectionnez une matière pour saisir les notes.</div>
          ) : students.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Aucun étudiant en {level} pour cette filière.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Matricule</TableHead>
                  <TableHead>Étudiant</TableHead>
                  <TableHead className="text-center">CC /20</TableHead>
                  <TableHead className="text-center">Examen /20</TableHead>
                  <TableHead className="text-center">Moyenne</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(students as any[]).map((s) => {
                  const existing = gradeByUser.get(s.user_id);
                  const draft = drafts[s.user_id];
                  const ccVal = draft?.cc ?? (existing?.cc_grade != null ? String(existing.cc_grade) : "");
                  const examVal = draft?.exam ?? (existing?.exam_grade != null ? String(existing.exam_grade) : "");
                  const preview = calcAvg(parseGrade(ccVal), parseGrade(examVal));
                  const isDirty = !!draft;
                  return (
                    <TableRow key={s.user_id}>
                      <TableCell className="font-mono text-xs text-accent">{s.student_number || "—"}</TableCell>
                      <TableCell className="font-medium">{s.last_name} {s.first_name}</TableCell>
                      <TableCell className="text-center">
                        <Input type="number" min="0" max="20" step="0.25"
                          className="w-20 mx-auto h-8 text-center text-xs"
                          value={ccVal}
                          onChange={(e) => setDrafts((d) => ({ ...d, [s.user_id]: { cc: e.target.value, exam: examVal } }))}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Input type="number" min="0" max="20" step="0.25"
                          className="w-20 mx-auto h-8 text-center text-xs"
                          value={examVal}
                          onChange={(e) => setDrafts((d) => ({ ...d, [s.user_id]: { cc: ccVal, exam: e.target.value } }))}
                        />
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {preview !== null ? (
                          <span className={preview >= 10 ? "text-success" : "text-destructive"}>{preview.toFixed(2)}</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant={isDirty ? "default" : "outline"}
                          disabled={!isDirty || savingId === s.user_id}
                          onClick={() => { setSavingId(s.user_id); saveMutation.mutate({ userId: s.user_id, ccVal, examVal }); }}
                          className="h-8 gap-1.5">
                          {savingId === s.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          {existing ? "Mettre à jour" : "Enregistrer"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
