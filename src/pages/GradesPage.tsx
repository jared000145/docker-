import {useStudentPlacement} from '@/hooks/useStudentPlacement';
import PlacementNotice from '@/components/student/PlacementNotice';
import ValidatedBulletinDownload from "@/components/ValidatedBulletinDownload";
import { motion } from "framer-motion";
import { Download, TrendingUp, AlertTriangle, BarChart3, RotateCcw, CheckCircle2, PenLine, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useInstitution } from "@/hooks/useInstitution";
import { generateStudentBulletinPdf } from "@/lib/bulletinPdf";
import { toast } from "sonner";
import { NewYearAccessGuard } from "@/components/student/NewYearAccessGuard";
import { Link } from "react-router-dom";
import { useCycle } from "@/hooks/useCycle";
import StudentTrimestreGrades from "@/components/student/StudentTrimestreGrades";


const getMentionColor = (avg: number) => {
  if (avg >= 16) return "bg-success/10 text-success border-success/40";
  if (avg >= 14) return "bg-info/10 text-info border-info/40";
  if (avg >= 12) return "bg-warning/10 text-warning border-warning/40";
  return "bg-destructive/10 text-destructive border-destructive/40";
};

const getMention = (avg: number) => {
  if (avg >= 16) return "Très Bien";
  if (avg >= 14) return "Bien";
  if (avg >= 12) return "Assez Bien";
  if (avg >= 10) return "Passable";
  return "Insuffisant";
};

