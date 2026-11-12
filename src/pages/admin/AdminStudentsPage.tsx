import {useCampus} from "@/hooks/useCampus";
import { generateInitialPassword } from "@/lib/password";
import StudentSpreadsheetImport from '@/components/admin/StudentSpreadsheetImport';
import { motion } from "framer-motion";
import { Users, Search, ArrowUpCircle, RotateCcw, Plus, Copy, Eye, EyeOff, GraduationCap, Trash2, Pencil, KeyRound, Lock, FolderOpen, FileText } from "lucide-react";
import { downloadAttestationPdf } from "@/lib/attestationPdf";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NationalitySelect } from "@/components/ui/nationality-select";
import { PhoneInput } from "@/components/ui/phone-input";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { AcademicYearSelector } from "@/components/AcademicYearSelector";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { usePermissions } from "@/hooks/usePermissions";
import { levelInScope } from "@/lib/academicScope";
import { useTerms } from "@/hooks/useTerms";
import { useCycle } from "@/hooks/useCycle";
import { COLLEGE_NIVEAUX, LYCEE_NIVEAUX, LYCEE_SERIES } from "@/lib/collegeLycee";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const NEXT_LEVEL: Record<string, string | null> = { L1: "L2", L2: "L3", L3: "M1", M1: "M2", M2: null, "6e": "5e", "5e": "4e", "4e": "3e", "3e": "2nde", "6ème": "5ème", "5ème": "4ème", "4ème": "3ème", "3ème": "2nde", "2nde": "1ère", "1ère": "Terminale", Terminale: null };

const formatCFA = (n: number) => n.toLocaleString("fr-FR") + " FCFA";

const defaultPaymentConfig = {
  licence: { boursier: { frais_administratifs: 250000, uniforme: 200000 }, non_boursier: { frais_administratifs: 210000, frais_scolarite: 990000, uniforme: 200000 } },
  master: { boursier: { frais_administratifs: 350000, uniforme: 200000 }, non_boursier: { frais_administratifs: 250000, frais_scolarite: 1900000, uniforme: 200000 } },
};

function getDebtTotal(level: string, boursier: boolean, paymentConfig?: any) {
  const cfg = paymentConfig || defaultPaymentConfig;
  const isL = ["L1", "L2", "L3"].includes(level);
  const cycle = isL ? "licence" : "master";
  const statut = boursier ? "boursier" : "non_boursier";
  const fees = { ...(cfg[cycle]?.[statut] || {}) };
  // Uniforme uniquement en 1re année de cycle (L1 ou M1)
  if (level !== "L1" && level !== "M1") delete (fees as any).uniforme;
  return (Object.values(fees) as number[]).reduce((a: number, b: number) => a + (Number(b) || 0), 0);
}

