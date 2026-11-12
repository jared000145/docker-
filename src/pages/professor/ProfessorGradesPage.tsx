import { useCycle } from "@/hooks/useCycle";
import ProfessorSchoolGrades from "@/components/professor/ProfessorSchoolGrades";
import { motion } from "framer-motion";
import { ClipboardList, Save, Trash2, Plus, Users, BookOpen, Send, CheckCircle2, Clock, FileText, Lock, Archive } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { generateGradesPVPdf } from "@/lib/gradesPVPdf";

const normalizeProfessorText = (value?: string | null) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

const isSubjectAssignedToProfessor = (subjectProfessor?: string | null, profile?: { first_name?: string | null; last_name?: string | null }) => {
  const normalizedProfessor = normalizeProfessorText(subjectProfessor);
  if (!normalizedProfessor) return false;
  const firstName = normalizeProfessorText(profile?.first_name);
  const lastName = normalizeProfessorText(profile?.last_name);
  const fullName = normalizeProfessorText(`${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`);
  const tokens = normalizedProfessor.split(" ").filter(Boolean);
  if (fullName && normalizedProfessor === fullName) return true;
  if (fullName && normalizedProfessor.includes(fullName)) return true;
  if (firstName && lastName && tokens.includes(firstName) && tokens.includes(lastName)) return true;
  if (firstName && normalizedProfessor === firstName) return true;
  if (lastName && normalizedProfessor === lastName) return true;
  return false;
};

