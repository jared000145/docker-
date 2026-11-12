import {useStudentPlacement} from '@/hooks/useStudentPlacement';
import PlacementNotice from '@/components/student/PlacementNotice';
import { motion } from "framer-motion";
import {
  TrendingUp, BookOpen, Award, Bell, CreditCard, User, Sparkles, History,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StudentProgression from '@/components/admin/StudentProgression';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { Badge } from "@/components/ui/badge";
import { ClosureBanner } from "@/components/student/ClosureBanner";
import { ExamBlancCard } from "@/components/student/ExamBlancCard";
import { useCycle } from "@/hooks/useCycle";
import StudentSchoolDashboard from "@/components/student/StudentSchoolDashboard";
import { computeOverallAverage, computeCreditsValidated, getFinalAvg, type CalcMode } from "@/lib/gradeCalc";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const formatCFA = (n: number) => n.toLocaleString("fr-FR") + " FCFA";

const UniversityDashboard = () => {

  const { profile, user } = useAuth();
  const { institution } = useInstitution();
  const { selectedYear, isViewingHistory } = useAcademicYear();

  // Grades for selected year
  const { data: grades = [] } = useQuery({
    queryKey: ["grades", user?.id, selectedYear],
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

  // Rattrapages for selected year (used to recompute moyenne / crédits)
  const { data: rattrapages = [] } = useQuery({
    queryKey: ["dashboard-rattrapages", user?.id, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("rattrapages")
        .select("subject_id, rattrapage_grade, status")
        .eq("user_id", user!.id)
        .eq("academic_year", selectedYear);
      return data || [];
    },
    enabled: !!user,
  });

  // UE links for the year (to count UEs validated)
  const { data: ueLinks = [] } = useQuery({
    queryKey: ["dashboard-ue-links", user?.id, selectedYear, grades.map((g: any) => g.subject_id).join(",")],
    queryFn: async () => {
      const subjectIds = grades.map((g: any) => g.subject_id).filter(Boolean);
      if (!subjectIds.length) return [];
      const { data } = await supabase
        .from("ue_matieres")
        .select("ue_id, subject_id, ues!inner(id, nom, credits, academic_year)")
        .in("subject_id", subjectIds);
      return ((data as any[]) || []).filter((l: any) => l.ues?.academic_year === selectedYear);
    },
    enabled: !!user && grades.length > 0,
  });

  // Payments for selected year
  const { data: payments = [] } = useQuery({
    queryKey: ["payments", user?.id, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("payments")
        .select("*")
        .eq("user_id", user!.id)
        .eq("academic_year", selectedYear);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["filieres"],
    queryFn: async () => {
      const { data } = await supabase.from("filieres").select("id, name");
      return data || [];
    },
  });

  // History data for the selected year (if viewing history)
  const { data: yearHistory } = useQuery({
    queryKey: ["year-history", user?.id, selectedYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_year_history")
        .select("*")
        .eq("user_id", user!.id)
        .eq("academic_year", selectedYear)
        .maybeSingle();
      return data;
    },
    enabled: !!user && isViewingHistory,
  });

  // Mode de calcul de la moyenne défini par l'établissement (pour aligner avec la page Notes)
  const { data: academicParams } = useQuery({
    queryKey: ["params-dashboard", institution?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("parametres_etablissement")
        .select("mode_calcul_moyenne_semestre")
        .eq("institution_id", institution!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!institution?.id,
  });

  useRealtimeSubscription("grades", [["grades", user?.id || "", selectedYear]], user ? { column: "user_id", value: user.id } : undefined);
  useRealtimeSubscription("notifications", [["notifications", user?.id || ""]], user ? { column: "user_id", value: user.id } : undefined);
  useRealtimeSubscription("payments", [["payments", user?.id || "", selectedYear]], user ? { column: "user_id", value: user.id } : undefined);

  // Final average per subject (taking rattrapage into account)
  const rattMap = new Map((rattrapages as any[]).map((r) => [r.subject_id, r]));
  const finalGrades = grades.map((g: any) => ({ ...g, finalAvg: getFinalAvg(g as any, rattMap.get(g.subject_id) as any) }));

  // Moyenne générale alignée avec la page Notes (même mode de calcul)
  const calcMode = ((academicParams as any)?.mode_calcul_moyenne_semestre || "MOYENNE_UE_PONDEREE") as CalcMode;
  const overallAvg = computeOverallAverage(grades as any, rattrapages as any, ueLinks as any, calcMode);
  const avgGrade = overallAvg != null ? overallAvg.toFixed(2) : "–";

  // Crédits validés (par matière, pondéré rattrapage)
  const { acquired: creditsValides, total: creditsTotaux } = computeCreditsValidated(grades as any, rattrapages as any);

  // UE validées (moyenne pondérée par coefficient des matières >= 10)
  const ueValidatedCount = (() => {
    const map: Record<string, { weighted: number; coef: number }> = {};
    (ueLinks as any[]).forEach((l) => {
      const g = finalGrades.find((x: any) => x.subject_id === l.subject_id);
      if (!g || g.finalAvg == null) return;
      const coef = g.subjects?.coefficient || 1;
      if (!map[l.ue_id]) map[l.ue_id] = { weighted: 0, coef: 0 };
      map[l.ue_id].weighted += Number(g.finalAvg) * coef;
      map[l.ue_id].coef += coef;
    });
    return Object.values(map).filter((u) => u.coef > 0 && u.weighted / u.coef >= 10).length;
  })();
  const ueTotal = new Set((ueLinks as any[]).map((l) => l.ue_id)).size;

  // En vue historique : utiliser les crédits stockés (plus fiables)
  const creditsAffiches = isViewingHistory && yearHistory
    ? `${yearHistory.credits_acquired}/${yearHistory.credits_total}`
    : `${creditsValides}/${creditsTotaux || 60}`;

  // Reste à payer correct: amount - paid_amount sur tous les paiements
  const totalDebt = payments.reduce((s, p: any) => s + Number(p.amount || 0), 0);
  const totalPaid = payments.reduce((s, p: any) => s + Number(p.paid_amount || 0), 0);
  const remaining = Math.max(0, totalDebt - totalPaid);

  const filiereName = filieres.find((f: any) => f.id === profile?.filiere_id)?.name || "—";
  const isBoursier = (profile as any)?.statut_boursier;

  const subjectData = finalGrades.map((g: any) => ({
    matiere: g.subjects?.name?.slice(0, 10) || "?",
    matiereFull: g.subjects?.name || "Matière",
    note: g.finalAvg || 0,
  }));

  const statColors = [
    "from-primary to-accent",
    "from-secondary to-primary",
    "from-accent to-primary",
    "from-primary to-secondary",
    "from-secondary to-accent",
    "from-accent to-secondary",
  ];

  const stats = [
    { label: "Moyenne générale", value: `${avgGrade}/20`, icon: TrendingUp },
    { label: "Crédits validés", value: creditsAffiches, icon: Award },
    { label: "UE validées", value: ueTotal > 0 ? `${ueValidatedCount}/${ueTotal}` : "—", icon: BookOpen },
    { label: "Reste à payer", value: formatCFA(remaining), icon: CreditCard },
    { label: "Matières évaluées", value: `${grades.length}`, icon: BookOpen },
    { label: "Notifications", value: `${notifications.length}`, icon: Bell },
  ];

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case "admis": return <Badge className="bg-success/15 text-success border-success/30">✅ Admis</Badge>;
      case "admis_conditionnel": return <Badge className="bg-warning/15 text-warning border-warning/30">⚠️ Admis conditionnel</Badge>;
      case "redoublant": return <Badge className="bg-destructive/15 text-destructive border-destructive/30">❌ Redoublant</Badge>;
      default: return <Badge variant="secondary">{decision}</Badge>;
    }
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <ClosureBanner />
      {user?.id&&<StudentProgression studentId={user.id}/>}
      <ExamBlancCard />
      {/* Welcome header */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-accent/20 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            {isViewingHistory ? (
              <History className="w-5 h-5 text-accent" />
            ) : (
              <Sparkles className="w-5 h-5 text-accent" />
            )}
            <span className="text-sm text-primary-foreground/70">
              {isViewingHistory ? `Historique — ${selectedYear}` : "Tableau de bord"}
            </span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">
            {isViewingHistory
              ? `Archives ${selectedYear}`
              : `Bonjour, ${profile?.first_name || "Étudiant"} 👋`}
          </h1>
          <p className="text-primary-foreground/70 mt-1">
            {isViewingHistory
              ? "Consultez vos résultats et données archivées pour cette année"
              : "Voici un aperçu de votre parcours académique"}
          </p>
        </div>
      </motion.div>

      {/* Year history summary card (only when viewing history) */}
      {isViewingHistory && yearHistory && (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50 overflow-hidden border-l-4 border-l-accent">
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                    <Award className="w-6 h-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Résultat de l'année {selectedYear}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getDecisionBadge(yearHistory.decision)}
                      <span className="text-sm text-foreground font-medium">
                        Niveau: {yearHistory.level}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 sm:ml-auto">
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">Crédits</p>
                    <p className="text-lg font-bold text-accent">{yearHistory.credits_acquired}/{yearHistory.credits_total}</p>
                  </div>
                  {yearHistory.ue_to_retake_ids && yearHistory.ue_to_retake_ids.length > 0 && (
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">UE à rattraper</p>
                      <p className="text-lg font-bold text-destructive">{yearHistory.ue_to_retake_ids.length}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Info card */}
      <motion.div variants={item} whileHover={{ y: -2 }} transition={{ type: "spring", stiffness: 400 }}>
        <Card className="glass-card-elevated border-border/50 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              <motion.div 
                className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center shadow-inner"
                whileHover={{ rotate: 10, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <User className="w-6 h-6 text-accent" />
              </motion.div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nom</span><p className="font-medium text-foreground">{profile?.first_name} {profile?.last_name}</p></div>
                <div><span className="text-muted-foreground">Matricule</span><p className="font-mono text-accent">{profile?.student_number || "—"}</p></div>
                <div><span className="text-muted-foreground">Filière</span><p className="font-medium text-foreground">{filiereName}</p></div>
                <div><span className="text-muted-foreground">Niveau</span>
                  <div className="flex items-center gap-2">
                    <span className="bg-accent/15 text-accent text-xs px-2 py-0.5 rounded-full font-medium">
                      {isViewingHistory && yearHistory ? yearHistory.level : (profile?.level || "—")}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isBoursier ? "bg-success/15 text-success" : "bg-info/15 text-info"}`}>
                      {isBoursier ? "Boursier" : "Non boursier"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            whileHover={{ y: -4, scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 17 }}
          >
            <Card className="glass-card-elevated border-border/50 overflow-hidden group cursor-default">
              <CardContent className="p-5 relative">
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${statColors[i]} mix-blend-soft-light`} />
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-3">
                    <motion.div 
                      className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${statColors[i]} shadow-lg`}
                      whileHover={{ rotate: 12 }}
                    >
                      <stat.icon className="w-5 h-5 text-white" />
                    </motion.div>
                  </div>
                  <p className="text-2xl font-heading font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts */}
      {grades.length > 0 && (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" /> Notes par matière
                {isViewingHistory && <Badge variant="outline" className="text-xs">Archivé</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={subjectData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="matiere" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis domain={[0, 20]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border))",
                      background: "hsl(var(--popover))",
                      color: "hsl(var(--popover-foreground))",
                      boxShadow: "var(--shadow-card)",
                    }}
                    labelStyle={{ fontWeight: 600, color: "hsl(var(--popover-foreground))" }}
                    labelFormatter={(_label: any, payload: any) =>
                      payload?.[0]?.payload?.matiereFull || _label
                    }
                    formatter={(value: any) => [`${Number(value).toFixed(2)}/20`, "Moyenne"]}
                  />
                  <Bar dataKey="note" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {grades.length === 0 && (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50">
            <CardContent className="p-10 text-center">
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <TrendingUp className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
              </motion.div>
              <h3 className="font-heading font-semibold text-foreground mb-2">
                {isViewingHistory ? "Aucune donnée archivée" : "Aucune donnée académique"}
              </h3>
              <p className="text-muted-foreground text-sm">
                {isViewingHistory
                  ? `Aucune note trouvée pour l'année ${selectedYear}.`
                  : "Vos notes apparaîtront ici une fois publiées."}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Notifications */}
      {!isViewingHistory && (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <Bell className="w-5 h-5 text-accent" /> Notifications récentes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {notifications.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Aucune notification</p>
              ) : notifications.map((notif, i) => (
                <motion.div
                  key={notif.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-all duration-200 hover:shadow-sm cursor-default"
                >
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${
                    notif.type === "info" ? "bg-info" : notif.type === "warning" ? "bg-warning" : notif.type === "success" ? "bg-success" : "bg-destructive"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{notif.title}</p>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{new Date(notif.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                </motion.div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

const DashboardPage = () => {
  const {selectedYear}=useAcademicYear();
  const placement=useStudentPlacement(undefined,selectedYear);
  if(placement.isPending||placement.isError||!placement.cycle)return <PlacementNotice loading={placement.isPending} error={placement.isError}/>;
  if(placement.isSchool)return <StudentSchoolDashboard />;
  return <UniversityDashboard />;
};

export default DashboardPage;