const AdminStudentsPage = () => {
  const { getLevels, institution: instData } = useInstitution();
  const { Student, student, students: studentsLbl } = useTerms();
  const { hasUniversite, hasCollege, hasLycee } = useCycle();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile } = useAuth();
  const { selectedYear, isViewingHistory, currentYear } = useAcademicYear();
  const instId = profile?.institution_id;
  const {campusId} = useCampus();
  const scolaireOnly = (hasCollege || hasLycee) && !hasUniversite;
  const LEVELS = scolaireOnly
    ? [...(hasCollege ? [...COLLEGE_NIVEAUX] : []), ...(hasLycee ? [...LYCEE_NIVEAUX] : [])]
    : getLevels();
  const levelsKey = LEVELS.join("|");
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterFiliere, setFilterFiliere] = useState<string>(((location.state as any)?.filiere_id as string) || "all");
  const [filterLevel, setFilterLevel] = useState<string>(((location.state as any)?.level as string) || "all");
  useEffect(() => {
    const st = location.state as any;
    if (st?.level) setFilterLevel(st.level);
    if (st?.filiere_id) setFilterFiliere(st.filiere_id);
  }, [location.state]);
  const filterYear = selectedYear;
  const [promoteDialog, setPromoteDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen,setImportOpen]=useState(false);
  const defaultLevel = LEVELS[0] || "L1";
  const [newStudent, setNewStudent] = useState<any>({ first_name: "", last_name: "", filiere_id: "", level: defaultLevel, password: generateInitialPassword(),request_key:crypto.randomUUID(), statut_boursier: false, matricule: "", date_of_birth: "", birth_place: "", nationality: "", parent_contact: "", address: "", sexe: "", tuteur_email: "", oriente_etat: false, classe_id: "", serie: "" });
  useEffect(() => {
    setNewStudent((s: any) => LEVELS.includes(s.level) ? s : { ...s, level: defaultLevel, filiere_id: "", serie: "", classe_id: "", statut_boursier: false });
  }, [defaultLevel, levelsKey]);
  const [createdInfo, setCreatedInfo] = useState<{ matricule: string; password: string; total_debt: number; filiere_name?: string; level?: string; classe_name?: string; serie?: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);

  // Edit state
  const [editOpen, setEditOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<any>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", filiere_id: "", level: "", statut_boursier: false });
  const [editPwdOpen, setEditPwdOpen] = useState(false);
  const [editNewPwd, setEditNewPwd] = useState("");

  // Password-only dialog (used for archived/figés students)
  const [pwdOnlyStudent, setPwdOnlyStudent] = useState<any>(null);
  const [pwdOnlyValue, setPwdOnlyValue] = useState("");

  // Delete state
  const [deleteStudent, setDeleteStudent] = useState<any>(null);

  const { data: filieres = [] } = useQuery({
    queryKey: ["admin-filieres", instId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["admin-classes", instId, filterYear],
    queryFn: async () => {
      const { data } = await (supabase as any).from("classes").select("*")
        .eq("institution_id", instId).eq("academic_year", filterYear).order("nom");
      return data || [];
    },
    enabled: !!instId,
  });

  // Normalise le niveau : "6ème" ↔ "6e" (classes créées avec "6e", profils avec "6ème")
  const normalizeNiveau = (n: string) => (n || "").replace(/ème$/i, "e").replace(/eme$/i, "e").trim();
  const cycleOfLevel = (lvl: string) => {
    const n = normalizeNiveau(lvl);
    if ([...COLLEGE_NIVEAUX].includes(n as any)) return "college";
    if ([...LYCEE_NIVEAUX].includes(lvl as any) || [...LYCEE_NIVEAUX].includes(n as any)) return "lycee";
    return "universite";
  };
  const currentCycle = cycleOfLevel(newStudent.level);
  const isScolaire = currentCycle === "college" || currentCycle === "lycee";
  const isLycee = currentCycle === "lycee";
  const serieOptions = isLycee ? (LYCEE_SERIES[newStudent.level] || LYCEE_SERIES[normalizeNiveau(newStudent.level)] || ["A1", "A2", "B", "C", "D", "S", "L"]) : [];
  const filteredClasses = (classes as any[]).filter((c) =>
    (!c.cycle || c.cycle === currentCycle)
    && normalizeNiveau(c.niveau) === normalizeNiveau(newStudent.level)
    && (!isLycee || !newStudent.serie || String(c.serie || "").toUpperCase() === String(newStudent.serie).toUpperCase())
    && (isScolaire || !newStudent.filiere_id || !c.filiere_id || c.filiere_id === newStudent.filiere_id)
  );

  // Dossier élève : documents à téléverser pendant l'inscription
  const DOC_CATEGORIES: { key: string; label: string; required: boolean; hint?: string }[] = [
    { key: "fiche_inscription", label: "Fiche d'inscription", required: false, hint: "PDF (générée automatiquement si absente)" },
    { key: "bulletin", label: "Dernier bulletin / carnet de notes", required: true },
    { key: "acte_naissance", label: "Acte de naissance", required: true },
    { key: "photo_identite", label: "Photos d'identité", required: true },
    { key: "certificat_scolarite", label: "Certificat de scolarité", required: false },
    { key: "certificat_medical", label: "Certificat médical (dispense EPS)", required: false },
  ];
  const [dossierFiles, setDossierFiles] = useState<Record<string, File | null>>({});


  // Étudiants visibles pour l'année sélectionnée :
  // - année active : tous les profils ayant academic_year = selectedYear
  // - années passées : tous les étudiants ayant un student_year_history sur cette année
  //   (même si leur profil a depuis été promu vers une année supérieure)
  const { data: students = [] } = useQuery({
    queryKey: ["admin-students", filterYear, instId, currentYear, campusId],
    queryFn: async () => {
      const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!studentRoles || studentRoles.length === 0) return [];
      const ids = studentRoles.map((r: any) => r.user_id);

      const isHistory = filterYear !== currentYear;

      if (!isHistory) {
        // Année active : profils qui sont actuellement dans cette année
        let q = supabase.from("profiles").select("*, filieres(name)").eq("academic_year", filterYear);
        if (instId) q = q.eq("institution_id", instId);
        if (campusId) q = q.eq("campus_id", campusId);
        q = q.in("user_id", ids);
        const { data } = await q.order("created_at", { ascending: false });
        return data || [];
      }

      // Année historique : on récupère depuis student_year_history pour avoir
      // le niveau/filière qu'ils avaient cette année-là
      const { data: annualHistories } = await (supabase as any)
        .from("student_years")
        .select("user_id,niveau,filiere_id,status,academic_year,campus_id,classe_id,filieres(name)")
        .eq('institution_id',instId).eq("academic_year", filterYear);
      const histories=(annualHistories||[]).filter((h:any)=>!campusId||h.campus_id===campusId).map((h:any)=>({...h,level:h.niveau}));
      if (!histories || histories.length === 0) return [];

      const histUserIds = histories.map((h: any) => h.user_id).filter((id: string) => ids.includes(id));
      if (histUserIds.length === 0) return [];

      // On enrichit avec le profil pour avoir nom/prénom/matricule/etc.
      let pq = supabase.from("profiles").select("*").in("user_id", histUserIds);
      if (instId) pq = pq.eq("institution_id", instId);
      const { data: profiles } = await pq;
      const profMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      // Combine : niveau/filière vient de l'historique, identité vient du profil
      return histories
        .filter((h: any) => profMap.has(h.user_id))
        .map((h: any) => {
          const p: any = profMap.get(h.user_id);
          return {
            ...p,
            level: h.level,
            campus_id:h.campus_id,
            classe_id:h.classe_id,
            filiere_id: h.filiere_id,
            filieres: h.filieres,
            academic_year: h.academic_year,
            _historical_status: h.status,
          };
        });
    },
    enabled: !!instId,
  });

  // Fetch student_year_history to show Admis/Redoublant status
  const { data: yearHistories = [] } = useQuery({
    queryKey: ["student-year-histories", filterYear, instId],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_year_history")
        .select("user_id, status, decision, academic_year")
        .eq("academic_year", filterYear);
      return data || [];
    },
    enabled: !!instId,
  });
  const historyMap = new Map(yearHistories.map((h: any) => [h.user_id, h]));

  useRealtimeSubscription("profiles", [["admin-students", filterYear]]);

  const filiereMap = new Map(filieres.map((f: any) => [f.id, f.name]));
  const classMap = new Map((classes as any[]).map((c: any) => [c.id, c.nom]));

  const { academicScope } = usePermissions();
  const filtered = students.filter((s: any) => {
    const matchSearch = `${s.first_name} ${s.last_name} ${s.email} ${s.student_number}`.toLowerCase().includes(search.toLowerCase());
    const matchFiliere = scolaireOnly || filterFiliere === "all" || s.filiere_id === filterFiliere;
    const matchLevel = filterLevel === "all" || normalizeNiveau(s.level) === normalizeNiveau(filterLevel);
    const matchScope = levelInScope(s.level, academicScope);
    return matchSearch && matchFiliere && matchLevel && matchScope;
  });

  const uploadDossier = async (userId: string) => {
    const entries = Object.entries(dossierFiles).filter(([, f]) => !!f) as [string, File][];
    for (const [cat, file] of entries) {
      try {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${userId}/${cat}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("student-documents").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        await supabase.from("student_documents").insert({
          user_id: userId, institution_id: instId, uploaded_by: profile?.user_id,
          academic_year: filterYear, doc_type: cat, title: DOC_CATEGORIES.find(d => d.key === cat)?.label || cat,
          file_url: path, file_size: file.size, mime_type: file.type,
        } as any);
      } catch (e: any) {
        toast.error(`Document ${cat}: ${e.message}`);
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("create-student", {
        body: {
          ...newStudent, campus_id: campusId,
          academic_year: filterYear,
          filiere_id: isScolaire ? "" : newStudent.filiere_id,
          statut_boursier: isScolaire ? false : newStudent.statut_boursier,
        }
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      if (res.data?.user_id) await uploadDossier(res.data.user_id);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      setCreatedInfo({
        matricule: data.matricule,
        password: newStudent.password,
        total_debt: data.total_debt ?? null,
        filiere_name: newStudent.filiere_id ? (filiereMap.get(newStudent.filiere_id) as string) : undefined,
        level: newStudent.level,
        classe_name: newStudent.classe_id ? (classMap.get(newStudent.classe_id) as string) : undefined,
        serie: newStudent.serie || undefined,
      });
      setNewStudent({ first_name: "", last_name: "", filiere_id: "", level: defaultLevel, password: generateInitialPassword(),request_key:crypto.randomUUID(), statut_boursier: false, matricule: "", date_of_birth: "", birth_place: "", nationality: "", parent_contact: "", address: "", sexe: "", tuteur_email: "", oriente_etat: false, classe_id: "", serie: "" });
      setDossierFiles({});
      toast.success(`${Student} créé ! Matricule: ${data.matricule}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editStudent) return;
      const isEditedScolaire = cycleOfLevel(editForm.level) !== "universite";
      const { error } = await supabase.from("profiles").update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        filiere_id: isEditedScolaire ? null : (editForm.filiere_id || null),
        level: editForm.level,
        statut_boursier: isEditedScolaire ? false : editForm.statut_boursier,
      }).eq("user_id", editStudent.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      toast.success("Étudiant mis à jour");
      setEditOpen(false);
      setEditStudent(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePwdMutation = useMutation({
    mutationFn: async () => {
      if (!editStudent) return;
      const res = await supabase.functions.invoke("update-user-password", {
        body: { user_id: editStudent.user_id, new_password: editNewPwd },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast.success("Mot de passe mis à jour");
      setEditPwdOpen(false);
      setEditNewPwd("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const pwdOnlyMutation = useMutation({
    mutationFn: async () => {
      if (!pwdOnlyStudent) return;
      if (pwdOnlyValue.length < 6) throw new Error("Le mot de passe doit contenir au moins 6 caractères");
      const res = await supabase.functions.invoke("update-user-password", {
        body: { user_id: pwdOnlyStudent.user_id, new_password: pwdOnlyValue },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      toast.success("Mot de passe mis à jour");
      setPwdOnlyStudent(null);
      setPwdOnlyValue("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await supabase.functions.invoke("delete-user-account", { body: { user_id: userId } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      toast.success("Étudiant supprimé définitivement");
      setDeleteStudent(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignMutation = useMutation({
    mutationFn: async ({ userId, filiereId, level }: { userId: string; filiereId: string; level: string }) => {
      const { error } = await supabase.from("profiles").update({ filiere_id: filiereId, level }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      toast.success("Étudiant mis à jour");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const promoteMutation = useMutation({
    mutationFn: async ({ student, nextLevel, nextYear }: { student: any; nextLevel: string; nextYear: string }) => {
      const { error } = await (supabase as any).rpc('advance_student',{_student:student.user_id,_from:filterYear,_to:nextYear,_level:nextLevel,_campus:student.campus_id||campusId,_repeat:false});
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      toast.success("Inscription au niveau suivant préparée ; les anciennes années sont conservées.");
      setPromoteDialog(false); setSelectedStudent(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const redoubleMutation = useMutation({
    mutationFn: async ({ student, nextYear }: { student: any; nextYear: string }) => {
      const { error } = await (supabase as any).rpc('advance_student',{_student:student.user_id,_from:filterYear,_to:nextYear,_level:student.level,_campus:student.campus_id||campusId,_repeat:true});
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-students"] });
      toast.success("Redoublement enregistré");
      setPromoteDialog(false); setSelectedStudent(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getNextYear = (year: string) => {
    const [start, end] = year.split("-").map(Number);
    return `${start + 1}-${end + 1}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié !");
  };

  const openEdit = (s: any) => {
    setEditStudent(s);
    setEditForm({
      first_name: s.first_name || "",
      last_name: s.last_name || "",
      filiere_id: s.filiere_id || "",
      level: s.level || "L1",
      statut_boursier: s.statut_boursier || false,
    });
    setEditOpen(true);
  };

  const paymentConfig = (instData as any)?.payment_config || defaultPaymentConfig;
  const debtPreview = getDebtTotal(newStudent.level, newStudent.statut_boursier, paymentConfig);
  const editIsScolaire = editForm.level ? cycleOfLevel(editForm.level) !== "universite" : scolaireOnly;

  const { data: scolaireDebtPreview = [] } = useQuery({
    queryKey: ["scolaire-debt-preview", instId, currentCycle, newStudent.level, newStudent.serie, newStudent.oriente_etat],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("compute_scolaire_debt", {
        _institution_id: instId,
        _cycle: currentCycle,
        _niveau: newStudent.level,
        _serie: newStudent.serie || null,
        _oriente: !!newStudent.oriente_etat,
      });
      return data || [];
    },
    enabled: !!instId && isScolaire && createOpen,
  });
  const scolaireDebtTotal = (scolaireDebtPreview as any[]).reduce((s, r) => s + Number(r.amount || 0), 0);


  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Inscription / {Student}</h1>
          <p className="text-muted-foreground mt-1">{filtered.length} {student}(s) inscrit(s) — {filterYear} {isViewingHistory && <span className="text-warning font-medium">(historique — lecture seule)</span>}</p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <AcademicYearSelector />
          {!isViewingHistory&&instId&&<Dialog open={importOpen} onOpenChange={setImportOpen}><DialogTrigger asChild><Button variant="outline">Importer Excel</Button></DialogTrigger><DialogContent className="app-shell student-import-dialog max-w-5xl max-h-[90svh] overflow-y-auto"><DialogHeader><DialogTitle>Import des étudiants</DialogTitle></DialogHeader><StudentSpreadsheetImport institutionId={instId} onImportComplete={()=>void qc.invalidateQueries()}/></DialogContent></Dialog>}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Rechercher..." className="pl-9 bg-secondary/50" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {!isViewingHistory && (
          <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreatedInfo(null); }}>
            <DialogTrigger asChild>
              <Button className="gradient-gold text-accent-foreground gap-2"><Plus className="w-4 h-4" /> Inscrire un {student}</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-accent" />
                  Inscrire un nouvel {student}
                </DialogTitle>
              </DialogHeader>
              {createdInfo ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                    <p className="text-sm font-medium text-foreground mb-3">✅ {Student} créé avec succès !</p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                        <span className="text-sm"><strong>Matricule :</strong> {createdInfo.matricule}</span>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(createdInfo.matricule)}><Copy className="w-4 h-4" /></Button>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                        <span className="text-sm"><strong>Mot de passe :</strong> {showPwd ? createdInfo.password : "••••••••"}</span>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setShowPwd(!showPwd)}>
                            {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => copyToClipboard(createdInfo.password)}><Copy className="w-4 h-4" /></Button>
                        </div>
                      </div>
                      <div className="p-2 rounded bg-accent/10 border border-accent/20">
                        <span className="text-sm font-medium">{createdInfo.total_debt == null ? "Frais à configurer et vérifier dans les paiements." : `Dette générée : ${formatCFA(createdInfo.total_debt)}`}</span>
                      </div>
                      <div className="p-2 rounded bg-secondary/50 border border-border/50 space-y-0.5">
                        {createdInfo.filiere_name && (
                          <p className="text-xs"><strong>Filière :</strong> {createdInfo.filiere_name}</p>
                        )}
                        {createdInfo.level && (
                          <p className="text-xs"><strong>Niveau :</strong> {createdInfo.level}{createdInfo.serie ? ` — Série ${createdInfo.serie}` : ""}</p>
                        )}
                        {createdInfo.classe_name && (
                          <p className="text-xs"><strong>Classe / Groupe :</strong> {createdInfo.classe_name}</p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-3">Communiquez ces identifiants à l'{student}.</p>
                  </div>
                  <Button onClick={() => { setCreatedInfo(null); setCreateOpen(false); }} className="w-full">Fermer</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Matricule automatique</Label>
                    <p className="text-xs text-muted-foreground">Généré à la création : initiales de l’établissement, initiales de l’élève, année d’inscription et numéro unique.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Prénom *</Label>
                      <Input value={newStudent.first_name} onChange={(e) => setNewStudent({ ...newStudent, first_name: e.target.value })} placeholder="Ama" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Nom *</Label>
                      <Input value={newStudent.last_name} onChange={(e) => setNewStudent({ ...newStudent, last_name: e.target.value })} placeholder="Koné" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {!isScolaire && (
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Filière</Label>
                        <Select value={newStudent.filiere_id} onValueChange={(v) => setNewStudent({ ...newStudent, filiere_id: v, classe_id: "" })}>
                          <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                          <SelectContent>
                            {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Niveau</Label>
                      <Select value={newStudent.level} onValueChange={(v) => setNewStudent({ ...newStudent, level: v, filiere_id: "", serie: "", classe_id: "" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Date de naissance</Label>
                      <Input type="date" value={newStudent.date_of_birth} onChange={(e) => setNewStudent({ ...newStudent, date_of_birth: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Lieu de naissance</Label>
                      <Input value={newStudent.birth_place} onChange={(e) => setNewStudent({ ...newStudent, birth_place: e.target.value })} placeholder="Libreville" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nationalité</Label>
                    <NationalitySelect value={newStudent.nationality} onChange={(v) => setNewStudent({ ...newStudent, nationality: v })} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Sexe</Label>
                      <Select value={newStudent.sexe} onValueChange={(v) => setNewStudent({ ...newStudent, sexe: v })}>
                        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculin</SelectItem>
                          <SelectItem value="F">Féminin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Email tuteur (optionnel)</Label>
                      <Input type="email" value={newStudent.tuteur_email} onChange={(e) => setNewStudent({ ...newStudent, tuteur_email: e.target.value })} placeholder="parent@exemple.com" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Contact parent / tuteur</Label>
                    <PhoneInput value={newStudent.parent_contact} onChange={(v) => setNewStudent({ ...newStudent, parent_contact: v })} placeholder="Téléphone du parent" />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Adresse</Label>
                    <Input value={newStudent.address} onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })} placeholder="Adresse postale" />
                  </div>

                  {isScolaire && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        {isLycee && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Série *</Label>
                            <Select value={newStudent.serie} onValueChange={(v) => setNewStudent({ ...newStudent, serie: v, classe_id: "" })}>
                              <SelectTrigger><SelectValue placeholder="Choisir la série" /></SelectTrigger>
                              <SelectContent>
                                {serieOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Classe *</Label>
                          <Select value={newStudent.classe_id} onValueChange={(v) => setNewStudent({ ...newStudent, classe_id: v })}>
                            <SelectTrigger><SelectValue placeholder={filteredClasses.length ? "Choisir" : "Aucune classe créée"} /></SelectTrigger>
                            <SelectContent>
                              {filteredClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                        <div>
                          <Label className="text-sm font-medium text-foreground">Élève orienté par l'État</Label>
                          <p className="text-xs text-muted-foreground">Paie tous les frais prévus (comme les autres élèves) + le frais « scolarité orientée » s'il est configuré. Sera remboursé quand l'État versera la subvention.</p>
                        </div>
                        <Switch checked={newStudent.oriente_etat} onCheckedChange={(v) => setNewStudent({ ...newStudent, oriente_etat: v })} />
                      </div>
                      <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                        <p className="text-sm font-medium text-foreground">💰 Dette automatique : {formatCFA(scolaireDebtTotal)}</p>
                        {(scolaireDebtPreview as any[]).length === 0 ? (
                          <p className="text-xs text-muted-foreground mt-1">Aucun frais configuré. Configurez les frais dans Finances → Types de frais.</p>
                        ) : (
                          <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                            {(scolaireDebtPreview as any[]).map((r: any, i: number) => (
                              <li key={i} className="flex justify-between"><span>{r.description}</span><span>{formatCFA(Number(r.amount))}</span></li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}

                  {!isScolaire && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Classe / Groupe</Label>
                        <Select value={newStudent.classe_id} onValueChange={(v) => setNewStudent({ ...newStudent, classe_id: v })}>
                          <SelectTrigger>
                            <SelectValue placeholder={
                              !newStudent.filiere_id ? "Sélectionnez d'abord une filière"
                              : filteredClasses.length ? "Choisir la classe / le groupe"
                              : "Aucun groupe créé pour ce niveau"
                            } />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredClasses.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <p className="text-[10px] text-muted-foreground">Optionnel — permet d'affecter l'étudiant à un groupe (ex : L1 INFO A).</p>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
                        <div>
                          <Label className="text-sm font-medium text-foreground">Étudiant boursier</Label>
                          <p className="text-xs text-muted-foreground">Réduit les frais de scolarité</p>
                        </div>
                        <Switch checked={newStudent.statut_boursier} onCheckedChange={(v) => setNewStudent({ ...newStudent, statut_boursier: v })} />
                      </div>
                      <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                        <p className="text-sm font-medium text-foreground">💰 Dette automatique : {formatCFA(debtPreview)}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {newStudent.statut_boursier ? "Boursier" : "Non boursier"} — {["L1","L2","L3"].includes(newStudent.level) ? "Licence" : "Master"}
                        </p>
                      </div>
                    </>
                  )}

                  <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-secondary/20">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="w-4 h-4 text-accent" />
                      <Label className="text-sm font-medium text-foreground">Pièces à fournir (dossier élève)</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">Téléversez maintenant ou plus tard depuis la fiche de l'{student}.</p>
                    <div className="space-y-2">
                      {DOC_CATEGORIES.map((d) => (
                        <div key={d.key} className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <span className="text-foreground">{d.label}{d.required && <span className="text-destructive"> *</span>}</span>
                            {d.hint && <p className="text-muted-foreground text-[10px]">{d.hint}</p>}
                            {dossierFiles[d.key] && <p className="text-success text-[10px] truncate">✓ {dossierFiles[d.key]!.name}</p>}
                          </div>
                          <Input
                            type="file"
                            accept="image/*,application/pdf"
                            className="w-40 h-8 text-xs"
                            onChange={(e) => setDossierFiles({ ...dossierFiles, [d.key]: e.target.files?.[0] || null })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Mot de passe initial *</Label>
                    <Input type="password" value={newStudent.password} onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })} minLength={10} placeholder="10 caractères minimum" />
                    <p className="text-xs text-muted-foreground">Mot de passe initial généré automatiquement.</p>
                  </div>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={!newStudent.first_name || !newStudent.last_name || newStudent.password.length < 6 || createMutation.isPending || (isLycee && !newStudent.serie) || (isScolaire && !newStudent.classe_id)}
                    className="w-full gradient-gold text-accent-foreground"
                  >
                    {createMutation.isPending ? "Création..." : `Créer l'${student}`}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
          )}
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex flex-wrap gap-3">
        {!scolaireOnly && <Select value={filterFiliere} onValueChange={setFilterFiliere}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Toutes les filières" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les filières</SelectItem>
            {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>}
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Niveau" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-4 text-sm font-semibold text-foreground">Nom</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Matricule</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">{scolaireOnly ? "Classe" : "Filière"}</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Niveau</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Décision</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Statut</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Aucun {student} trouvé</td></tr>
                  ) : filtered.map((s: any) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="p-4 text-sm font-medium text-foreground">
                        <button
                          onClick={() => navigate(`/admin/students/${s.user_id}`)}
                          className="hover:text-accent hover:underline text-left"
                        >
                          {s.first_name} {s.last_name}
                        </button>
                      </td>
                      <td className="p-4 text-sm text-center font-mono text-accent">{s.student_number || "—"}</td>
                      <td className="p-4 text-sm text-center text-muted-foreground">{scolaireOnly ? (classMap.get(s.classe_id) || "—") : (filiereMap.get(s.filiere_id) || "—")}</td>
                      <td className="p-4 text-sm text-center">
                        <span className="bg-accent/15 text-accent text-xs px-2 py-1 rounded-full">{s.level || "—"}</span>
                      </td>
                      <td className="p-4 text-sm text-center">
                        {(() => {
                          const hist = historyMap.get(s.user_id);
                          if (!hist) return <span className="text-xs text-muted-foreground">—</span>;
                          const isRedoublant = hist.status === "redoublement";
                          return (
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isRedoublant ? "bg-warning/15 text-warning border border-warning/30" : "bg-success/15 text-success border border-success/30"}`}>
                              {isRedoublant ? "Redoublant" : "Admis"}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-4 text-sm text-center">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${scolaireOnly ? (s.oriente_etat ? "bg-success/15 text-success" : "bg-info/15 text-info") : (s.statut_boursier ? "bg-success/15 text-success" : "bg-info/15 text-info")}`}>
                          {scolaireOnly ? (s.oriente_etat ? "Orienté État" : "Non orienté") : (s.statut_boursier ? "Boursier" : "Non boursier")}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        {isViewingHistory ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1 mr-1"><Lock className="w-3 h-3" /> Figé</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-accent hover:text-accent"
                              onClick={() => { setPwdOnlyStudent(s); setPwdOnlyValue(""); }}
                              title="Modifier le mot de passe"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary hover:text-primary" onClick={() => navigate(`/admin/students/${s.user_id}`)} title="Voir le dossier">
                              <FolderOpen className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-accent hover:text-accent" onClick={() => openEdit(s)} title="Modifier">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setSelectedStudent(s); setPromoteDialog(true); }} title="Passage">
                              <ArrowUpCircle className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-info hover:text-info" onClick={async () => {
                              const res = await downloadAttestationPdf({
                                student: { user_id: s.user_id, first_name: s.first_name, last_name: s.last_name, student_number: s.student_number, date_of_birth: s.date_of_birth, birth_place: s.birth_place, level: s.level, filiere_name: filiereMap.get(s.filiere_id) as string | undefined, classe_name: classMap.get(s.classe_id) as string | undefined, academic_year: s.academic_year },
                                institution: { name: (instData as any)?.name, logo_url: (instData as any)?.logo_url, address: (instData as any)?.address, country_header: (instData as any)?.country_header, country_motto: (instData as any)?.country_motto, ministry: (instData as any)?.ministry, signatory_name: (instData as any)?.signatory_name, signatory_title: (instData as any)?.signatory_title, city: (instData as any)?.city },
                              });
                              if (res.ok === false) toast.error(res.reason);
                              else toast.success("Attestation générée");
                            }} title="Attestation de scolarité">
                              <FileText className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteStudent(s)} title="Supprimer">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) { setEditStudent(null); setEditPwdOpen(false); setEditNewPwd(""); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-accent" /> Modifier l'{student}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prénom</Label>
                <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nom</Label>
                <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {!editIsScolaire && <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Filière</Label>
                <Select value={editForm.filiere_id} onValueChange={(v) => setEditForm({ ...editForm, filiere_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>
                    {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Niveau</Label>
                <Select value={editForm.level} onValueChange={(v) => setEditForm({ ...editForm, level: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!editIsScolaire && <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50">
              <Label className="text-sm font-medium text-foreground">Boursier</Label>
              <Switch checked={editForm.statut_boursier} onCheckedChange={(v) => setEditForm({ ...editForm, statut_boursier: v })} />
            </div>}

            {/* Password section */}
            {!editPwdOpen ? (
              <Button variant="outline" className="w-full gap-2" onClick={() => setEditPwdOpen(true)}>
                <KeyRound className="w-4 h-4" /> Modifier le mot de passe
              </Button>
            ) : (
              <div className="space-y-2 p-3 rounded-lg bg-secondary/30 border border-border/50">
                <Label className="text-xs text-muted-foreground">Nouveau mot de passe</Label>
                <Input type="password" value={editNewPwd} onChange={(e) => setEditNewPwd(e.target.value)} placeholder="Min 6 caractères" />
                <Button
                  size="sm"
                  onClick={() => updatePwdMutation.mutate()}
                  disabled={editNewPwd.length < 6 || updatePwdMutation.isPending}
                  className="w-full gradient-gold text-accent-foreground"
                >
                  {updatePwdMutation.isPending ? "Mise à jour..." : "Changer le mot de passe"}
                </Button>
              </div>
            )}

            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!editForm.first_name || !editForm.last_name || updateMutation.isPending}
              className="w-full gradient-gold text-accent-foreground"
            >
              {updateMutation.isPending ? "Enregistrement..." : "Enregistrer les modifications"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password-only Dialog (works for archived/figés students too) */}
      <Dialog open={!!pwdOnlyStudent} onOpenChange={(o) => { if (!o) { setPwdOnlyStudent(null); setPwdOnlyValue(""); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-accent" /> Modifier le mot de passe
            </DialogTitle>
          </DialogHeader>
          {pwdOnlyStudent && (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-secondary/30 border border-border/50 text-sm">
                <p className="font-medium text-foreground">{pwdOnlyStudent.first_name} {pwdOnlyStudent.last_name}</p>
                <p className="text-xs text-muted-foreground font-mono mt-1">{pwdOnlyStudent.student_number}</p>
                {isViewingHistory && (
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Année figée — modification du mot de passe toujours autorisée
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nouveau mot de passe</Label>
                <Input
                  type="password"
                  value={pwdOnlyValue}
                  onChange={(e) => setPwdOnlyValue(e.target.value)}
                  placeholder="Min 6 caractères"
                  autoFocus
                />
              </div>
              <Button
                onClick={() => pwdOnlyMutation.mutate()}
                disabled={pwdOnlyValue.length < 6 || pwdOnlyMutation.isPending}
                className="w-full gradient-gold text-accent-foreground gap-2"
              >
                <KeyRound className="w-4 h-4" /> {pwdOnlyMutation.isPending ? "Mise à jour..." : "Changer le mot de passe"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteStudent} onOpenChange={(o) => { if (!o) setDeleteStudent(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet étudiant ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer définitivement <strong>{deleteStudent?.first_name} {deleteStudent?.last_name}</strong> ({deleteStudent?.student_number}) ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteStudent && deleteMutation.mutate(deleteStudent.user_id)}
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote / Redoublement Dialog */}
      <Dialog open={promoteDialog} onOpenChange={setPromoteDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Passage / Redoublement</DialogTitle></DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">{selectedStudent.first_name} {selectedStudent.last_name}</strong> — {filiereMap.get(selectedStudent.filiere_id) || "Sans filière"} · {selectedStudent.level || "L1"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                {NEXT_LEVEL[selectedStudent.level || "L1"] && (
                  <Button className="gradient-gold text-accent-foreground gap-2" onClick={() => promoteMutation.mutate({ student: selectedStudent, nextLevel: NEXT_LEVEL[selectedStudent.level || "L1"]!, nextYear: getNextYear(filterYear) })} disabled={promoteMutation.isPending}>
                    <ArrowUpCircle className="w-4 h-4" /> Passer en {NEXT_LEVEL[selectedStudent.level || "L1"]}
                  </Button>
                )}
                <Button variant="outline" className="gap-2 border-warning text-warning hover:bg-warning/10" onClick={() => redoubleMutation.mutate({ student: selectedStudent, nextYear: getNextYear(filterYear) })} disabled={redoubleMutation.isPending}>
                  <RotateCcw className="w-4 h-4" /> Redoublement
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default AdminStudentsPage;