const ProfessorGradesUniversity = () => {
  const { profile, user } = useAuth();
  const { institution } = useInstitution();
  const qc = useQueryClient();
  const [selectedSubject, setSelectedSubject] = useState("");
  const [gradeEdits, setGradeEdits] = useState<Record<string, { cc: string; exam: string }>>({});
  const [showArchived, setShowArchived] = useState(false);

  const { data: subjectsAll = [], isLoading: loadingSubjects } = useQuery({
    queryKey: ["prof-subjects-grades", profile?.first_name, profile?.last_name, profile?.institution_id],
    queryFn: async () => {
      if (!profile?.institution_id) return [];
      const { data, error } = await supabase
        .from("subjects")
        .select("*, filieres(name)")
        .eq("institution_id", profile.institution_id)
        .order("name");
      if (error) throw error;
      return (data || []).filter((s: any) => s.professor_user_id === user?.id);
    },
    enabled: !!profile?.institution_id,
  });

  // Determine archived subjects from schedule end-times
  const subjectIds = subjectsAll.map((s: any) => s.id);
  const { data: archiveMap = {} } = useQuery({
    queryKey: ["prof-subj-archive", subjectIds.join(",")],
    queryFn: async () => {
      if (subjectIds.length === 0) return {} as Record<string, boolean>;
      const { data } = await supabase.from("schedule_events").select("subject_id, end_time").in("subject_id", subjectIds);
      const last: Record<string, Date> = {};
      (data || []).forEach((e: any) => {
        const d = new Date(e.end_time);
        if (!last[e.subject_id] || d > last[e.subject_id]) last[e.subject_id] = d;
      });
      const now = new Date();
      const map: Record<string, boolean> = {};
      Object.entries(last).forEach(([id, d]) => { map[id] = d < now; });
      return map;
    },
    enabled: subjectIds.length > 0,
  });

  const subjects = subjectsAll.filter((s: any) => showArchived ? archiveMap[s.id] : !archiveMap[s.id]);
  const archivedCount = subjectsAll.filter((s: any) => archiveMap[s.id]).length;


  const subject = subjects.find((s: any) => s.id === selectedSubject);

  const { data: students = [], isLoading: loadingStudents } = useQuery({
    queryKey: ["prof-students", selectedSubject, subject?.filiere_id, subject?.level, profile?.institution_id],
    queryFn: async () => {
      if (!subject || !profile?.institution_id) return [];
      let profilesQuery = supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number, filiere_id, level, signature_url")
        .eq("institution_id", profile.institution_id)
        .eq("level", subject.level)
        .order("last_name")
        .order("first_name");
      if (subject.filiere_id) profilesQuery = profilesQuery.eq("filiere_id", subject.filiere_id);
      const [{ data: candidateProfiles, error: pErr }, { data: enrollments, error: eErr }] = await Promise.all([
        profilesQuery,
        supabase.from("enrollments").select("user_id").eq("subject_id", subject.id),
      ]);
      if (pErr) throw pErr;
      if (eErr) throw eErr;
      const enrolledIds = new Set((enrollments || []).map((e: any) => e.user_id));
      const matching = (candidateProfiles || []).filter((s: any) => s.user_id !== profile.user_id);
      return matching.filter((s: any) => enrolledIds.size === 0 || enrolledIds.has(s.user_id));
    },
    enabled: !!subject && !!profile?.institution_id,
  });

  const { data: existingGrades = [] } = useQuery({
    queryKey: ["prof-existing-grades", selectedSubject, profile?.institution_id],
    queryFn: async () => {
      if (!selectedSubject || !profile?.institution_id) return [];
      const { data, error } = await supabase
        .from("grades")
        .select("*")
        .eq("subject_id", selectedSubject)
        .eq("institution_id", profile.institution_id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSubject && !!profile?.institution_id,
  });

  const gradeMap = new Map(existingGrades.map((g: any) => [g.user_id, g]));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubject || !subject || !profile?.institution_id) throw new Error("Sélectionnez d'abord une matière assignée.");
      const parseGrade = (val: string): number | null => {
        if (val === "" || val == null) return null;
        const n = parseFloat(String(val).replace(",", "."));
        if (isNaN(n)) return null;
        if (n < 0 || n > 20) throw new Error("La note doit être comprise entre 0 et 20.");
        return n;
      };
      const upserts = Object.entries(gradeEdits)
        .map(([userId, { cc, exam }]) => {
          const ccNum = parseGrade(cc);
          const examNum = parseGrade(exam);
          const rawAvg = ccNum !== null && examNum !== null ? ccNum * 0.4 + examNum * 0.6 : null;
          const avg = rawAvg !== null ? Math.max(0, Math.min(20, Number(rawAvg.toFixed(2)))) : null;
          const existing: any = gradeMap.get(userId);
          // Don't overwrite submitted (locked) grades
          if (existing?.submission_status === "submitted") return null;
          return {
            ...(existing ? { id: existing.id } : {}),
            user_id: userId,
            subject_id: selectedSubject,
            cc_grade: ccNum,
            exam_grade: examNum,
            average: avg,
            semester: subject.semester || "S1",
            academic_year: institution?.academic_year || subject.academic_year || `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
            institution_id: profile.institution_id,
            submission_status: existing?.submission_status || "draft",
          };
        })
        .filter((g): g is NonNullable<typeof g> => g !== null && (g.cc_grade !== null || g.exam_grade !== null));
      if (upserts.length === 0) throw new Error("Ajoutez au moins une note avant d'enregistrer.");
      const { error } = await supabase.from("grades").upsert(upserts);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prof-existing-grades"] });
      setGradeEdits({});
      toast.success("Notes enregistrées (brouillon)");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (gradeId: string) => {
      const { error } = await supabase.from("grades").delete().eq("id", gradeId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["prof-existing-grades"] }); toast.success("Note supprimée"); },
    onError: (e: any) => toast.error(e.message),
  });

  // Send to students for verification
  const sendToStudentsMutation = useMutation({
    mutationFn: async () => {
      const drafts = existingGrades.filter((g: any) => g.submission_status === "draft");
      if (drafts.length === 0) throw new Error("Aucune note en brouillon à envoyer.");
      const batchId = crypto.randomUUID();
      const { error } = await supabase
        .from("grades")
        .update({ submission_status: "pending_approval", submission_batch_id: batchId } as any)
        .in("id", drafts.map((g: any) => g.id));
      if (error) throw error;
      // Notify each student (best-effort)
      try {
        await supabase.from("notifications").insert(
          drafts.map((g: any) => ({
            user_id: g.user_id,
            title: "Note à vérifier",
            message: `Votre professeur a saisi une note en ${subject?.name || "une matière"}. Veuillez l'approuver dans Mes Notes.`,
            type: "info",
            institution_id: profile?.institution_id,
          }))
        );
      } catch { /* Optional operation: retain the existing fallback. */ }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prof-existing-grades"] });
      toast.success("Notes envoyées aux étudiants pour vérification");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Send to administration (lock)
  const sendToAdminMutation = useMutation({
    mutationFn: async () => {
      const toLock = existingGrades.filter((g: any) => g.submission_status === "pending_approval" || g.submission_status === "draft");
      if (toLock.length === 0) throw new Error("Aucune note à transmettre.");
      const { error } = await supabase
        .from("grades")
        .update({ submission_status: "submitted", submitted_to_admin_at: new Date().toISOString() } as any)
        .in("id", toLock.map((g: any) => g.id));
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prof-existing-grades"] });
      toast.success("Notes transmises à l'administration et verrouillées");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDownloadPV = async () => {
    if (!subject) return;
    const filiereName = (subject as any).filieres?.name;
    const rows = students.map((s: any) => {
      const g: any = gradeMap.get(s.user_id);
      return {
        user_id: s.user_id,
        first_name: s.first_name,
        last_name: s.last_name,
        student_number: s.student_number,
        cc_grade: g?.cc_grade ?? null,
        exam_grade: g?.exam_grade ?? null,
        average: g?.average ?? null,
        approved_by_student: !!g?.approved_by_student,
        student_signature_url: g?.student_signature_url || null,
      };
    });
    await generateGradesPVPdf({
      institution,
      professorName: `${profile?.first_name || ""} ${profile?.last_name || ""}`.trim(),
      professorSignatureUrl: (profile as any)?.signature_url || null,
      subjectName: subject.name,
      filiereName,
      level: subject.level,
      academicYear: institution?.academic_year || subject.academic_year,
      semester: subject.semester,
      students: rows,
    });
  };


  const getEdit = (userId: string) => {
    if (gradeEdits[userId]) return gradeEdits[userId];
    const existing: any = gradeMap.get(userId);
    return { cc: existing?.cc_grade?.toString() || "", exam: existing?.exam_grade?.toString() || "" };
  };
  const setEdit = (userId: string, field: "cc" | "exam", val: string) => {
    const current = getEdit(userId);
    setGradeEdits({ ...gradeEdits, [userId]: { ...current, [field]: val } });
  };

  const hasEdits = Object.keys(gradeEdits).length > 0;
  const studentsWithGrades = students.filter((s: any) => gradeMap.has(s.user_id));
  const draftCount = existingGrades.filter((g: any) => g.submission_status === "draft").length;
  const pendingCount = existingGrades.filter((g: any) => g.submission_status === "pending_approval").length;
  const submittedCount = existingGrades.filter((g: any) => g.submission_status === "submitted").length;
  const approvedCount = existingGrades.filter((g: any) => g.approved_by_student).length;
  const allLocked = existingGrades.length > 0 && existingGrades.every((g: any) => g.submission_status === "submitted");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-accent" /> Saisie des notes
          <Badge variant="outline" className="text-[10px] uppercase ml-1">{((institution as any)?.cycle || "lmd")}</Badge>
        </h1>
        <p className="text-muted-foreground mt-1">
          Saisie → envoi aux étudiants pour vérification → transmission à l'administration
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setGradeEdits({}); }}>
          <SelectTrigger className="w-80"><SelectValue placeholder={showArchived ? "Choisir une matière archivée" : "Choisir une matière"} /></SelectTrigger>
          <SelectContent>
            {subjects.map((s: any) => (
              <SelectItem key={s.id} value={s.id}>{s.name} ({(s as any).filieres?.name} · {s.level})</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button size="sm" variant={showArchived ? "default" : "outline"} onClick={() => { setShowArchived(!showArchived); setSelectedSubject(""); }} className="gap-2">
          <Archive className="w-4 h-4" />
          {showArchived ? "Voir actives" : `Archives (${archivedCount})`}
        </Button>



        {hasEdits && (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? "Enregistrement..." : "Enregistrer (brouillon)"}
          </Button>
        )}

        {selectedSubject && draftCount > 0 && !hasEdits && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default" className="gap-2 bg-blue-600 hover:bg-blue-700">
                <Send className="w-4 h-4" /> Envoyer aux étudiants ({draftCount})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Envoyer les notes aux étudiants ?</AlertDialogTitle>
                <AlertDialogDescription>
                  {draftCount} note(s) en brouillon seront visibles par les étudiants concernés pour vérification et approbation. Vous pourrez encore les modifier tant qu'elles ne sont pas transmises à l'administration.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => sendToStudentsMutation.mutate()}>Envoyer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {selectedSubject && existingGrades.length > 0 && (
          <Button variant="outline" onClick={handleDownloadPV} className="gap-2">
            <FileText className="w-4 h-4" /> Télécharger le PV
          </Button>
        )}

        {selectedSubject && (pendingCount > 0 || draftCount > 0) && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Lock className="w-4 h-4" /> Envoyer à l'administration
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Transmettre définitivement à l'administration ?</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="block mb-2">{approvedCount} / {existingGrades.length} étudiant(s) ont approuvé leurs notes.</span>
                  <span className="block">Cette action est <strong>irréversible</strong> : les notes seront verrouillées, comptabilisées dans les moyennes et bulletins, et plus aucune modification ne sera possible. Les étudiants n'ayant pas approuvé devront saisir l'administration pour réclamation.</span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={() => sendToAdminMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Confirmer la transmission
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {subject && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="glass-card border-border/50"><CardContent className="p-3"><div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent" /><div><p className="text-[10px] text-muted-foreground uppercase">Matière</p><p className="text-xs font-semibold">{subject.name}</p></div></div></CardContent></Card>
          <Card className="glass-card border-border/50"><CardContent className="p-3"><div className="flex items-center gap-2"><Users className="w-4 h-4 text-primary" /><div><p className="text-[10px] text-muted-foreground uppercase">Étudiants</p><p className="text-xs font-semibold">{studentsWithGrades.length} / {students.length}</p></div></div></CardContent></Card>
          <Card className="glass-card border-border/50"><CardContent className="p-3"><div className="flex items-center gap-2"><ClipboardList className="w-4 h-4 text-slate-500" /><div><p className="text-[10px] text-muted-foreground uppercase">Brouillon</p><p className="text-xs font-semibold">{draftCount}</p></div></div></CardContent></Card>
          <Card className="glass-card border-border/50"><CardContent className="p-3"><div className="flex items-center gap-2"><Clock className="w-4 h-4 text-amber-500" /><div><p className="text-[10px] text-muted-foreground uppercase">En vérif.</p><p className="text-xs font-semibold">{approvedCount} / {pendingCount + approvedCount} approuvés</p></div></div></CardContent></Card>
          <Card className="glass-card border-border/50"><CardContent className="p-3"><div className="flex items-center gap-2"><Lock className="w-4 h-4 text-green-600" /><div><p className="text-[10px] text-muted-foreground uppercase">Transmis</p><p className="text-xs font-semibold">{submittedCount}</p></div></div></CardContent></Card>
        </div>
      )}

      {!selectedSubject && !loadingSubjects && (
        <Card className="glass-card border-border/50"><CardContent className="p-12 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">{subjects.length === 0 ? "Aucune matière ne vous est assignée." : "Sélectionnez une matière pour commencer."}</p>
        </CardContent></Card>
      )}

      {selectedSubject && (
        <Card className="glass-card border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 text-xs font-semibold">Étudiant</th>
                    <th className="text-center p-3 text-xs font-semibold">Matricule</th>
                    <th className="text-center p-3 text-xs font-semibold">CC (40%)</th>
                    <th className="text-center p-3 text-xs font-semibold">Examen (60%)</th>
                    <th className="text-center p-3 text-xs font-semibold">Moyenne</th>
                    <th className="text-center p-3 text-xs font-semibold">Statut</th>
                    <th className="text-center p-3 text-xs font-semibold">Approbation</th>
                    <th className="text-center p-3 text-xs font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingStudents ? (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Chargement...</td></tr>
                  ) : students.length === 0 ? (
                    <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Aucun étudiant</td></tr>
                  ) : students.map((s: any) => {
                    const edit = getEdit(s.user_id);
                    const cc = parseFloat(edit.cc);
                    const ex = parseFloat(edit.exam);
                    const avg = !isNaN(cc) && !isNaN(ex) ? (cc * 0.4 + ex * 0.6).toFixed(2) : "—";
                    const existingGrade: any = gradeMap.get(s.user_id);
                    const isEdited = !!gradeEdits[s.user_id];
                    const hasGrade = !!existingGrade;
                    const status = existingGrade?.submission_status || "—";
                    const locked = status === "submitted";
                    return (
                      <tr key={s.user_id} className={`border-b border-border/50 hover:bg-secondary/20 ${isEdited ? "bg-accent/5" : ""}`}>
                        <td className="p-3 text-sm font-medium">{s.first_name} {s.last_name}</td>
                        <td className="p-3 text-xs text-center font-mono text-accent">{s.student_number || "—"}</td>
                        <td className="p-3 text-center">
                          <Input type="number" min="0" max="20" step="0.25" className="w-20 mx-auto text-center h-9"
                            value={edit.cc} disabled={locked}
                            onChange={(e) => setEdit(s.user_id, "cc", e.target.value)} placeholder="—" />
                        </td>
                        <td className="p-3 text-center">
                          <Input type="number" min="0" max="20" step="0.25" className="w-20 mx-auto text-center h-9"
                            value={edit.exam} disabled={locked}
                            onChange={(e) => setEdit(s.user_id, "exam", e.target.value)} placeholder="—" />
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-sm font-bold ${avg !== "—" && parseFloat(avg) >= 10 ? "text-green-500" : avg !== "—" ? "text-destructive" : "text-muted-foreground"}`}>
                            {avg !== "—" ? `${avg}/20` : "—"}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          {status === "draft" && <Badge variant="outline" className="text-[10px]">Brouillon</Badge>}
                          {status === "pending_approval" && <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 text-[10px]">En vérification</Badge>}
                          {status === "submitted" && <Badge className="bg-green-600/15 text-green-700 border-green-600/30 text-[10px]"><Lock className="w-3 h-3 mr-1 inline" />Transmis</Badge>}
                          {!hasGrade && isEdited && <Badge variant="outline" className="text-[10px]">Nouveau</Badge>}
                          {!hasGrade && !isEdited && <Badge variant="outline" className="text-[10px] text-muted-foreground">—</Badge>}
                        </td>
                        <td className="p-3 text-center">
                          {existingGrade?.approved_by_student ? (
                            <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                              <CheckCircle2 className="w-4 h-4" /> Signé
                            </span>
                          ) : status === "pending_approval" ? (
                            <span className="inline-flex items-center gap-1 text-amber-600 text-xs">
                              <Clock className="w-4 h-4" /> En attente
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {!hasGrade && !isEdited && (
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-accent hover:bg-accent/10"
                                onClick={() => setEdit(s.user_id, "cc", "")} title="Ajouter">
                                <Plus className="w-4 h-4" />
                              </Button>
                            )}
                            {hasGrade && !locked && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" title="Supprimer">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Supprimer la note ?</AlertDialogTitle>
                                    <AlertDialogDescription>Supprimer la note de {s.first_name} {s.last_name} ?</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteMutation.mutate(existingGrade.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {allLocked && (
        <div className="rounded-lg border border-green-600/30 bg-green-600/5 p-4 text-sm text-green-700 flex items-center gap-2">
          <Lock className="w-4 h-4" /> Toutes les notes de cette matière ont été transmises à l'administration et sont définitivement verrouillées.
        </div>
      )}
    </motion.div>
  );
};


const ProfessorGradesPage = () => {
  const { hasUniversite, isLoading } = useCycle();
  if (isLoading) return null;
  if (!hasUniversite) return <ProfessorSchoolGrades />;
  return <ProfessorGradesUniversity />;
};

export default ProfessorGradesPage;

