import {saveWorkbook} from "@/lib/nativeExports";
import {useCampus} from "@/hooks/useCampus";
import { motion } from "framer-motion";
import { ClipboardList, Plus, Search, Download, Upload, Pencil, Trash2, AlertTriangle, BookOpen, GraduationCap, Filter, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearSelector } from "@/components/AcademicYearSelector";
import { useState, useRef } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { GradesMatrixView } from "@/components/admin/GradesMatrixView";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const parseGrade = (val: string): number | null => {
  if (val === "" || val === undefined || val === null) return null;
  const n = parseFloat(String(val).replace(",", "."));
  if (isNaN(n)) return null;
  if (n < 0 || n > 20) {
    toast.error("La note doit être comprise entre 0 et 20.");
    return null;
  }
  return n;
};

const calcAvg = (cc: number | null, exam: number | null): number | null => {
  if (cc !== null && exam !== null) {
    const v = Math.max(0, Math.min(20, cc * 0.4 + exam * 0.6));
    return Number(v.toFixed(2));
  }
  return null;
};

const formatGrade = (value: number | null | undefined) => value != null ? Number(value).toFixed(2) : "—";

const AdminGradesPage = () => {
  const { getLevels, institution } = useInstitution();
  const cycle = ((institution as any)?.cycle || "lmd") as "lmd" | "bts";
  const { profile } = useAuth();
  const { selectedYear, isViewingHistory } = useAcademicYear();
  const instId = profile?.institution_id;
  const {campusId} = useCampus();
  const LEVELS = getLevels();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [ccGrade, setCcGrade] = useState("");
  const [examGrade, setExamGrade] = useState("");
  const [semester, setSemester] = useState("S1");
  const [filterFiliere, setFilterFiliere] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterSubject, setFilterSubject] = useState("all");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCc, setEditCc] = useState("");
  const [editExam, setEditExam] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importFiliere, setImportFiliere] = useState("");
  const [importLevel, setImportLevel] = useState("L1");
  const [importSubject, setImportSubject] = useState("");
  const [importSemester, setImportSemester] = useState("S1");

  const { data: filieres = [] } = useQuery({
    queryKey: ["admin-filieres", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.or(`campus_id.is.null,campus_id.eq.${campusId}`);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["admin-students-grades", instId, campusId],
    queryFn: async () => {
      const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!studentRoles || studentRoles.length === 0) return [];
      const ids = studentRoles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("user_id, first_name, last_name, filiere_id, level, student_number");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      q = q.in("user_id", ids);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["admin-subjects", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("subjects").select("id, name, semester, filiere_id, level, pv_url, credits, coefficient");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.or(`campus_id.is.null,campus_id.eq.${campusId}`);
      const { data } = await q;
      return data || [];
    },
  });

  const subjectMap = new Map((subjects as any[]).map((s: any) => [s.id, s]));

  const viewPV = async (subjectId: string) => {
    const s = subjectMap.get(subjectId);
    if (!s?.pv_url) { toast.error("Aucun PV disponible"); return; }
    const { data, error } = await supabase.storage.from("pv-professeurs").createSignedUrl(s.pv_url, 60);
    if (error || !data?.signedUrl) { toast.error("Impossible d'ouvrir le PV"); return; }
    window.open(data.signedUrl, "_blank");
  };


  const { data: grades = [] } = useQuery({
    queryKey: ["admin-all-grades", instId, selectedYear, campusId],
    queryFn: async () => {
      let q = supabase.from("grades").select("*, subjects(name, filiere_id)").order("created_at", { ascending: false });
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      q = q.eq("academic_year", selectedYear);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: rattrapages = [] } = useQuery({
    queryKey: ["admin-rattrapages-grades", instId, campusId],
    queryFn: async () => {
      const { data } = await supabase.from("rattrapages").select("*");
      return data || [];
    },
  });

  useRealtimeSubscription("grades", [["admin-all-grades"]]);

  const rattrapageMap = new Map(rattrapages.map((r: any) => [`${r.user_id}_${r.subject_id}`, r]));
  const studentMap = new Map(students.map(s => [s.user_id, s]));
  const studentByMatricule = new Map(students.filter(s => s.student_number).map(s => [s.student_number!, s]));

  const selectedStudentData = students.find((s: any) => s.user_id === selectedStudent);
  const filteredStudentsForForm = students.filter((s: any) => {
    if (filterFiliere !== "all" && s.filiere_id !== filterFiliere) return false;
    if (filterLevel !== "all" && s.level !== filterLevel) return false;
    return true;
  });
  const filteredSubjectsForForm = selectedStudentData
    ? subjects.filter((s: any) => s.filiere_id === selectedStudentData.filiere_id && s.level === selectedStudentData.level)
    : subjects;

  const filteredGrades = grades.filter((g: any) => {
    const s = studentMap.get(g.user_id);
    if (filterFiliere !== "all" && (!s || s.filiere_id !== filterFiliere)) return false;
    if (filterLevel !== "all" && (!s || s.level !== filterLevel)) return false;
    if (filterSubject !== "all" && g.subject_id !== filterSubject) return false;
    if (search) {
      if (!s) return false;
      const name = `${s.first_name} ${s.last_name} ${s.student_number}`.toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const cc = parseGrade(ccGrade);
      const exam = parseGrade(examGrade);
      const average = calcAvg(cc, exam);
      const { error } = await supabase.from("grades").insert({
        user_id: selectedStudent, subject_id: selectedSubject,
        cc_grade: cc, exam_grade: exam, average, semester,
        institution_id: instId || null, campus_id: campusId,
        academic_year: selectedYear,
        submission_status: "submitted",
        submitted_to_admin_at: new Date().toISOString(),
      } as any);
      if (error) throw error;
      // Création AUTOMATIQUE du rattrapage avec l'année académique de la note
      if (average !== null && average < 10) {
        const studentData = studentMap.get(selectedStudent);
        await supabase.from("rattrapages").insert({
          user_id: selectedStudent,
          subject_id: selectedSubject,
          original_average: average,
          status: "pending",
          filiere_id: studentData?.filiere_id || null,
          level: studentData?.level || null,
          academic_year: selectedYear,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-grades", campusId] });
      qc.invalidateQueries({ queryKey: ["admin-rattrapages-grades", campusId] });
      toast.success("Note ajoutée");
      setOpen(false);
      setSelectedStudent(""); setSelectedSubject(""); setCcGrade(""); setExamGrade("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const cc = parseGrade(editCc);
      const exam = parseGrade(editExam);
      const average = calcAvg(cc, exam);
      const { error } = await supabase.from("grades").update({ cc_grade: cc, exam_grade: exam, average }).eq("id", editingId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-all-grades", campusId] });
      toast.success("Note modifiée");
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const rattrapageMutation = useMutation({
    mutationFn: async ({ rattId, grade, userId, subjectId }: { rattId: string; grade: string; userId: string; subjectId: string }) => {
      const g = parseGrade(grade);
      const status = g !== null && g >= 10 ? "passed" : g !== null ? "failed" : "pending";
      const { error } = await supabase.from("rattrapages").update({
        rattrapage_grade: g, final_grade: g, status,
      }).eq("id", rattId);
      if (error) throw error;

      // If rattrapage passed, update student_year_history credits
      if (status === "passed" && g !== null) {
        const subject = subjects.find(s => s.id === subjectId);
        if (subject) {
          // Find the student_year_history for this user and the year of the grade
          const gradeRecord = grades.find(gr => gr.user_id === userId && gr.subject_id === subjectId);
          const academicYear = gradeRecord?.academic_year || selectedYear;
          
          const { data: history } = await supabase
            .from("student_year_history")
            .select("id, credits_acquired, ue_validated_ids, ue_to_retake_ids")
            .eq("user_id", userId)
            .eq("academic_year", academicYear)
            .maybeSingle();

          if (history) {
            const validatedIds = history.ue_validated_ids || [];
            const toRetakeIds = (history.ue_to_retake_ids || []).filter((id: string) => id !== subjectId);
            if (!validatedIds.includes(subjectId)) {
              validatedIds.push(subjectId);
            }
            await supabase.from("student_year_history").update({
              credits_acquired: (history.credits_acquired || 0) + ((subject as any).credits || 0),
              ue_validated_ids: validatedIds,
              ue_to_retake_ids: toRetakeIds,
            }).eq("id", history.id);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-rattrapages-grades", campusId] });
      qc.invalidateQueries({ queryKey: ["student-history-years", campusId] });
      toast.success("Note de rattrapage enregistrée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("grades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-all-grades", campusId] }); toast.success("Note supprimée"); },
  });

  const exportTemplate = () => {
    const targetStudents = students.filter(s => s.filiere_id === importFiliere && s.level === importLevel);
    const subj = subjects.find(s => s.id === importSubject);
    if (targetStudents.length === 0) { toast.error("Aucun étudiant trouvé"); return; }
    const rows = targetStudents.map(s => ({
      matricule: s.student_number || "",
      nom: s.last_name,
      prenom: s.first_name,
      cc1: "",
      examen: "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows, { header: ["matricule", "nom", "prenom", "cc1", "examen"] });
    ws["!cols"] = [{ wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Notes");
    const safeName = (subj?.name || "matiere").replace(/[^a-z0-9]+/gi, "_");
    saveWorkbook(wb, `notes_${safeName}_${importLevel}.xlsx`);
    toast.success("Modèle Excel exporté !");
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const wsName = wb.SheetNames[0];
    const rows: any[] = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { defval: "" });
    if (!rows.length) { toast.error("Fichier vide"); return; }
    // Normalise les clés (insensible à la casse / accents)
    const norm = (s: string) => String(s).trim().toLowerCase();
    const sample = Object.keys(rows[0]).reduce((acc: any, k) => { acc[norm(k)] = k; return acc; }, {});
    const matKey = sample["matricule"];
    const ccKey = sample["cc1"] || sample["cc"];
    const examKey = sample["examen"] || sample["exam"];
    if (!matKey || !ccKey || !examKey) {
      toast.error("Colonnes manquantes: matricule, cc1, examen requises");
      return;
    }
    let imported = 0, errors = 0;
    for (const r of rows) {
      const matricule = String(r[matKey] ?? "").trim();
      const cc = parseGrade(String(r[ccKey] ?? ""));
      const exam = parseGrade(String(r[examKey] ?? ""));
      if (!matricule || (cc === null && exam === null)) continue;
      const student = studentByMatricule.get(matricule);
      if (!student) { errors++; continue; }
      const avg = calcAvg(cc, exam);
      const { error } = await supabase.from("grades").insert({
        user_id: student.user_id,
        subject_id: importSubject,
        cc_grade: cc,
        exam_grade: exam,
        average: avg,
        semester: importSemester,
        institution_id: instId || null, campus_id: campusId,
        academic_year: selectedYear,
        submission_status: "submitted",
        submitted_to_admin_at: new Date().toISOString(),
      } as any);
      if (error) errors++; else imported++;
    }
    qc.invalidateQueries({ queryKey: ["admin-all-grades", campusId] });
    toast.success(`${imported} note(s) importée(s)${errors > 0 ? `, ${errors} erreur(s)` : ""}`);
    setImportOpen(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const importSubjects = subjects.filter(s => s.filiere_id === importFiliere && s.level === importLevel);
  const previewAvg = calcAvg(parseGrade(ccGrade), parseGrade(examGrade));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-4 sm:space-y-6">
      {/* Header */}
      <motion.div variants={item} className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
              Gestion des Notes
              <Badge variant="outline" className="text-[10px] uppercase">{cycle}</Badge>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredGrades.length} note(s) — {selectedYear}
              {isViewingHistory && <span className="text-warning ml-1 font-medium">(historique)</span>}
              {cycle === "bts" && <span className="text-muted-foreground ml-1">· moyenne pondérée par coefficients</span>}
            </p>
          </div>
          <AcademicYearSelector />
        </div>
        <div className="flex flex-wrap gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm">
                <Download className="w-3.5 h-3.5" /> Excel
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader><DialogTitle>Import / Export Excel (.xlsx)</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">Choisissez filière + niveau + matière, exportez le modèle, remplissez, puis importez.</p>
                <div className="grid grid-cols-2 gap-2">
                  <Select value={importFiliere} onValueChange={setImportFiliere}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Filière" /></SelectTrigger>
                    <SelectContent>{filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={importLevel} onValueChange={setImportLevel}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Select value={importSubject} onValueChange={setImportSubject}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Matière" /></SelectTrigger>
                  <SelectContent>{importSubjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={importSemester} onValueChange={setImportSemester}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="S1">S1</SelectItem><SelectItem value="S2">S2</SelectItem></SelectContent>
                </Select>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={exportTemplate} disabled={!importFiliere || !importSubject} className="gap-1.5 text-xs">
                    <Download className="w-3.5 h-3.5" /> Modèle
                  </Button>
                  <div>
                    <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
                    <Button size="sm" onClick={() => fileRef.current?.click()} disabled={!importFiliere || !importSubject} className="w-full gap-1.5 text-xs gradient-gold text-accent-foreground">
                      <Upload className="w-3.5 h-3.5" /> Importer
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gradient-gold text-accent-foreground gap-1.5 text-xs sm:text-sm">
                <Plus className="w-3.5 h-3.5" /> Saisir
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-md">
              <DialogHeader><DialogTitle>Saisir une note</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={selectedStudent} onValueChange={(v) => { setSelectedStudent(v); setSelectedSubject(""); }}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Étudiant" /></SelectTrigger>
                  <SelectContent>{filteredStudentsForForm.map((s: any) => (<SelectItem key={s.user_id} value={s.user_id}>{s.first_name} {s.last_name} {s.level ? `(${s.level})` : ""}</SelectItem>))}</SelectContent>
                </Select>
                {(() => {
                  const studentGradedSubjectIds = new Set(
                    grades.filter((g: any) => g.user_id === selectedStudent).map((g: any) => g.subject_id)
                  );
                  const s1Subjects = filteredSubjectsForForm.filter((s: any) => s.semester === "S1");
                  const s2Subjects = filteredSubjectsForForm.filter((s: any) => s.semester === "S2");
                  const otherSubjects = filteredSubjectsForForm.filter((s: any) => s.semester !== "S1" && s.semester !== "S2");
                  return (
                    <Select
                      value={selectedSubject}
                      onValueChange={(v) => {
                        setSelectedSubject(v);
                        const subj = filteredSubjectsForForm.find((s: any) => s.id === v);
                        if (subj?.semester === "S1" || subj?.semester === "S2") setSemester(subj.semester);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Matière" /></SelectTrigger>
                      <SelectContent>
                        {s1Subjects.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Semestre 1</SelectLabel>
                            {s1Subjects.map((s: any) => {
                              const taken = studentGradedSubjectIds.has(s.id);
                              return (
                                <SelectItem key={s.id} value={s.id} disabled={taken}>
                                  {s.name}{taken ? " — déjà noté" : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        )}
                        {s2Subjects.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Semestre 2</SelectLabel>
                            {s2Subjects.map((s: any) => {
                              const taken = studentGradedSubjectIds.has(s.id);
                              return (
                                <SelectItem key={s.id} value={s.id} disabled={taken}>
                                  {s.name}{taken ? " — déjà noté" : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        )}
                        {otherSubjects.length > 0 && (
                          <SelectGroup>
                            <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Autres</SelectLabel>
                            {otherSubjects.map((s: any) => {
                              const taken = studentGradedSubjectIds.has(s.id);
                              return (
                                <SelectItem key={s.id} value={s.id} disabled={taken}>
                                  {s.name}{taken ? " — déjà noté" : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        )}
                      </SelectContent>
                    </Select>
                  );
                })()}
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" placeholder="CC /20" value={ccGrade} onChange={(e) => setCcGrade(e.target.value)} min="0" max="20" step="0.5" className="h-9 text-xs" />
                  <Input type="number" placeholder="Exam /20" value={examGrade} onChange={(e) => setExamGrade(e.target.value)} min="0" max="20" step="0.5" className="h-9 text-xs" />
                  <Select value={semester} onValueChange={setSemester}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="S1">S1</SelectItem><SelectItem value="S2">S2</SelectItem></SelectContent>
                  </Select>
                </div>
                {previewAvg !== null && (
                  <p className="text-xs text-muted-foreground text-center">
                    Moyenne = <strong className={previewAvg >= 10 ? "text-success" : "text-destructive"}>{previewAvg.toFixed(2)}</strong>
                    {previewAvg < 10 && <span className="ml-1 text-destructive">⚠ Rattrapage</span>}
                  </p>
                )}
                <Button onClick={() => createMutation.mutate()} disabled={!selectedStudent || !selectedSubject || createMutation.isPending} className="w-full gradient-gold text-accent-foreground text-sm">
                  {createMutation.isPending ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* New cards + matrix entry */}
      <motion.div variants={item}>
        <GradesMatrixView />
      </motion.div>

      <motion.div variants={item} className="pt-2">
        <h2 className="text-base font-heading font-semibold text-foreground">Toutes les notes saisies</h2>
        <p className="text-xs text-muted-foreground">Recherche et édition globale.</p>
      </motion.div>


      {/* Filters - collapsible on mobile */}
      <motion.div variants={item}>
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full sm:hidden gap-2 text-xs justify-between">
              <span className="flex items-center gap-1.5"><Filter className="w-3.5 h-3.5" /> Filtres</span>
              <Badge variant="secondary" className="text-[10px] px-1.5">{[filterFiliere, filterLevel, filterSubject].filter(f => f !== "all").length || "0"}</Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="sm:!block mt-2 sm:mt-0">
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              <Select value={filterFiliere} onValueChange={setFilterFiliere}>
                <SelectTrigger className="w-full sm:w-40 h-9 text-xs"><SelectValue placeholder="Toutes filières" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Toutes filières</SelectItem>{filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-full sm:w-28 h-9 text-xs"><SelectValue placeholder="Niveau" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tous</SelectItem>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="w-full sm:w-40 h-9 text-xs"><SelectValue placeholder="Toutes matières" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Toutes matières</SelectItem>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Rechercher..." className="pl-8 h-9 text-xs bg-secondary/50" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </CollapsibleContent>
          {/* Always show filters on desktop */}
          <div className="hidden sm:block">
            <div className="flex flex-wrap gap-2">
              <Select value={filterFiliere} onValueChange={setFilterFiliere}>
                <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Toutes filières" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Toutes filières</SelectItem>{filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterLevel} onValueChange={setFilterLevel}>
                <SelectTrigger className="w-28 h-9 text-xs"><SelectValue placeholder="Niveau" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Tous</SelectItem>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={filterSubject} onValueChange={setFilterSubject}>
                <SelectTrigger className="w-40 h-9 text-xs"><SelectValue placeholder="Toutes matières" /></SelectTrigger>
                <SelectContent><SelectItem value="all">Toutes matières</SelectItem>{subjects.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[160px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input placeholder="Rechercher..." className="pl-8 h-9 text-xs bg-secondary/50" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>
          </div>
        </Collapsible>
      </motion.div>

      {/* Grades - Card list on mobile, table on desktop */}
      <motion.div variants={item}>
        {filteredGrades.length === 0 ? (
          <Card className="glass-card-elevated border-border/50">
            <CardContent className="py-12 text-center">
              <GraduationCap className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Aucune note saisie</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden space-y-3">
              {filteredGrades.map((g: any) => {
                const s = studentMap.get(g.user_id);
                const isEditing = editingId === g.id;
                const avg = g.average;
                const isRattrapage = avg !== null && avg < 10;
                const rattKey = `${g.user_id}_${g.subject_id}`;
                const ratt = rattrapageMap.get(rattKey);

                return (
                  <Card key={g.id} className={`border-border/50 overflow-hidden ${isRattrapage && (!ratt || ratt.status !== "passed") ? "border-destructive/30 bg-destructive/5" : "glass-card-elevated"}`}>
                    <CardContent className="p-3 space-y-2.5">
                      {/* Student name + actions */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {s ? `${s.first_name} ${s.last_name}` : g.user_id.slice(0, 8)}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <BookOpen className="w-3 h-3 shrink-0" />
                            <span className="truncate">{g.subjects?.name || "—"}</span>
                            {subjectMap.get(g.subject_id)?.pv_url && (
                              <Button variant="outline" size="sm" className="h-5 px-1.5 text-[10px] gap-1 ml-1 shrink-0" onClick={() => viewPV(g.subject_id)}>
                                <FileText className="w-2.5 h-2.5" /> PV
                              </Button>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{g.semester}</Badge>
                          {!isEditing && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(g.id); setEditCc(g.cc_grade != null ? g.cc_grade.toString() : ""); setEditExam(g.exam_grade != null ? g.exam_grade.toString() : ""); }}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(g.id)}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Grades row */}
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">CC</label>
                              <Input type="number" min="0" max="20" step="0.25" className="h-8 text-xs mt-0.5" value={editCc} onChange={(e) => setEditCc(e.target.value)} />
                            </div>
                            <div>
                              <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Examen</label>
                              <Input type="number" min="0" max="20" step="0.25" className="h-8 text-xs mt-0.5" value={editExam} onChange={(e) => setEditExam(e.target.value)} />
                            </div>
                          </div>
                          {(() => {
                            const previewEditAvg = calcAvg(parseGrade(editCc), parseGrade(editExam));
                            return previewEditAvg !== null ? (
                              <p className="text-xs text-center">Moy: <strong className={previewEditAvg >= 10 ? "text-success" : "text-destructive"}>{previewEditAvg.toFixed(2)}</strong></p>
                            ) : null;
                          })()}
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 h-8 text-xs" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Sauver</Button>
                            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setEditingId(null)}>Annuler</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-secondary/40 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">CC</p>
                            <p className="text-sm font-bold text-foreground mt-0.5">{formatGrade(g.cc_grade)}</p>
                          </div>
                          <div className="bg-secondary/40 rounded-lg p-2 text-center">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Exam</p>
                            <p className="text-sm font-bold text-foreground mt-0.5">{formatGrade(g.exam_grade)}</p>
                          </div>
                          <div className={`rounded-lg p-2 text-center ${avg != null && avg >= 10 ? "bg-success/10" : "bg-destructive/10"}`}>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Moy</p>
                            <p className={`text-sm font-bold mt-0.5 ${avg != null && avg >= 10 ? "text-success" : "text-destructive"}`}>
                              {formatGrade(avg)}
                              {isRattrapage && <AlertTriangle className="w-3 h-3 inline ml-0.5" />}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Rattrapage section */}
                      {isRattrapage && !isEditing && (
                        <div className="bg-warning/10 border border-warning/20 rounded-lg p-2">
                          <p className="text-[10px] text-warning font-semibold uppercase tracking-wider mb-1.5">Rattrapage</p>
                          {ratt ? (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number" min="0" max="20" step="0.25"
                                className="h-7 text-xs flex-1"
                                defaultValue={ratt.rattrapage_grade != null ? ratt.rattrapage_grade : ""}
                                placeholder="Note /20"
                                onBlur={(e) => {
                                  if (e.target.value !== (ratt.rattrapage_grade?.toString() || "")) {
                                    rattrapageMutation.mutate({ rattId: ratt.id, grade: e.target.value, userId: g.user_id, subjectId: g.subject_id });
                                  }
                                }}
                                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                              />
                              {ratt.rattrapage_grade != null && (
                                <Badge variant={ratt.rattrapage_grade >= 10 ? "default" : "destructive"} className="text-[10px]">
                                  {ratt.rattrapage_grade >= 10 ? "Validé" : "Échoué"}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-warning">En attente...</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Desktop table */}
            <Card className="hidden sm:block glass-card-elevated border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left p-3 text-xs font-semibold text-foreground">Étudiant</th>
                        <th className="text-left p-3 text-xs font-semibold text-foreground">Matière</th>
                        <th className="text-center p-3 text-xs font-semibold text-foreground">CC</th>
                        <th className="text-center p-3 text-xs font-semibold text-foreground">Examen</th>
                        <th className="text-center p-3 text-xs font-semibold text-foreground">Moyenne</th>
                        <th className="text-center p-3 text-xs font-semibold text-foreground">Rattrapage</th>
                        <th className="text-center p-3 text-xs font-semibold text-foreground">Sem.</th>
                        <th className="text-center p-3 text-xs font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredGrades.map((g: any) => {
                        const s = studentMap.get(g.user_id);
                        const isEditing = editingId === g.id;
                        const avg = g.average;
                        const isRattrapage = avg !== null && avg < 10;
                        const rattKey = `${g.user_id}_${g.subject_id}`;
                        const ratt = rattrapageMap.get(rattKey);

                        return (
                          <tr key={g.id} className={`border-b border-border/50 hover:bg-secondary/20 transition-colors ${isRattrapage && (!ratt || ratt.status !== "passed") ? "bg-destructive/5" : ""}`}>
                            <td className="p-3 text-sm font-medium text-foreground">{s ? `${s.first_name} ${s.last_name}` : g.user_id.slice(0, 8)}</td>
                            <td className="p-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <span>{g.subjects?.name || "—"}</span>
                                {subjectMap.get(g.subject_id)?.pv_url && (
                                  <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => viewPV(g.subject_id)}>
                                    <FileText className="w-3 h-3" /> Voir le PV
                                  </Button>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-sm text-center">
                              {isEditing ? <Input type="number" min="0" max="20" step="0.25" className="w-16 mx-auto text-center h-8 text-xs" value={editCc} onChange={(e) => setEditCc(e.target.value)} /> : formatGrade(g.cc_grade)}
                            </td>
                            <td className="p-3 text-sm text-center">
                              {isEditing ? <Input type="number" min="0" max="20" step="0.25" className="w-16 mx-auto text-center h-8 text-xs" value={editExam} onChange={(e) => setEditExam(e.target.value)} /> : formatGrade(g.exam_grade)}
                            </td>
                            <td className="p-3 text-sm text-center font-bold">
                              {isEditing ? (
                                (() => {
                                  const previewEditAvg = calcAvg(parseGrade(editCc), parseGrade(editExam));
                                  return previewEditAvg !== null ? <span className={previewEditAvg >= 10 ? "text-success" : "text-destructive"}>{previewEditAvg.toFixed(2)}</span> : "—";
                                })()
                              ) : avg != null ? (
                                <span className={avg >= 10 ? "text-success" : "text-destructive"}>
                                  {Number(avg).toFixed(2)}
                                  {isRattrapage && <AlertTriangle className="w-3 h-3 inline ml-1 text-destructive" />}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="p-3 text-center">
                              {isRattrapage ? (
                                ratt ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <Input type="number" min="0" max="20" step="0.25" className="w-16 text-center h-7 text-xs" defaultValue={ratt.rattrapage_grade != null ? ratt.rattrapage_grade : ""}
                                      onBlur={(e) => { if (e.target.value !== (ratt.rattrapage_grade?.toString() || "")) rattrapageMutation.mutate({ rattId: ratt.id, grade: e.target.value, userId: g.user_id, subjectId: g.subject_id }); }}
                                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                                    />
                                    {ratt.rattrapage_grade != null && <span className={`text-xs font-bold ${ratt.rattrapage_grade >= 10 ? "text-success" : "text-destructive"}`}>{ratt.rattrapage_grade >= 10 ? "✓" : "✗"}</span>}
                                  </div>
                                ) : <span className="text-xs text-warning">En attente</span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="p-3 text-sm text-center"><Badge variant="secondary" className="text-[10px]">{g.semester}</Badge></td>
                            <td className="p-3 text-center">
                              {isEditing ? (
                                <div className="flex items-center justify-center gap-1">
                                  <Button size="sm" className="h-7 text-xs" onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>Sauver</Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingId(null)}>✗</Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(g.id); setEditCc(g.cc_grade != null ? g.cc_grade.toString() : ""); setEditExam(g.exam_grade != null ? g.exam_grade.toString() : ""); }}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(g.id)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AdminGradesPage;
