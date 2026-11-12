import {PhoneInput} from '@/components/ui/phone-input';
import DossierEnrollmentStatus from '@/components/admin/DossierEnrollmentStatus';
import DossierOverview from '@/components/admin/DossierOverview';
import {studentCycle} from '@/lib/academicCycles';
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft, User, Mail, Phone, MapPin, Calendar, GraduationCap,
  Pencil, Upload, Download, Trash2, Plus, FileText, History,
  CheckCircle2, XCircle, AlertTriangle, CreditCard, BookOpen, Award,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearSelector } from "@/components/AcademicYearSelector";
import { toast } from "sonner";

import { useCycle } from "@/hooks/useCycle";
import AdminStudentDossierScolaire from "./AdminStudentDossierScolaire";
import StudentProgression from '@/components/admin/StudentProgression';

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const formatCFA = (n: number) => (n || 0).toLocaleString("fr-FR") + " FCFA";
const computeAvg = (cc: number | null, exam: number | null) => {
  if (cc == null && exam == null) return null;
  return Number((((cc || 0) * 0.4) + ((exam || 0) * 0.6)).toFixed(2));
};
const formatGrade = (value: number | null | undefined) => value != null ? Number(value).toFixed(2) : "—";

const DOC_TYPES = [
  { value: "bulletin", label: "Bulletin" },
  { value: "releve", label: "Relevé de notes" },
  { value: "certificat", label: "Certificat de scolarité" },
  { value: "attestation", label: "Attestation" },
  { value: "recu", label: "Reçu" },
  { value: "autre", label: "Autre" },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  in_progress: { label: "En cours", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Admis", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  redoublement: { label: "Redoublant", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  failed: { label: "Échoué", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  excluded: { label: "Exclu", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const AdminStudentDetailPage = () => {
  const {userId}=useParams<{userId:string}>();
  const {selectedYear,isViewingHistory}=useAcademicYear();
  const {hasUniversite,hasCollege,hasLycee,isLoading}=useCycle();
  const placement=useQuery({queryKey:['dossier-cycle',userId,selectedYear],enabled:!!userId,queryFn:async()=>{
    const annual=await(supabase as any).from('student_years').select('niveau,classes(cycle)').eq('user_id',userId).eq('academic_year',selectedYear).maybeSingle();if(annual.error)throw annual.error;
    if(annual.data)return studentCycle(annual.data.niveau,annual.data.classes?.cycle);
    if(isViewingHistory)return null;
    const profile=await(supabase as any).from('profiles').select('level,classes(cycle)').eq('user_id',userId).maybeSingle();if(profile.error)throw profile.error;return studentCycle(profile.data?.level,profile.data?.classes?.cycle);
  }});
  if(isLoading||placement.isLoading)return <p className="p-8 text-muted-foreground">Chargement du dossier…</p>;
  if(placement.isError)return <p role="alert" className="p-8">Impossible de déterminer le parcours de cet élève. Réessayez.</p>;
  if(placement.data==='college'||placement.data==='lycee'||(!hasUniversite&&(hasCollege||hasLycee)))return <AdminStudentDossierScolaire />;
  return <AdminStudentDetailUni />;
};

const AdminStudentDetailUni = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile: adminProfile } = useAuth();
  const { getLevels } = useInstitution();
  const { selectedYear, isViewingHistory, currentYear } = useAcademicYear();
  const LEVELS = getLevels();
  const instId = adminProfile?.institution_id;



  const [activeTab,setActiveTab]=useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [docDelete, setDocDelete] = useState<any>(null);

  // Profil
  const { data: student, isLoading } = useQuery({
    queryKey: ["student-detail", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, filieres(name)")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Historique académique (toutes années)
  const { data: histories = [] } = useQuery({
    queryKey: ["student-histories", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_year_history")
        .select("*, filieres(name)")
        .eq("user_id", userId!)
        .order("academic_year", { ascending: false });
      return data || [];
    },
  });
  const yearHistory = histories.find((h: any) => h.academic_year === selectedYear);

  // Notes de l'année sélectionnée
  const { data: grades = [], refetch: refetchGrades } = useQuery({
    queryKey: ["student-grades", userId, selectedYear],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("grades")
        .select("*, subjects(id, name, code, coefficient, credits, level, filiere_id)")
        .eq("user_id", userId!)
        .eq("academic_year", selectedYear);
      return data || [];
    },
  });

  // Toutes les notes (toutes années) pour le récap des crédits
  const { data: allGrades = [] } = useQuery({
    queryKey: ["student-all-grades", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("grades")
        .select("*, subjects(id, name, code, coefficient, credits, level, filiere_id, semester)")
        .eq("user_id", userId!);
      return data || [];
    },
  });

  // Matières disponibles (pour ajouter une note manquante)
  const { data: availableSubjects = [] } = useQuery({
    queryKey: ["student-available-subjects", userId, selectedYear, student?.filiere_id, student?.level],
    enabled: !!userId && !!student,
    queryFn: async () => {
      const lvl = yearHistory?.level || student!.level;
      const fil = yearHistory?.filiere_id || student!.filiere_id;
      let q = supabase.from("subjects").select("*");
      if (instId) q = q.eq("institution_id", instId);
      if (fil) q = q.eq("filiere_id", fil);
      if (lvl) q = q.eq("level", lvl);
      const { data } = await q.order("name");
      return data || [];
    },
  });

  // Rattrapages
  const { data: rattrapages = [] } = useQuery({
    queryKey: ["student-rattrapages", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("rattrapages")
        .select("*, subjects(name, credits, coefficient)")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Paiements de l'année sélectionnée
  const { data: payments = [] } = useQuery({
    queryKey: ["student-payments", userId, selectedYear],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", userId!)
        .eq("academic_year", selectedYear)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Documents
  const { data: documents = [] } = useQuery({
    queryKey: ["student-documents", userId, selectedYear],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_documents")
        .select("*")
        .eq("user_id", userId!)
        .eq("academic_year", selectedYear)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Filieres pour l'édition
  const { data: filieres = [] } = useQuery({
    queryKey: ["filieres-detail", instId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("id, name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q.order("name");
      return data || [];
    },
    enabled: !!instId,
  });

  // ===================== MUTATIONS =====================

  const updateProfileMutation = useMutation({
    mutationFn: async (form: any) => {
      const { error } = await supabase.from("profiles").update(form).eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-detail", userId] });
      toast.success("Profil mis à jour");
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const upsertGradeMutation = useMutation({
    mutationFn: async ({ subjectId, cc, exam, gradeId }: { subjectId: string; cc: number | null; exam: number | null; gradeId?: string }) => {
      const average = computeAvg(cc, exam);
      if (gradeId) {
        const { error } = await supabase.from("grades").update({
          cc_grade: cc, exam_grade: exam, average,
        }).eq("id", gradeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("grades").insert({
          user_id: userId!,
          subject_id: subjectId,
          cc_grade: cc,
          exam_grade: exam,
          average,
          academic_year: selectedYear,
          institution_id: instId,
          semester: "S1",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refetchGrades();
      toast.success("Note enregistrée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateRattrapageGradeMutation = useMutation({
    mutationFn: async ({ id, grade, userId: uid, subjectId, academicYear, subjectCredits }: { id: string; grade: number; userId: string; subjectId: string; academicYear: string; subjectCredits: number }) => {
      const passed = grade >= 10;
      const { error } = await supabase.from("rattrapages").update({
        rattrapage_grade: grade, final_grade: grade, status: passed ? "passed" : "failed",
      }).eq("id", id);
      if (error) throw error;

      const { data: hists } = await supabase
        .from("student_year_history")
        .select("*")
        .eq("user_id", uid)
        .order("academic_year", { ascending: false });

      let target = (hists || []).find((h: any) => (h.ue_to_retake_ids || []).includes(subjectId));
      if (!target) target = (hists || []).find((h: any) => (h.ue_validated_ids || []).includes(subjectId));
      if (!target) target = (hists || []).find((h: any) => h.academic_year === academicYear);

      if (target) {
        const validated: string[] = target.ue_validated_ids || [];
        const retake: string[] = target.ue_to_retake_ids || [];
        const wasValidated = validated.includes(subjectId);
        if (passed && !wasValidated) {
          await supabase.from("student_year_history").update({
            ue_validated_ids: [...validated, subjectId],
            ue_to_retake_ids: retake.filter((x) => x !== subjectId),
            credits_acquired: (target.credits_acquired || 0) + (subjectCredits || 0),
          }).eq("id", target.id);
        } else if (!passed) {
          const newRetake = retake.includes(subjectId) ? retake : [...retake, subjectId];
          const newValidated = validated.filter((x) => x !== subjectId);
          const delta = wasValidated ? -(subjectCredits || 0) : 0;
          await supabase.from("student_year_history").update({
            ue_validated_ids: newValidated,
            ue_to_retake_ids: newRetake,
            credits_acquired: Math.max(0, (target.credits_acquired || 0) + delta),
          }).eq("id", target.id);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-rattrapages", userId] });
      qc.invalidateQueries({ queryKey: ["student-histories", userId] });
      toast.success("Rattrapage enregistré");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addPaymentMutation = useMutation({
    mutationFn: async (form: { description: string; amount: number; status: string }) => {
      const { error } = await supabase.from("payments").insert({
        user_id: userId!,
        institution_id: instId,
        academic_year: selectedYear,
        description: form.description,
        amount: form.amount,
        status: form.status,
        payment_date: form.status === "paid" ? new Date().toISOString().split("T")[0] : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-payments", userId, selectedYear] });
      toast.success("Paiement ajouté");
      setPaymentOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePaymentMutation = useMutation({
    mutationFn: async (p: any) => {
      const newStatus = p.status === "paid" ? "pending" : "paid";
      const { error } = await supabase.from("payments").update({
        status: newStatus,
        payment_date: newStatus === "paid" ? new Date().toISOString().split("T")[0] : null,
      }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-payments", userId, selectedYear] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, docType, title }: { file: File; docType: string; title: string }) => {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("student-documents").upload(path, file);
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("student_documents").insert({
        user_id: userId!,
        institution_id: instId,
        uploaded_by: adminProfile?.user_id,
        academic_year: selectedYear,
        doc_type: docType,
        title,
        file_url: path,
        file_size: file.size,
        mime_type: file.type,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-documents", userId, selectedYear] });
      toast.success("Document téléversé");
      setDocOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (doc: any) => {
      await supabase.storage.from("student-documents").remove([doc.file_url]);
      const { error } = await supabase.from("student_documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-documents", userId, selectedYear] });
      toast.success("Document supprimé");
      setDocDelete(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadDoc = async (doc: any) => {
    const { data, error } = await supabase.storage.from("student-documents").createSignedUrl(doc.file_url, 60);
    if (error) { toast.error("Lien indisponible"); return; }
    window.open(data.signedUrl, "_blank");
  };

  // ===================== DERIVED =====================

  const totalPaid = payments.reduce((sum:number,p:any)=>sum+Number(p.paid_amount??(p.status==="paid"?p.amount:0)),0);
  const totalDue = payments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const remaining = totalDue - totalPaid;

  const subjectsToShow = useMemo(() => {
    const gradeBySubject = new Map(grades.map((g: any) => [g.subject_id, g]));
    return availableSubjects.map((s: any) => {
      const g: any = gradeBySubject.get(s.id);
      return {
        subject: s,
        grade: g,
        cc: g?.cc_grade ?? null,
        exam: g?.exam_grade ?? null,
        average: g?.average ?? null,
      };
    });
  }, [availableSubjects, grades]);

  const pendingRattrapages = rattrapages.filter((r: any) => r.status === "pending");

  // Récap crédits par année (basé sur les notes effectives)
  const creditsByYear = useMemo(() => {
    const ratByKey = new Map<string, any>();
    rattrapages.forEach((r: any) => {
      const key = `${r.user_id}-${r.subject_id}-${r.academic_year || ""}`;
      ratByKey.set(key, r);
    });
    const map = new Map<string, { year: string; level: string; subjects: any[]; validatedCredits: number; totalCredits: number }>();
    allGrades.forEach((g: any) => {
      if (!g.subjects) return;
      const year = g.academic_year || "—";
      const ratt = ratByKey.get(`${g.user_id}-${g.subject_id}-${year}`);
      const finalAvg = ratt?.status === "passed" && ratt.rattrapage_grade != null
        ? Math.max(g.average ?? 0, ratt.rattrapage_grade)
        : g.average;
      const validated = finalAvg != null && finalAvg >= 10;
      const credits = g.subjects.credits || 0;
      if (!map.has(year)) {
        const hist = histories.find((h: any) => h.academic_year === year);
        map.set(year, { year, level: hist?.level || g.subjects.level || "—", subjects: [], validatedCredits: 0, totalCredits: 0 });
      }
      const entry = map.get(year)!;
      entry.subjects.push({ ...g.subjects, average: finalAvg, validated, hasRatt: !!ratt });
      entry.totalCredits += credits;
      if (validated) entry.validatedCredits += credits;
    });
    return Array.from(map.values()).sort((a, b) => b.year.localeCompare(a.year));
  }, [allGrades, rattrapages, histories]);

  const globalValidated = creditsByYear.reduce((s, y) => s + y.validatedCredits, 0);
  const globalTotal = creditsByYear.reduce((s, y) => s + y.totalCredits, 0);

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!student) return <div className="p-8 text-center text-muted-foreground">Étudiant introuvable</div>;

  const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
  const initials = (student.first_name?.[0] || "") + (student.last_name?.[0] || "");

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 dossier-page">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/students")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Dossier étudiant</h1>
            <p className="text-sm text-muted-foreground">{fullName} — {student.student_number || "—"}</p>
          </div>
        </div>
        <AcademicYearSelector />
      </motion.div>

      {/* Identité */}
      <motion.div variants={item}>
        <Card className="border-border/50 overflow-hidden">
          <div className="h-24 bg-[#111e42]" />
          <CardContent className="p-6 pt-0 -mt-10">
            <div className="flex flex-col md:flex-row gap-6">
              <Avatar className="w-24 h-24 border-4 border-card shadow-md">
                <AvatarImage src={student.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-blue-600 text-white">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-3 pt-0 md:pt-12">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-xl font-bold">{fullName || "—"}</h2>
                  <Badge variant="outline">{student.student_number || "—"}</Badge>
                  {yearHistory && (
                    <Badge className={STATUS_LABEL[yearHistory.status]?.cls || ""}>
                      {STATUS_LABEL[yearHistory.status]?.label || yearHistory.status}
                    </Badge>
                  )}
                  {!yearHistory && selectedYear === currentYear && (
                    <Badge variant="secondary">Année active</Badge>
                  )}
                  <DossierEnrollmentStatus studentId={student.user_id}/>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" />{student.email || "—"}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" />{student.phone || "—"}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" />{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("fr-FR") : "—"}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><GraduationCap className="w-4 h-4" />{(student.filieres as any)?.name || "—"} • {yearHistory?.level || student.level}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" />{student.department || "—"}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><User className="w-4 h-4" />{student.statut_boursier ? "Boursier" : "Non boursier"}</div>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-2">
                  <Pencil className="w-4 h-4" /> Modifier
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={item}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5 dossier-tabs">
          <TabsList className="flex w-full justify-start overflow-x-auto h-auto p-1.5 bg-secondary/50 rounded-xl gap-1">
            <TabsTrigger value="overview">Synthèse</TabsTrigger>
            <TabsTrigger value="parcours"><History className="w-4 h-4 mr-1" />Parcours</TabsTrigger>
            <TabsTrigger value="grades"><BookOpen className="w-4 h-4 mr-1" />Notes</TabsTrigger>
            <TabsTrigger value="rattrapages"><AlertTriangle className="w-4 h-4 mr-1" />Rattrapages</TabsTrigger>
            <TabsTrigger value="credits"><Award className="w-4 h-4 mr-1" />Crédits</TabsTrigger>
            <TabsTrigger value="payments"><CreditCard className="w-4 h-4 mr-1" />Paiements</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="w-4 h-4 mr-1" />Documents</TabsTrigger>
          </TabsList>

          {/* HISTORIQUE */}
          <TabsContent value="overview"><DossierOverview year={selectedYear} email={student.email} phone={student.phone} onNavigate={setActiveTab} metrics={[
              {label:'Formation',value:(student.filieres as any)?.name||'Non renseignée',detail:yearHistory?.level||student.level||'Niveau à renseigner',tab:'parcours'},
              {label:'Résultats',value:grades.length+' évaluation(s)',detail:'Notes de l’année sélectionnée',tab:'grades'},
              {label:'Reste à payer',value:Math.max(0,remaining).toLocaleString('fr-FR')+' FCFA',detail:'Selon les échéances enregistrées',tab:'payments'},
              {label:'Pièces du dossier',value:documents.length+' document(s)',detail:'Documents de '+selectedYear,tab:'documents'},
            ]}/></TabsContent>
          <TabsContent value="parcours" className="space-y-5"><StudentProgression studentId={userId!} editable/>
            <Card>
              <CardHeader><CardTitle className="text-base">Parcours académique complet</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 border-b">
                    <tr>
                      <th className="text-left p-3">Année</th>
                      <th className="text-left p-3">Niveau</th>
                      <th className="text-left p-3">Filière</th>
                      <th className="text-left p-3">Statut</th>
                      <th className="text-left p-3">Crédits</th>
                      <th className="text-left p-3">Décision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {histories.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun historique enregistré</td></tr>
                    ) : histories.map((h: any) => (
                      <tr key={h.id} className="border-b border-border/40 hover:bg-secondary/20 cursor-default">
                        <td className="p-3 font-medium">{h.academic_year}</td>
                        <td className="p-3">{h.level}</td>
                        <td className="p-3 text-muted-foreground">{(h.filieres as any)?.name || "—"}</td>
                        <td className="p-3">
                          <Badge className={STATUS_LABEL[h.status]?.cls || ""}>
                            {STATUS_LABEL[h.status]?.label || h.status}
                          </Badge>
                        </td>
                        <td className="p-3">{h.credits_acquired || 0}/{h.credits_total || 60}</td>
                        <td className="p-3 text-muted-foreground">{h.decision || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* NOTES */}
          <TabsContent value="grades">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Notes — {selectedYear}</CardTitle>
                  {isViewingHistory && <Badge variant="outline" className="border-warning/40 text-warning">Lecture seule</Badge>}
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 border-b">
                    <tr>
                      <th className="text-left p-3">Matière</th>
                      <th className="text-left p-3">Coef.</th>
                      <th className="text-left p-3">Crédits</th>
                      <th className="text-left p-3">CC (40%)</th>
                      <th className="text-left p-3">Examen (60%)</th>
                      <th className="text-left p-3">Moyenne</th>
                      <th className="text-left p-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subjectsToShow.length === 0 ? (
                      <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucune matière pour cette année</td></tr>
                    ) : subjectsToShow.map((row: any) => {
                      const validated = row.average != null && row.average >= 10;
                      return (
                        <tr key={row.subject.id} className="border-b border-border/40 hover:bg-secondary/20">
                          <td className="p-3 font-medium">
                            {row.subject.name}
                            <span className="block text-xs text-muted-foreground">{row.subject.code || ""}</span>
                          </td>
                          <td className="p-3">{row.subject.coefficient}</td>
                          <td className="p-3">{row.subject.credits}</td>
                          <td className="p-2">
                            <Input
                              type="number" min="0" max="20" step="0.25"
                              defaultValue={row.cc ?? ""}
                              disabled={isViewingHistory}
                              className="w-20 h-8"
                              onBlur={(e) => {
                                const v = e.target.value === "" ? null : parseFloat(e.target.value);
                                if (v !== null && (isNaN(v) || v < 0 || v > 20)) return;
                                if (v !== row.cc) upsertGradeMutation.mutate({
                                  subjectId: row.subject.id, cc: v, exam: row.exam, gradeId: row.grade?.id,
                                });
                              }}
                            />
                          </td>
                          <td className="p-2">
                            <Input
                              type="number" min="0" max="20" step="0.25"
                              defaultValue={row.exam ?? ""}
                              disabled={isViewingHistory}
                              className="w-20 h-8"
                              onBlur={(e) => {
                                const v = e.target.value === "" ? null : parseFloat(e.target.value);
                                if (v !== null && (isNaN(v) || v < 0 || v > 20)) return;
                                if (v !== row.exam) upsertGradeMutation.mutate({
                                  subjectId: row.subject.id, cc: row.cc, exam: v, gradeId: row.grade?.id,
                                });
                              }}
                            />
                          </td>
                          <td className="p-3 font-semibold">{formatGrade(row.average)}</td>
                          <td className="p-3">
                            {row.average == null ? <Badge variant="outline">—</Badge> :
                              validated
                                ? <Badge className="bg-success/15 text-success gap-1"><CheckCircle2 className="w-3 h-3" />Validée</Badge>
                                : <Badge className="bg-destructive/15 text-destructive gap-1"><XCircle className="w-3 h-3" />Non validée</Badge>
                            }
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RATTRAPAGES */}
          <TabsContent value="rattrapages">
            <Card>
              <CardHeader><CardTitle className="text-base">Rattrapages</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/40 border-b">
                    <tr>
                      <th className="text-left p-3">Matière</th>
                      <th className="text-left p-3">Année origine</th>
                      <th className="text-left p-3">Moy. initiale</th>
                      <th className="text-left p-3">Note rattrapage</th>
                      <th className="text-left p-3">Crédits</th>
                      <th className="text-left p-3">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rattrapages.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun rattrapage</td></tr>
                    ) : rattrapages.map((r: any) => (
                      <tr key={r.id} className="border-b border-border/40 hover:bg-secondary/20">
                        <td className="p-3 font-medium">{(r.subjects as any)?.name || "—"}</td>
                        <td className="p-3"><Badge variant="outline" className="text-xs">{r.academic_year || "—"}</Badge></td>
                        <td className="p-3">{r.original_average != null ? `${formatGrade(r.original_average)}/20` : "—"}</td>
                        <td className="p-2">
                          <Input
                            type="number" min="0" max="20" step="0.5"
                            defaultValue={r.rattrapage_grade ?? ""}
                            className="w-20 h-8"
                            onBlur={(e) => {
                              const v = parseFloat(e.target.value);
                              if (!isNaN(v) && v !== r.rattrapage_grade) {
                                updateRattrapageGradeMutation.mutate({
                                  id: r.id, grade: v, userId: r.user_id, subjectId: r.subject_id,
                                  academicYear: r.academic_year || selectedYear,
                                  subjectCredits: (r.subjects as any)?.credits || 0,
                                });
                              }
                            }}
                          />
                        </td>
                        <td className="p-3">{(r.subjects as any)?.credits || 0}</td>
                        <td className="p-3">
                          {r.status === "passed" ? <Badge className="bg-success/15 text-success">Validé</Badge>
                            : r.status === "failed" ? <Badge className="bg-destructive/15 text-destructive">Non validé</Badge>
                            : <Badge className="bg-warning/15 text-warning">En attente</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            {pendingRattrapages.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                💡 La note de rattrapage est appliquée automatiquement à l'historique de l'année d'origine de la matière.
              </p>
            )}
          </TabsContent>

          {/* CRÉDITS */}
          <TabsContent value="credits">
            <div className="space-y-4">
              {/* Récap global */}
              <Card>
                <CardHeader><CardTitle className="text-base">Récapitulatif global des crédits</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 rounded-lg bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
                      <p className="text-xs text-muted-foreground">Crédits validés (toutes années)</p>
                      <p className="text-2xl font-bold text-success">{globalValidated}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-secondary/40 border border-border/40">
                      <p className="text-xs text-muted-foreground">Crédits totaux suivis</p>
                      <p className="text-2xl font-bold">{globalTotal}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                      <p className="text-xs text-muted-foreground">Taux de validation</p>
                      <p className="text-2xl font-bold text-accent">
                        {globalTotal > 0 ? Math.round((globalValidated / globalTotal) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Détail par année */}
              {creditsByYear.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-muted-foreground">
                    Aucune note enregistrée pour calculer les crédits.
                  </CardContent>
                </Card>
              ) : creditsByYear.map((year) => {
                const hist = histories.find((h: any) => h.academic_year === year.year);
                const yearTotal = hist?.credits_total || 60;
                const pct = yearTotal > 0 ? Math.round((year.validatedCredits / yearTotal) * 100) : 0;
                return (
                  <Card key={year.year}>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <CardTitle className="text-base">
                            {year.year} <span className="text-muted-foreground font-normal">— {year.level}</span>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {year.subjects.length} matières · {year.subjects.filter((s: any) => s.validated).length} validées
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="gradient-gold text-accent-foreground text-sm px-3 py-1">
                            {year.validatedCredits}/{yearTotal} crédits
                          </Badge>
                          <Badge variant="outline" className={pct >= 100 ? "border-success/40 text-success" : "border-border/40"}>
                            {pct}%
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary/40 border-y">
                            <tr>
                              <th className="text-left p-3">Matière</th>
                              <th className="text-left p-3">Code</th>
                              <th className="text-center p-3">Crédits</th>
                              <th className="text-center p-3">Moyenne</th>
                              <th className="text-center p-3">Statut</th>
                            </tr>
                          </thead>
                          <tbody>
                            {year.subjects.map((s: any) => (
                              <tr key={s.id} className="border-b border-border/30 hover:bg-secondary/20">
                                <td className="p-3 font-medium">{s.name}</td>
                                <td className="p-3 text-xs text-muted-foreground">{s.code || "—"}</td>
                                <td className="p-3 text-center font-semibold">{s.credits || 0}</td>
                                <td className="p-3 text-center">
                                  {formatGrade(s.average)}
                                  {s.hasRatt && <span className="ml-1 text-[10px] text-accent">(ratt.)</span>}
                                </td>
                                <td className="p-3 text-center">
                                  {s.validated
                                    ? <Badge className="bg-success/15 text-success gap-1"><CheckCircle2 className="w-3 h-3" />+{s.credits || 0} cr.</Badge>
                                    : <Badge className="bg-destructive/15 text-destructive gap-1"><XCircle className="w-3 h-3" />0 cr.</Badge>}
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-secondary/30 font-semibold">
                              <td className="p-3" colSpan={2}>Sous-total {year.year}</td>
                              <td className="p-3 text-center">{year.totalCredits}</td>
                              <td className="p-3"></td>
                              <td className="p-3 text-center text-success">{year.validatedCredits} validés</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>


          {/* PAIEMENTS */}
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Paiements — {selectedYear}</CardTitle>
                  {!isViewingHistory && (
                    <Button size="sm" onClick={() => setPaymentOpen(true)} className="gap-2">
                      <Plus className="w-4 h-4" /> Ajouter
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-secondary/40">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{formatCFA(totalDue)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-success/10">
                    <p className="text-xs text-muted-foreground">Payé</p>
                    <p className="text-lg font-bold text-success">{formatCFA(totalPaid)}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/10">
                    <p className="text-xs text-muted-foreground">Reste</p>
                    <p className="text-lg font-bold text-destructive">{formatCFA(remaining)}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b">
                      <tr>
                        <th className="text-left p-3">Description</th>
                        <th className="text-left p-3">Montant</th>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">Aucun paiement</td></tr>
                      ) : payments.map((p: any) => (
                        <tr key={p.id} className="border-b border-border/40">
                          <td className="p-3">{p.description}</td>
                          <td className="p-3 font-medium">{formatCFA(p.amount)}</td>
                          <td className="p-3 text-muted-foreground text-xs">{p.payment_date || "—"}</td>
                          <td className="p-3">
                            {!isViewingHistory ? (
                              <Button
                                variant={p.status === "paid" ? "default" : "outline"}
                                size="sm"
                                onClick={() => togglePaymentMutation.mutate(p)}
                              >
                                {p.status === "paid" ? "Payé" : p.status === "partial" ? "Partiel" : "Non payé"}
                              </Button>
                            ) : (
                              <Badge variant={p.status === "paid" ? "default" : "outline"}>
                                {p.status === "paid" ? "Payé" : p.status === "partial" ? "Partiel" : "Non payé"}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* DOCUMENTS */}
          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Documents — {selectedYear}</CardTitle>
                  <Button size="sm" onClick={() => setDocOpen(true)} className="gap-2">
                    <Upload className="w-4 h-4" /> Téléverser
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {documents.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Aucun document</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {documents.map((d: any) => (
                      <div key={d.id} className="flex items-center justify-between border rounded-lg p-3 hover:bg-secondary/20">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-8 h-8 text-primary flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{d.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {DOC_TYPES.find((t) => t.value === d.doc_type)?.label || d.doc_type} • {new Date(d.created_at).toLocaleDateString("fr-FR")}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => downloadDoc(d)}>
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDocDelete(d)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* === DIALOG : Édition profil === */}
      <EditProfileDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        student={student}
        filieres={filieres}
        levels={LEVELS}
        onSave={(form) => updateProfileMutation.mutate(form)}
        saving={updateProfileMutation.isPending}
      />

      {/* === DIALOG : Téléverser document === */}
      <UploadDocDialog
        open={docOpen}
        onOpenChange={setDocOpen}
        onUpload={(file, docType, title) => uploadDocMutation.mutate({ file, docType, title })}
        uploading={uploadDocMutation.isPending}
      />

      {/* === DIALOG : Ajouter paiement === */}
      <AddPaymentDialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        onAdd={(form) => addPaymentMutation.mutate(form)}
        saving={addPaymentMutation.isPending}
      />

      {/* === ALERT : Suppression doc === */}
      <AlertDialog open={!!docDelete} onOpenChange={(o) => !o && setDocDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
            <AlertDialogDescription>Cette action est irréversible.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => docDelete && deleteDocMutation.mutate(docDelete)} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

// ===================== Sub-dialogs =====================

const EditProfileDialog = ({ open, onOpenChange, student, filieres, levels, onSave, saving }: any) => {
  const [form, setForm] = useState<any>({});
  useEffect(() => {
    if (open && student) {
      setForm({
        first_name: student.first_name || "",
        last_name: student.last_name || "",
        email: student.email || "",
        phone: student.phone || "",
        date_of_birth: student.date_of_birth || "",
        department: student.department || "",
        filiere_id: student.filiere_id || "",
        level: student.level || "",
        statut_boursier: !!student.statut_boursier,
      });
    }
  }, [open, student]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>Modifier les informations</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Prénom</Label><Input value={form.first_name || ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Nom</Label><Input value={form.last_name || ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Téléphone</Label><PhoneInput value={form.phone} onChange={phone=>setForm({...form,phone})}/></div>
            <div><Label>Date de naissance</Label><Input type="date" value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
          </div>
          <div><Label>Adresse</Label><Input value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Filière</Label>
              <Select value={form.filiere_id || ""} onValueChange={(v) => setForm({ ...form, filiere_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Niveau</Label>
              <Select value={form.level || ""} onValueChange={(v) => setForm({ ...form, level: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {levels.map((l: string) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={!!form.statut_boursier} onCheckedChange={(v) => setForm({ ...form, statut_boursier: v })} />
            <Label>Boursier</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => onSave(form)} disabled={saving}>{saving ? "..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const UploadDocDialog = ({ open, onOpenChange, onUpload, uploading }: any) => {
  const [docType, setDocType] = useState("bulletin");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setFile(null); setTitle(""); } }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Téléverser un document</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Titre</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Fichier</Label><Input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={() => file && title && onUpload(file, docType, title)}
            disabled={!file || !title || uploading}
          >
            {uploading ? "Envoi..." : "Téléverser"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const AddPaymentDialog = ({ open, onOpenChange, onAdd, saving }: any) => {
  const [form, setForm] = useState({ description: "", amount: 0, status: "pending" });
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setForm({ description: "", amount: 0, status: "pending" }); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nouveau paiement</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Frais de scolarité..." /></div>
          <div><Label>Montant (FCFA)</Label><Input type="number" value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: parseInt(e.target.value || "0", 10) })} /></div>
          <div>
            <Label>Statut</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Non payé</SelectItem>
                <SelectItem value="paid">Payé</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={() => onAdd(form)} disabled={!form.description || !form.amount || saving}>
            {saving ? "..." : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminStudentDetailPage;
