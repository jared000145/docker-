import {PhoneInput} from '@/components/ui/phone-input';
import DossierEnrollmentStatus from '@/components/admin/DossierEnrollmentStatus';
import DossierOverview from '@/components/admin/DossierOverview';
import BacPublication from '@/components/admin/BacPublication';
import {useAcademicYear} from '@/hooks/useAcademicYear';
import {AcademicYearSelector} from '@/components/AcademicYearSelector';
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StudentProgression from '@/components/admin/StudentProgression';
import { motion } from "framer-motion";
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, GraduationCap, User,
  BookOpen, CreditCard, FileText, AlertTriangle, Users, CheckCircle2, XCircle, Download, Award, Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useCycle } from "@/hooks/useCycle";
import { toast } from "sonner";
import {
  TRIMESTRES, TRIMESTRE_LABEL, matiereAverage, trimestreAverage, mentionForAverage,
} from "@/lib/collegeLycee";


const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };
const fmt = (v: number | null | undefined) => (v == null ? "—" : Number(v).toFixed(2));
const formatCFA = (n: number) => (n || 0).toLocaleString("fr-FR") + " FCFA";

const STATUT_LABEL: Record<string, { label: string; cls: string }> = {
  in_progress: { label: "Nouveau", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  completed: { label: "Admis", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  redoublement: { label: "Redoublant", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  transferred: { label: "Transféré", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  failed: { label: "Échoué", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  excluded: { label: "Exclu", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

const AdminStudentDossierScolaire = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { profile: adminProfile } = useAuth();
  const { institution } = useInstitution();
  const { thirdNoteEnabled } = useCycle();
  const instId = adminProfile?.institution_id;
  const {selectedYear:activeYear,isViewingHistory}=useAcademicYear();
  const [trimestre, setTrimestre] = useState<string>("T1");
  const [activeTab,setActiveTab]=useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();


  const { data: student, isLoading } = useQuery({
    queryKey: ["student-dossier-scolaire", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*, classes(id, nom, cycle, niveau, serie)")
        .eq("user_id", userId!)
        .maybeSingle();
      return data;
    },
  });

  const registration=useQuery({queryKey:['admin-school-annual-class',userId,activeYear],enabled:!!userId,queryFn:async()=>{const{data,error}=await(supabase as any).from('student_years').select('classe_id,classes(*)').eq('user_id',userId!).eq('academic_year',activeYear).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data;}});
  const classeId = registration.data?.classe_id||(!isViewingHistory?(student as any)?.classe_id:null);

  const { data: history } = useQuery({
    queryKey: ["student-history-scolaire", userId, activeYear],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_year_history")
        .select("*")
        .eq("user_id", userId!)
        .eq("academic_year", activeYear)
        .maybeSingle();
      return data;
    },
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["student-dossier-grades", userId, trimestre, activeYear],
    enabled: !!userId && !!classeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("grades_trimestre")
        .select("*")
        .eq("user_id", userId!)
        .eq("classe_id", classeId)
        .eq("academic_year", activeYear)
        .eq("trimestre", trimestre);
      return data || [];
    },
  });

  const { data: releve } = useQuery({
    queryKey: ["student-dossier-releve", userId, trimestre, activeYear],
    enabled: !!userId && !!classeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("releves_trimestre")
        .select("*")
        .eq("user_id", userId!)
        .eq("classe_id", classeId)
        .eq("academic_year", activeYear)
        .eq("trimestre", trimestre)
        .maybeSingle();
      return data;
    },
  });

  const { data: classStats } = useQuery({
    queryKey: ["student-dossier-trimestre-class-stats", userId, classeId, trimestre, activeYear],
    enabled: !!userId && !!classeId,
    queryFn: async () => {
      if (!userId || !classeId) return null;
      const { data } = await (supabase as any)
        .rpc("get_trimestre_class_stats", {
          _user_id: userId,
          _classe_id: classeId,
          _trimestre: trimestre,
          _academic_year: activeYear,
        })
        .maybeSingle();
      return data;
    },
  });

  const { data: allReleves = [] } = useQuery({
    queryKey: ["student-dossier-releves-all", userId, activeYear],
    enabled: !!userId && !!classeId,
    queryFn: async () => {
      const { data } = await supabase
        .from("releves_trimestre")
        .select("*")
        .eq("user_id", userId!)
        .eq("classe_id", classeId)
        .eq("academic_year", activeYear);
      return data || [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["student-dossier-attendance", userId, activeYear],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("id, status, date")
        .eq("user_id", userId!)
        .eq("academic_year", activeYear)
        .order("date", { ascending: false });
      return data || [];
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["student-dossier-payments", userId, activeYear],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", userId!)
        .eq("academic_year", activeYear)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: documents = [] } = useQuery({
    queryKey: ["student-dossier-docs", userId, activeYear],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_documents")
        .select("*")
        .eq("user_id", userId!)
        .eq("academic_year", activeYear)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: classesList = [] } = useQuery({
    queryKey: ["dossier-classes-list", instId,activeYear],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("id, nom, niveau, serie, cycle, campus_id")
        .eq("academic_year",activeYear)
        .eq("institution_id", instId!)
        .order("niveau", { ascending: true });
      return data || [];
    },
  });

  useEffect(() => {
    if (student && editOpen) {
      setForm({
        first_name: student.first_name || "",
        last_name: student.last_name || "",
        sexe: (student as any).sexe || "",
        date_of_birth: student.date_of_birth || "",
        birth_place: (student as any).birth_place || "",
        phone: student.phone || "",
        email: student.email || "",
        address: student.address || "",
        parent_contact: (student as any).parent_contact || "",
        tuteur_email: (student as any).tuteur_email || "",
        classe_id: (student as any).classe_id || "",
        oriente_etat: !!(student as any).oriente_etat,
      });
    }
  }, [student, editOpen]);

  const saveEdits = async () => {
    if(isViewingHistory){toast.error("Le profil actuel ne se modifie pas depuis une année archivée.");return;}
    if (!userId) return;
    setSaving(true);
    const payload: any = { ...form };
    if (!payload.date_of_birth) payload.date_of_birth = null;
    Object.keys(payload).forEach((k) => { if (payload[k] === "") payload[k] = null; });
    const { error } = await supabase.from("profiles").update(payload).eq("user_id", userId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Dossier mis à jour");
    qc.invalidateQueries({ queryKey: ["student-dossier-scolaire", userId] });
    setEditOpen(false);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!student) return <div className="p-8 text-center text-muted-foreground">Élève introuvable</div>;


  const fullName = `${student.first_name || ""} ${student.last_name || ""}`.trim();
  const initials = (student.first_name?.[0] || "") + (student.last_name?.[0] || "");
  const classe = registration.data?.classes||(!isViewingHistory?(student as any).classes:null);

  const rows = grades.map((g: any) => ({
    ...g,
    moyenne: matiereAverage(g.note1, g.bareme1, g.note2, g.bareme2, thirdNoteEnabled ? g.note3 : null, g.bareme3),
  }));
  const moyTrim = trimestreAverage(rows.map((r) => ({ moyenne: r.moyenne, coefficient: r.coefficient })));
  const displayedMoyTrim = classStats?.moyenne_eleve ?? releve?.moyenne_trimestre ?? moyTrim;
  const displayedRang = classStats?.rang ?? releve?.rang ?? null;

  const absCount = attendance.filter((a: any) => a.status === "absent").length;
  const retardCount = attendance.filter((a: any) => a.status === "retard" || a.status === "late").length;

  const totalDue = payments.reduce((s: number, p: any) => s + (p.amount || 0), 0);
  const totalPaid = payments.reduce((s: number, p: any) => s + (p.paid_amount || (p.status === "paid" ? p.amount : 0) || 0), 0);
  const remaining = Math.max(0, totalDue - totalPaid);

  const downloadDoc = async (doc: any) => {
    const { data } = await supabase.storage.from("student-documents").createSignedUrl(doc.file_url, 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const statutKey = history?.status || "in_progress";
  const statut = STATUT_LABEL[statutKey] || STATUT_LABEL.in_progress;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6 dossier-page">
      {/* Header */}
      <motion.div variants={item} className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/students")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-48">
          <h1 className="text-2xl font-heading font-bold text-foreground">Dossier élève</h1>
          <p className="text-sm text-muted-foreground">{fullName} — {student.student_number || "—"}</p>
        </div>
        <AcademicYearSelector/>
        <Button disabled={isViewingHistory} onClick={() => setEditOpen(true)} className="gap-2">
          <Pencil className="w-4 h-4" /> Modifier
        </Button>
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
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-bold">{fullName || "—"}</h2>
                  {classe?.nom && <Badge variant="outline">{classe.nom}</Badge>}
                  <DossierEnrollmentStatus studentId={student.user_id}/>
                  {student.oriente_etat && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Orienté par l'État
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground"><User className="w-4 h-4" />{student.sexe === "F" ? "Féminin" : student.sexe === "M" ? "Masculin" : "—"}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" />{student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("fr-FR") : "—"}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" />Né(e) à {student.birth_place || "—"}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><GraduationCap className="w-4 h-4" />{classe?.niveau || "—"}{classe?.serie ? ` · ${classe.serie}` : ""}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" />{student.phone || "—"}</div>
                  <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" />{student.email || "—"}</div>
                </div>
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
            <TabsTrigger value="parcours">Parcours</TabsTrigger>
            <TabsTrigger value="scolarite"><GraduationCap className="w-4 h-4 mr-1" />Scolarité</TabsTrigger>
            <TabsTrigger value="responsable"><Users className="w-4 h-4 mr-1" />Responsable</TabsTrigger>
            <TabsTrigger value="notes"><BookOpen className="w-4 h-4 mr-1" />Notes & Bulletins</TabsTrigger>
            <TabsTrigger value="vie"><AlertTriangle className="w-4 h-4 mr-1" />Vie scolaire</TabsTrigger>
            <TabsTrigger value="finances"><CreditCard className="w-4 h-4 mr-1" />Finances</TabsTrigger>
            <TabsTrigger value="documents"><FileText className="w-4 h-4 mr-1" />Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><DossierOverview school year={activeYear} email={student.email} phone={student.phone} onNavigate={setActiveTab} metrics={[
            {label:classe?.cycle==='college'?'Collège':'Lycée',value:classe?.nom||'Classe non affectée',detail:classe?.niveau||'Niveau non renseigné',tab:'scolarite'},
            {label:'Moyenne du trimestre',value:displayedMoyTrim==null?'Non disponible':fmt(displayedMoyTrim)+' / 20',detail:TRIMESTRE_LABEL[trimestre]||trimestre,tab:'notes'},
            {label:'Vie scolaire',value:absCount+' absence(s)',detail:retardCount+' retard(s) enregistrés',tab:'vie'},
            {label:'Pièces du dossier',value:documents.length+' document(s)',detail:'Documents de '+activeYear,tab:'documents'},
          ]}/></TabsContent>
          <TabsContent value="parcours" className="space-y-5"><StudentProgression studentId={userId!} editable/></TabsContent>
          {/* Scolarité */}
          <TabsContent value="scolarite">
            <Card>
              <CardHeader><CardTitle className="text-base">Informations scolaires</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Info label="Niveau" value={classe?.niveau || "—"} />
                {classe?.cycle==='lycee'&&<Info label="Série" value={classe?.serie || "Non renseignée"} />}
                <Info label="Classe" value={classe?.nom || "—"} />
                <Info label="Année scolaire" value={activeYear} />
                <Info label="Statut" value={statut.label} />
                <Info label="Orienté par l'État" value={student.oriente_etat ? "Oui" : "Non"} />
                <Info label="Matricule" value={student.student_number || "—"} />
                <Info label="Date d'inscription" value={student.created_at ? new Date(student.created_at).toLocaleDateString("fr-FR") : "—"} />
              </CardContent>
            </Card>
            <div className="mt-5"><BacPublication studentId={userId!}/></div>
          </TabsContent>

          {/* Responsable */}
          <TabsContent value="responsable">
            <Card>
              <CardHeader><CardTitle className="text-base">Responsable légal</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Info label="Nom du parent / tuteur" value={student.parent_contact?.split("|")[0]?.trim() || "—"} />
                <Info label="Téléphone" value={student.parent_contact?.split("|")[1]?.trim() || student.parent_contact || "—"} />
                <Info label="Email" value={student.tuteur_email || "—"} />
                <Info label="Adresse (ville / quartier)" value={student.address || "—"} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes & Bulletins */}
          <TabsContent value="notes" className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h3 className="font-semibold text-foreground">Notes trimestrielles</h3>
              <Select value={trimestre} onValueChange={setTrimestre}>
                <SelectTrigger className="w-48 bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIMESTRES.map((t) => (
                    <SelectItem key={t} value={t}>{TRIMESTRE_LABEL[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Moyenne trimestre" value={fmt(displayedMoyTrim)} accent={(displayedMoyTrim ?? 0) >= 10 ? "success" : "destructive"} />
              <StatCard label="Moyenne classe" value={fmt(classStats?.moyenne_classe)} />
              <StatCard label="Rang" value={displayedRang != null ? String(displayedRang) : "—"} />
              <StatCard label="Mention" value={mentionForAverage(displayedMoyTrim)} />
            </div>

            <Card>
              <CardContent className="p-0 overflow-x-auto">
                {rows.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">Aucune note publiée pour ce trimestre.</div>
                ) : (
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-secondary/40 border-b">
                      <tr>
                        <th className="text-left p-3">Matière</th>
                        <th className="text-center p-3">Coef</th>
                        <th className="text-center p-3">Devoir 1</th>
                        <th className="text-center p-3">Devoir 2</th>
                        {thirdNoteEnabled && <th className="text-center p-3">Comp.</th>}
                        <th className="text-center p-3">Moyenne</th>
                        <th className="text-center p-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r: any) => (
                        <tr key={r.id} className="border-b border-border/40">
                          <td className="p-3 font-medium">{r.matiere}</td>
                          <td className="p-3 text-center">{r.coefficient}</td>
                          <td className="p-3 text-center">{fmt(r.note1)}<span className="text-xs text-muted-foreground">/{r.bareme1}</span></td>
                          <td className="p-3 text-center">{fmt(r.note2)}<span className="text-xs text-muted-foreground">/{r.bareme2}</span></td>
                          {thirdNoteEnabled && (
                            <td className="p-3 text-center">{fmt(r.note3)}<span className="text-xs text-muted-foreground">/{r.bareme3}</span></td>
                          )}
                          <td className={`p-3 text-center font-bold ${(r.moyenne ?? 0) >= 10 ? "text-success" : "text-destructive"}`}>{fmt(r.moyenne)}</td>
                          <td className="p-3 text-center">
                            {r.moyenne == null ? <Badge variant="outline">—</Badge> :
                              r.moyenne >= 10
                                ? <Badge className="bg-success/15 text-success gap-1"><CheckCircle2 className="w-3 h-3" />OK</Badge>
                                : <Badge className="bg-destructive/15 text-destructive gap-1"><XCircle className="w-3 h-3" />Faible</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            {allReleves.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Award className="w-4 h-4 text-accent" />Bulletins trimestriels</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {allReleves.map((r: any) => (
                    <div key={r.id} className="p-3 rounded-lg border border-border/50 bg-secondary/20 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold">{TRIMESTRE_LABEL[r.trimestre]}</p>
                        <p className="text-xs text-muted-foreground">Moy. {fmt(r.moyenne_trimestre)} · Rang {r.rang ?? "—"}</p>
                      </div>
                      {r.pdf_url && (
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(r.pdf_url, "_blank")}>
                          <Download className="w-3 h-3" />PDF
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Vie scolaire */}
          <TabsContent value="vie">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <StatCard label="Absences" value={String(absCount)} accent={absCount > 0 ? "destructive" : undefined} />
              <StatCard label="Retards" value={String(retardCount)} accent={retardCount > 0 ? "warning" : undefined} />
              <StatCard label="Total sessions" value={String(attendance.length)} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Historique des absences & retards</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {attendance.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Aucune absence enregistrée.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b">
                      <tr>
                        <th className="text-left p-3">Date</th>
                        <th className="text-left p-3">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.slice(0, 30).map((a: any) => (
                        <tr key={a.id} className="border-b border-border/40">
                          <td className="p-3">{new Date(a.date).toLocaleDateString("fr-FR")}</td>
                          <td className="p-3">
                            <Badge className={
                              a.status === "absent" ? "bg-destructive/15 text-destructive" :
                              a.status === "retard" || a.status === "late" ? "bg-warning/15 text-warning" :
                              "bg-success/15 text-success"
                            }>{a.status}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Finances */}
          <TabsContent value="finances" className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard label="Total dû" value={formatCFA(totalDue)} />
              <StatCard label="Payé" value={formatCFA(totalPaid)} accent="success" />
              <StatCard label="Restant" value={formatCFA(remaining)} accent={remaining > 0 ? "destructive" : "success"} />
            </div>
            <Card>
              <CardHeader><CardTitle className="text-base">Historique des paiements</CardTitle></CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {payments.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Aucun paiement.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/40 border-b">
                      <tr>
                        <th className="text-left p-3">Description</th>
                        <th className="text-right p-3">Montant</th>
                        <th className="text-center p-3">Statut</th>
                        <th className="text-center p-3">Date</th>
                        <th className="text-center p-3">Reçu</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p: any) => (
                        <tr key={p.id} className="border-b border-border/40">
                          <td className="p-3 font-medium">{p.description}</td>
                          <td className="p-3 text-right">{formatCFA(p.amount)}</td>
                          <td className="p-3 text-center">
                            <Badge className={p.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}>
                              {p.status === "paid" ? "Payé" : "En attente"}
                            </Badge>
                          </td>
                          <td className="p-3 text-center text-muted-foreground">{p.payment_date ? new Date(p.payment_date).toLocaleDateString("fr-FR") : "—"}</td>
                          <td className="p-3 text-center">
                            {p.receipt_url ? (
                              <Button size="sm" variant="outline" className="gap-1 h-7" onClick={() => window.open(p.receipt_url, "_blank")}>
                                <Download className="w-3 h-3" />
                              </Button>
                            ) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents">
            <Card>
              <CardHeader><CardTitle className="text-base">Pièces du dossier</CardTitle></CardHeader>
              <CardContent className="p-0">
                {documents.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground text-sm">Aucun document.</div>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {documents.map((d: any) => (
                      <li key={d.id} className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{d.title || d.file_url}</p>
                          <p className="text-xs text-muted-foreground">{d.doc_type} · {new Date(d.created_at).toLocaleDateString("fr-FR")}</p>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => downloadDoc(d)}>
                          <Download className="w-3 h-3" />Télécharger
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier le dossier</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div><Label>Prénom</Label><Input value={form.first_name || ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Nom</Label><Input value={form.last_name || ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            <div>
              <Label>Sexe</Label>
              <Select value={form.sexe || ""} onValueChange={(v) => setForm({ ...form, sexe: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculin</SelectItem>
                  <SelectItem value="F">Féminin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date de naissance</Label><Input type="date" value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
            <div><Label>Lieu de naissance</Label><Input value={form.birth_place || ""} onChange={(e) => setForm({ ...form, birth_place: e.target.value })} placeholder="Libreville" /></div>
            <div><Label>Téléphone</Label><PhoneInput value={form.phone} onChange={phone=>setForm({...form,phone})}/></div>
            <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Adresse (ville / quartier)</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Nom & tél du parent / tuteur</Label><Input value={form.parent_contact || ""} onChange={(e) => setForm({ ...form, parent_contact: e.target.value })} placeholder="Nom | Téléphone" /></div>
            <div className="sm:col-span-2"><Label>Email du tuteur</Label><Input type="email" value={form.tuteur_email || ""} onChange={(e) => setForm({ ...form, tuteur_email: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <Label>Classe</Label>
              <Select value={form.classe_id || ""} onValueChange={(v) => setForm({ ...form, classe_id: v })}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une classe" /></SelectTrigger>
                <SelectContent>
                  {classesList.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nom} — {c.niveau}{c.serie ? ` · ${c.serie}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">Orienté par l'État</p>
                <p className="text-xs text-muted-foreground">Élève affecté par l'État (bourse/prise en charge)</p>
              </div>
              <Switch checked={!!form.oriente_etat} onCheckedChange={(v) => setForm({ ...form, oriente_etat: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Annuler</Button>
            <Button onClick={saveEdits} disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>

  );
};

const Info = ({ label, value }: { label: string; value: string }) => (
  <div>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="font-medium text-foreground">{value}</p>
  </div>
);

const StatCard = ({ label, value, accent }: { label: string; value: string; accent?: "success" | "destructive" | "warning" }) => {
  const cls =
    accent === "success" ? "border-success/35 bg-success/10 text-success" :
    accent === "destructive" ? "border-destructive/35 bg-destructive/10 text-destructive" :
    accent === "warning" ? "border-warning/35 bg-warning/10 text-warning" :
    "border-border/60";
  return (
    <Card className={`${cls}`}>
      <CardContent className="p-4 text-center">
        <p className="text-xs font-semibold opacity-80">{label}</p>
        <p className="text-xl font-bold mt-1">{value}</p>
      </CardContent>
    </Card>
  );
};

export default AdminStudentDossierScolaire;