const formatGrade = (value: number | null | undefined) => value != null ? Number(value).toFixed(2) : "—";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const GradeMobileCard = ({ grade, rattrapage, finalAvg, isRattrapage, isValidated }: {
  grade: any;
  rattrapage: any;
  finalAvg: number | null;
  isRattrapage: boolean;
  isValidated: boolean;
}) => {
  const credits = Number(grade.subjects?.credits) || 0;

  return (
    <div className={`rounded-lg border p-3 space-y-3 ${isRattrapage && (!rattrapage || rattrapage.status !== "passed") ? "border-destructive/40 bg-destructive/10" : "border-border/60 bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-sm text-foreground leading-snug">{grade.subjects?.name || "—"}</p>
          <p className="text-xs text-foreground/70 mt-1 font-medium">{grade.semester || "—"} • Coef {grade.subjects?.coefficient || "—"} • {credits || "—"} crédits</p>
        </div>
        {finalAvg != null && (
          <Badge variant="outline" className={`shrink-0 text-[10px] font-semibold ${getMentionColor(finalAvg)}`}>
            {getMention(finalAvg)}
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-md bg-background border border-border/50 px-2 py-2">
          <p className="text-[11px] font-semibold text-foreground/80 mb-1">CC</p>
          <p className="text-base font-bold text-foreground">{formatGrade(grade.cc_grade)}</p>
        </div>
        <div className="rounded-md bg-background border border-border/50 px-2 py-2">
          <p className="text-[11px] font-semibold text-foreground/80 mb-1">Examen</p>
          <p className="text-base font-bold text-foreground">{formatGrade(grade.exam_grade)}</p>
        </div>
        <div className="rounded-md bg-accent border border-accent-foreground/20 px-2 py-2">
          <p className="text-[11px] font-semibold text-accent-foreground mb-1">Moyenne</p>
          <p className={`text-base font-bold ${isValidated ? "text-success" : "text-destructive"}`}>{formatGrade(grade.average)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-foreground/70 font-medium">Rattrapage</span>
        {rattrapage ? (
          rattrapage.rattrapage_grade != null ? (
            <span className={`font-bold ${rattrapage.rattrapage_grade >= 10 ? "text-success" : "text-destructive"}`}>
              {formatGrade(rattrapage.rattrapage_grade)}/20
            </span>
          ) : (
            <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/40 font-semibold">En attente</Badge>
          )
        ) : isRattrapage ? (
          <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/40 font-semibold">À passer</Badge>
        ) : (
          <span className="text-foreground/50 font-medium">—</span>
        )}
      </div>
    </div>
  );
};

const GradesPage = () => {
  const {selectedYear}=useAcademicYear();
  const placement=useStudentPlacement(undefined,selectedYear);
  if(placement.isPending||placement.isError||!placement.cycle)return <PlacementNotice loading={placement.isPending} error={placement.isError}/>;
  if(placement.isSchool){
    return (
      <NewYearAccessGuard>
        <StudentTrimestreGrades />
      </NewYearAccessGuard>
    );
  }

  return <UniversityGradesPage />;
};

const UniversityGradesPage = () => {
  const { user, profile: authProfile } = useAuth();
  const { institution } = useInstitution();
  const qc = useQueryClient();
  const { selectedYear, isViewingHistory, isRedoublant, previousYearFailedSubjectIds, currentYear } = useAcademicYear();
  const [semester, setSemester] = useState("all");

  const { data: profile } = useQuery({
    queryKey: ["student-profile-pdf", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, student_number, level, date_of_birth, filiere_id, filieres(name)")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: academicParams } = useQuery({
    queryKey: ["params-etablissement-bulletin", institution?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("parametres_etablissement")
        .select("mode_validation_ue, note_min_validation, mode_calcul_moyenne_semestre")
        .eq("institution_id", institution!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!institution?.id,
  });

  const { data: rawGrades = [] } = useQuery({
    queryKey: ["grades-all", user?.id, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("grades")
        .select("*, subjects(*)")
        .eq("user_id", user!.id)
        .eq("academic_year", selectedYear);
      return data || [];
    },
    enabled: !!user,
  });

  // Only submitted grades feed averages, bulletins, and the main table
  const allGrades = rawGrades.filter((g: any) => !g.submission_status || g.submission_status === "submitted");
  const pendingGrades = rawGrades.filter((g: any) => g.submission_status === "pending_approval");

  const approveMutation = useMutation({
    mutationFn: async (gradeId: string) => {
      const sig = (authProfile as any)?.signature_url;
      if (!sig) throw new Error("Configurez d'abord votre signature dans Paramètres > Signature numérique.");
      const { error } = await supabase
        .from("grades")
        .update({
          approved_by_student: true,
          approved_at: new Date().toISOString(),
          student_signature_url: sig,
        } as any)
        .eq("id", gradeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["grades-all"] });
      toast.success("Note approuvée et signée");
    },
    onError: (e: any) => toast.error(e.message),
  });


  const { data: rattrapages = [] } = useQuery({
    queryKey: ["student-rattrapages", user?.id, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("rattrapages")
        .select("*, subjects(name)")
        .eq("user_id", user!.id)
        .eq("academic_year", selectedYear);
      return data || [];
    },
    enabled: !!user,
  });

  // For redoublants: fetch previous year rattrapages (failed subjects)
  const getPreviousYear = (year: string) => {
    const [start] = year.split("-").map(Number);
    return `${start - 1}-${start}`;
  };

  const { data: previousRattrapages = [] } = useQuery({
    queryKey: ["student-prev-rattrapages", user?.id, getPreviousYear(currentYear)],
    queryFn: async () => {
      const { data } = await supabase
        .from("rattrapages")
        .select("*, subjects(name, credits, coefficient)")
        .eq("user_id", user!.id)
        .eq("academic_year", getPreviousYear(currentYear));
      return data || [];
    },
    enabled: !!user && isRedoublant && !isViewingHistory,
  });

  useRealtimeSubscription("grades", [["grades-all", user?.id || "", selectedYear]], user ? { column: "user_id", value: user.id } : undefined);

  // Récupère les UE et le mapping ue ↔ matière (filtrées par année académique)
  const { data: uesData = [] } = useQuery({
    queryKey: ["student-ues", selectedYear, allGrades.map((g: any) => g.subject_id).join(",")],
    queryFn: async () => {
      const subjectIds = allGrades.map((g: any) => g.subject_id).filter(Boolean);
      if (!subjectIds.length) return [];
      const { data: links } = await supabase
        .from("ue_matieres")
        .select("ue_id, subject_id, ues!inner(id, nom, code, credits, semester, niveau, academic_year)")
        .in("subject_id", subjectIds);
      return (links || []).filter((l: any) => l.ues?.academic_year === selectedYear);
    },
    enabled: allGrades.length > 0,
  });

  const grades = semester === "all" ? allGrades : allGrades.filter((g: any) => g.semester === semester);
  const rattrapageMap = new Map(rattrapages.map((r: any) => [r.subject_id, r]));

  // Calcul moyenne par UE (pondérée par coefficient des matières)
  const validationMode = (academicParams?.mode_validation_ue as "STRICT" | "MOYENNE") || "MOYENNE";
  const noteMin = Number(academicParams?.note_min_validation) || 10;
  const ueAverages = (() => {
    const map: Record<string, { ue: any; subjects: { grade: any; avg: number; coef: number }[] }> = {};
    uesData.forEach((link: any) => {
      const grade = grades.find((g: any) => g.subject_id === link.subject_id);
      if (!grade || grade.average == null) return;
      const ratt = rattrapageMap.get(link.subject_id);
      const finalAvg = ratt && (ratt as any).status === "passed" && (ratt as any).rattrapage_grade != null
        ? Math.max(grade.average, (ratt as any).rattrapage_grade)
        : grade.average;
      const coef = grade.subjects?.coefficient || 1;
      if (!map[link.ue_id]) map[link.ue_id] = { ue: link.ues, subjects: [] };
      map[link.ue_id].subjects.push({ grade, avg: finalAvg, coef });
    });
    return Object.values(map).map(({ ue, subjects }) => {
      const totalCoef = subjects.reduce((s, x) => s + x.coef, 0);
      const weighted = subjects.reduce((s, x) => s + x.avg * x.coef, 0);
      const moyenne = totalCoef > 0 ? weighted / totalCoef : 0;
      // Mode STRICT : toutes les matières doivent être ≥ noteMin
      // Mode MOYENNE : la moyenne pondérée doit être ≥ noteMin
      const validated = validationMode === "STRICT"
        ? subjects.length > 0 && subjects.every((x) => x.avg >= noteMin)
        : moyenne >= noteMin;
      return { ue, moyenne, validated, count: subjects.length };
    });
  })();

  // Calcul de la moyenne du semestre selon le mode choisi par l'établissement
  const calcMode = (academicParams as any)?.mode_calcul_moyenne_semestre || "MOYENNE_UE_PONDEREE";
  const computeAvgFromGrades = (gs: any[], ueAvgs: { ue: any; moyenne: number; count: number }[]) => {
    if (calcMode === "MOYENNE_UE_PONDEREE") {
      const valid = ueAvgs.filter((u) => u.ue?.credits);
      const totalC = valid.reduce((s, u) => s + Number(u.ue.credits || 0), 0);
      return totalC > 0 ? valid.reduce((s, u) => s + u.moyenne * Number(u.ue.credits || 0), 0) / totalC : 0;
    }
    if (calcMode === "MOYENNE_UE_SIMPLE") {
      return ueAvgs.length > 0 ? ueAvgs.reduce((s, u) => s + u.moyenne, 0) / ueAvgs.length : 0;
    }
    if (calcMode === "MOYENNE_MATIERES_PONDEREE") {
      const totalCoef = gs.reduce((s, g) => s + (Number(g.subjects?.coefficient) || 1), 0);
      return totalCoef > 0 ? gs.reduce((s, g) => s + (Number(g.average ?? 0) * (Number(g.subjects?.coefficient) || 1)), 0) / totalCoef : 0;
    }
    // MOYENNE_MATIERES_SIMPLE
    return gs.length > 0 ? gs.reduce((s, g) => s + (g.average ?? 0), 0) / gs.length : 0;
  };

  // UE moyennes calculées sur TOUTES les notes (indépendant du filtre semestre) — pour le graphique comparatif
  const ueAveragesAll = (() => {
    const map: Record<string, { ue: any; subjects: { grade: any; avg: number; coef: number }[] }> = {};
    uesData.forEach((link: any) => {
      const grade = allGrades.find((g: any) => g.subject_id === link.subject_id);
      if (!grade || grade.average == null) return;
      const ratt = rattrapageMap.get(link.subject_id);
      const finalAvg = ratt && (ratt as any).status === "passed" && (ratt as any).rattrapage_grade != null
        ? Math.max(grade.average, (ratt as any).rattrapage_grade)
        : grade.average;
      const coef = grade.subjects?.coefficient || 1;
      if (!map[link.ue_id]) map[link.ue_id] = { ue: link.ues, subjects: [] };
      map[link.ue_id].subjects.push({ grade, avg: finalAvg, coef });
    });
    return Object.values(map).map(({ ue, subjects }) => {
      const totalCoef = subjects.reduce((s, x) => s + x.coef, 0);
      const weighted = subjects.reduce((s, x) => s + x.avg * x.coef, 0);
      const moyenne = totalCoef > 0 ? weighted / totalCoef : 0;
      return { ue, moyenne, count: subjects.length };
    });
  })();
  const ueAveragesS1 = ueAveragesAll.filter((u) => (u.ue?.semester || "").toUpperCase().includes("1"));
  const ueAveragesS2 = ueAveragesAll.filter((u) => (u.ue?.semester || "").toUpperCase().includes("2"));

  const overallAvg = computeAvgFromGrades(grades, ueAverages);
  const s1Grades = allGrades.filter((g: any) => g.semester === "S1");
  const s2Grades = allGrades.filter((g: any) => g.semester === "S2");
  const s1Avg = computeAvgFromGrades(s1Grades, ueAveragesS1 as any);
  const s2Avg = computeAvgFromGrades(s2Grades, ueAveragesS2 as any);

  const radarData = grades.map((g: any) => ({
    subject: g.subjects?.name?.length > 10 ? g.subjects.name.slice(0, 10) + "…" : g.subjects?.name || "?",
    note: g.average ?? 0,
    fullMark: 20,
  }));

  const semesterBarData = [
    ...(s1Grades.length > 0 ? [{ name: "S1", moyenne: parseFloat(s1Avg.toFixed(2)), matières: s1Grades.length }] : []),
    ...(s2Grades.length > 0 ? [{ name: "S2", moyenne: parseFloat(s2Avg.toFixed(2)), matières: s2Grades.length }] : []),
  ];

  const countRattrapage = grades.filter((g: any) => g.average !== null && g.average < 10).length;

  // Crédits validés (matières validées avec moyenne ≥ 10, en tenant compte du rattrapage)
  const creditsValides = grades.reduce((sum: number, g: any) => {
    const ratt = rattrapageMap.get(g.subject_id);
    const finalAvg = ratt && (ratt as any).status === "passed" && (ratt as any).rattrapage_grade != null
      ? Math.max(g.average ?? 0, (ratt as any).rattrapage_grade)
      : g.average;
    if (finalAvg != null && finalAvg >= 10) {
      return sum + (Number(g.subjects?.credits) || 0);
    }
    return sum;
  }, 0);
  const creditsTotaux = grades.reduce((sum: number, g: any) => sum + (Number(g.subjects?.credits) || 0), 0);

  const handleDownloadPdf = async () => {
    if (!allGrades.length) {
      toast.error("Aucune note à exporter");
      return;
    }
    // Construire les groupes UE pour regrouper les matières dans le bulletin
    const ueGroupsMap = new Map<string, { id: string; nom: string; code?: string; credits?: number; semester?: string | null; subjects: { subject_id: string; semester?: string | null }[] }>();
    (uesData as any[]).forEach((link: any) => {
      const ue = link.ues;
      if (!ue) return;
      if (!ueGroupsMap.has(ue.id)) {
        ueGroupsMap.set(ue.id, { id: ue.id, nom: ue.nom, code: ue.code, credits: ue.credits, semester: ue.semester || null, subjects: [] });
      }
      const grade = allGrades.find((g: any) => g.subject_id === link.subject_id);
      ueGroupsMap.get(ue.id)!.subjects.push({ subject_id: link.subject_id, semester: grade?.semester || grade?.subjects?.semester || null });
    });
    const ueGroups = Array.from(ueGroupsMap.values());

    const inst: any = institution || {};
    await generateStudentBulletinPdf({
      institution,
      profile,
      academicYear: selectedYear,
      grades: allGrades, // toutes les notes (S1 + S2) pour le bulletin combiné
      rattrapages,
      params: academicParams,
      summary: {
        general_average: overallAvg,
        credits_acquired: creditsValides,
        credits_total: creditsTotaux,
        credits_min_passage: inst.credits_min_passage ?? 45,
        credits_max_passage: inst.credits_max_passage ?? 60,
        old_level: profile?.level,
        ue_groups: ueGroups,
      },
    });
  };

  return (
    <NewYearAccessGuard>
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
      <ValidatedBulletinDownload studentId={user?.id} year={selectedYear}/>
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-heading font-bold text-foreground leading-tight">
            Mes Notes {isViewingHistory && <Badge variant="outline" className="ml-2 text-xs">Archivé — {selectedYear}</Badge>}
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            {isViewingHistory
              ? `Résultats archivés pour l'année ${selectedYear}`
              : "Consultez vos résultats académiques"}
          </p>
        </div>
        <div className="grid grid-cols-[1fr_auto] sm:flex sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Select value={semester} onValueChange={setSemester}>
            <SelectTrigger className="w-full sm:w-40 bg-secondary/50"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous semestres</SelectItem>
              <SelectItem value="S1">Semestre 1</SelectItem>
              <SelectItem value="S2">Semestre 2</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-2 h-10 px-3" onClick={handleDownloadPdf}>
            <Download className="w-4 h-4" /> PDF
          </Button>
        </div>
      </motion.div>

      {grades.length > 0 && (
        <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <Card className="glass-card border-border/60">
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xs font-semibold text-foreground/70">Moyenne</p>
              <p className={`text-xl sm:text-2xl font-bold ${overallAvg >= 10 ? "text-success" : "text-destructive"}`}>{overallAvg.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-border/60">
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xs font-semibold text-foreground/70">Matières</p>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{grades.length}</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-success/35 bg-success/10">
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xs font-semibold text-success">Validées (≥10)</p>
              <p className="text-xl sm:text-2xl font-bold text-success">{grades.filter((g: any) => g.average !== null && g.average >= 10).length}</p>
            </CardContent>
          </Card>
          <Card className="glass-card border-info/35 bg-info/10">
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xs font-semibold text-info">Crédits validés</p>
              <p className="text-xl sm:text-2xl font-bold text-info">
                {creditsValides}<span className="text-sm text-foreground/60">/{creditsTotaux}</span>
              </p>
            </CardContent>
          </Card>
          <Card className="glass-card border-destructive/35 bg-destructive/10">
            <CardContent className="p-3 sm:p-4 text-center">
              <p className="text-xs font-semibold text-destructive">Rattrapages</p>
              <p className="text-xl sm:text-2xl font-bold text-destructive">{countRattrapage}</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {ueAverages.length > 0 && (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/60">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Moyennes par Unité d'Enseignement (UE)
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ueAverages.map(({ ue, moyenne, validated, count }) => (
                <div
                  key={ue.id}
                  className={`p-4 rounded-lg border-2 ${
                    validated 
                      ? "border-success/35 bg-success/10" 
                      : "border-destructive/35 bg-destructive/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">{ue.nom}</p>
                      <p className="text-[11px] font-medium text-foreground/70">
                        {ue.semester} • {ue.credits} crédits • {count} matière(s)
                      </p>
                    </div>
                    <Badge className={`text-xs shrink-0 font-semibold ${validated ? "bg-success text-success-foreground hover:bg-success" : "bg-destructive text-destructive-foreground hover:bg-destructive"}`}>
                      {validated ? "Validée" : "Non validée"}
                    </Badge>
                  </div>
                  <p className={`text-2xl font-bold ${validated ? "text-success" : "text-destructive"}`}>
                    {moyenne.toFixed(2)}/20
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {pendingGrades.length > 0 && (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-amber-500/40 bg-amber-500/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                Notes en attente de votre approbation ({pendingGrades.length})
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Vérifiez les notes ci-dessous. Cliquez sur « Approuver » pour les signer avec votre signature numérique. {!(authProfile as any)?.signature_url && (
                  <Link to="/student/settings" className="text-accent underline ml-1">Configurer ma signature →</Link>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingGrades.map((g: any) => (
                <div key={g.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border/60 bg-card">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground">{g.subjects?.name || "—"}</p>
                    <p className="text-xs text-muted-foreground">{g.semester} · CC: <strong>{formatGrade(g.cc_grade)}</strong> · Examen: <strong>{formatGrade(g.exam_grade)}</strong> · Moyenne: <strong className={g.average >= 10 ? "text-success" : "text-destructive"}>{formatGrade(g.average)}</strong></p>
                  </div>
                  {g.approved_by_student ? (
                    <Badge className="bg-green-600/15 text-green-700 border-green-600/30 gap-1"><CheckCircle2 className="w-3 h-3" /> Signé — en attente de transmission</Badge>
                  ) : (
                    <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => approveMutation.mutate(g.id)} disabled={approveMutation.isPending}>
                      <PenLine className="w-4 h-4" /> Approuver & signer
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {grades.length === 0 ? (

        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50">
            <CardContent className="p-8 text-center">
              <TrendingUp className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="font-heading font-semibold text-foreground mb-2">Aucune note disponible</h3>
              <p className="text-muted-foreground text-sm">
                Les notes pour {semester === "all" ? "cette année" : semester} {selectedYear} n'ont pas encore été publiées.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <motion.div variants={item} className="lg:col-span-2">
            <Card className="glass-card-elevated border-border/50 overflow-hidden">
              <CardContent className="p-3 sm:p-0">
                <div className="space-y-3 sm:hidden">
                  {grades.map((g: any) => {
                    const avg = g.average;
                    const isRattrapage = avg !== null && avg < 10;
                    const ratt = rattrapageMap.get(g.subject_id);
                    const finalAvg = ratt && ratt.status === "passed" && ratt.rattrapage_grade != null
                      ? Math.max(avg ?? 0, ratt.rattrapage_grade)
                      : avg;
                    const isValidated = finalAvg != null && finalAvg >= 10;

                    return (
                      <GradeMobileCard
                        key={g.id}
                        grade={g}
                        rattrapage={ratt}
                        finalAvg={finalAvg}
                        isRattrapage={isRattrapage}
                        isValidated={isValidated}
                      />
                    );
                  })}

                  <div className="rounded-lg border border-info/35 bg-info/10 p-3 flex items-center justify-between gap-3 shadow-sm">
                    <div>
                      <p className="text-sm font-bold text-foreground">Moyenne Générale</p>
                      <p className="text-xs font-semibold text-foreground/70">Crédits {creditsValides}/{creditsTotaux}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-info">{overallAvg.toFixed(2)}</p>
                      <Badge variant="outline" className={`text-[10px] font-semibold ${getMentionColor(overallAvg)}`}>{getMention(overallAvg)}</Badge>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left p-4 text-sm font-semibold text-foreground">Matière</th>
                        <th className="text-center p-4 text-sm font-semibold text-foreground">Sem.</th>
                        <th className="text-center p-4 text-sm font-semibold text-foreground">Coef</th>
                        <th className="text-center p-4 text-sm font-semibold text-foreground">Crédits</th>
                        <th className="text-center p-4 text-sm font-semibold text-foreground">CC</th>
                        <th className="text-center p-4 text-sm font-semibold text-foreground">Examen</th>
                        <th className="text-center p-4 text-sm font-semibold text-foreground">Moyenne</th>
                        <th className="text-center p-4 text-sm font-semibold text-foreground">Rattrapage</th>
                        <th className="text-center p-4 text-sm font-semibold text-foreground">Mention</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grades.map((g: any) => {
                        const avg = g.average;
                        const isRattrapage = avg !== null && avg < 10;
                        const ratt = rattrapageMap.get(g.subject_id);
                        const finalAvg = ratt && ratt.status === "passed" && ratt.rattrapage_grade != null
                          ? Math.max(avg ?? 0, ratt.rattrapage_grade)
                          : avg;
                        const credits = Number(g.subjects?.credits) || 0;
                        const isValidated = finalAvg != null && finalAvg >= 10;

                        return (
                          <tr key={g.id} className={`border-b border-border/50 hover:bg-secondary/20 transition-colors ${isRattrapage && (!ratt || ratt.status !== "passed") ? "bg-destructive/5" : ""}`}>
                            <td className="p-4 text-sm font-medium text-foreground">{g.subjects?.name || "—"}</td>
                            <td className="p-4 text-sm text-center text-muted-foreground">{g.semester}</td>
                            <td className="p-4 text-sm text-center text-muted-foreground">{g.subjects?.coefficient || "—"}</td>
                            <td className="p-4 text-sm text-center">
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${isValidated ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                                {credits || "—"}
                              </span>
                            </td>
                            <td className="p-4 text-sm text-center text-foreground">{formatGrade(g.cc_grade)}</td>
                            <td className="p-4 text-sm text-center text-foreground">{formatGrade(g.exam_grade)}</td>
                            <td className="p-4 text-sm text-center font-bold text-foreground">
                              {formatGrade(avg)}
                              {isRattrapage && (!ratt || ratt.status !== "passed") && (
                                <AlertTriangle className="w-3.5 h-3.5 text-destructive inline ml-1" />
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {ratt ? (
                                <div className="text-xs">
                                  {ratt.rattrapage_grade != null ? (
                                    <span className={`font-bold ${ratt.rattrapage_grade >= 10 ? "text-success" : "text-destructive"}`}>
                                      {formatGrade(ratt.rattrapage_grade)}/20
                                    </span>
                                  ) : (
                                    <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">En attente</Badge>
                                  )}
                                </div>
                              ) : isRattrapage ? (
                                <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">À passer</Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              {finalAvg != null && (
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getMentionColor(finalAvg)}`}>
                                  {getMention(finalAvg)}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-primary/5">
                        <td className="p-4 text-sm font-bold text-foreground" colSpan={3}>Moyenne Générale</td>
                        <td className="p-4 text-sm text-center font-bold text-accent">
                          {creditsValides}/{creditsTotaux}
                        </td>
                        <td colSpan={2}></td>
                        <td className="p-4 text-sm text-center font-bold text-accent text-lg">{overallAvg.toFixed(2)}</td>
                        <td></td>
                        <td className="p-4 text-center">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${getMentionColor(overallAvg)}`}>
                            {getMention(overallAvg)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={item} className="space-y-4 min-w-0">
            <Card className="glass-card-elevated border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-heading flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-accent" /> Analyse par matière
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(220, grades.length * 20 + 100)}>
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
                    <PolarRadiusAxis domain={[0, 20]} tick={{ fontSize: 9, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
                    <Radar name="Note" dataKey="note" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.08} strokeWidth={2.5} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {semesterBarData.length > 0 && (
              <Card className="glass-card-elevated border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg font-heading flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-accent" /> Comparaison semestres
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={semesterBarData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
                      <YAxis domain={[0, 20]} tick={{ fontSize: 10, fontWeight: 700, fill: "hsl(var(--foreground))" }} />
                      <Tooltip />
                      <Bar dataKey="moyenne" fill="hsl(var(--primary))" fillOpacity={0.72} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex justify-around text-xs text-muted-foreground mt-2">
                    {s1Grades.length > 0 && <span>S1: <strong className="text-foreground">{s1Avg.toFixed(2)}</strong> ({s1Grades.length} mat.)</span>}
                    {s2Grades.length > 0 && <span>S2: <strong className="text-foreground">{s2Avg.toFixed(2)}</strong> ({s2Grades.length} mat.)</span>}
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </div>
      )}

      {/* Redoublant: Previous year rattrapages section */}
      {isRedoublant && !isViewingHistory && previousRattrapages.length > 0 && (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-warning/30 bg-warning/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-warning" />
                Rattrapages — Matières non validées ({getPreviousYear(currentYear)})
              </CardTitle>
              <p className="text-sm text-muted-foreground">En tant que redoublant, voici les matières à rattraper de l'année précédente.</p>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-secondary/30">
                      <th className="text-left p-3 text-sm font-semibold text-foreground">Matière</th>
                      <th className="text-center p-3 text-sm font-semibold text-foreground">Crédits</th>
                      <th className="text-center p-3 text-sm font-semibold text-foreground">Note originale</th>
                      <th className="text-center p-3 text-sm font-semibold text-foreground">Note rattrapage</th>
                      <th className="text-center p-3 text-sm font-semibold text-foreground">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previousRattrapages.map((r: any) => (
                      <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                        <td className="p-3 text-sm font-medium text-foreground">{r.subjects?.name || "—"}</td>
                        <td className="p-3 text-sm text-center text-muted-foreground">{r.subjects?.credits || "—"}</td>
                        <td className="p-3 text-sm text-center text-foreground">{r.original_average != null ? r.original_average.toFixed(2) : "—"}</td>
                        <td className="p-3 text-sm text-center font-bold">
                          {r.rattrapage_grade != null ? (
                            <span className={r.rattrapage_grade >= 10 ? "text-success" : "text-destructive"}>{formatGrade(r.rattrapage_grade)}/20</span>
                          ) : "—"}
                        </td>
                        <td className="p-3 text-center">
                          {r.status === "passed" ? (
                            <Badge variant="outline" className="bg-success/15 text-success border-success/30 text-xs">Validé ✓</Badge>
                          ) : r.status === "failed" ? (
                            <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30 text-xs">Échoué</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-warning/15 text-warning border-warning/30 text-xs">En attente</Badge>
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
      )}
    </motion.div>
    </NewYearAccessGuard>
  );
};

export default GradesPage;
