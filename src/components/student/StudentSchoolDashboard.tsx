import StudentProgression from '@/components/admin/StudentProgression';
import {useAcademicYear} from '@/hooks/useAcademicYear';
import {AcademicYearSelector} from '@/components/AcademicYearSelector';
import { motion } from "framer-motion";
import { TrendingUp, BookOpen, Bell, CreditCard, User, Sparkles, Trophy, CalendarX } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useCycle } from "@/hooks/useCycle";
import { ClosureBanner } from "@/components/student/ClosureBanner";
import { ExamBlancCard } from "@/components/student/ExamBlancCard";
import { TRIMESTRES, TRIMESTRE_LABEL, matiereAverage, trimestreAverage, mentionForAverage } from "@/lib/collegeLycee";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: "easeOut" as const } },
};

const formatCFA = (n: number) => n.toLocaleString("fr-FR") + " FCFA";

const StudentSchoolDashboard = () => {
  const { user, profile } = useAuth();
  const { institution } = useInstitution();
  const { thirdNoteEnabled } = useCycle();
  const {selectedYear:activeYear}=useAcademicYear();
  const registration=useQuery({queryKey:['school-annual-class',user?.id,activeYear],enabled:!!user,queryFn:async()=>{const{data,error}=await(supabase as any).from('student_years').select('classe_id').eq('user_id',user!.id).eq('academic_year',activeYear).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)throw error;return data;}});
  const annualClassId=registration.data?.classe_id||(activeYear===institution?.academic_year?profile?.classe_id:null);
  const [trimestre, setTrimestre] = useState<string>("T1");

  const { data: classe } = useQuery({
    queryKey: ["dash-school-classe", annualClassId],
    enabled: !!annualClassId,
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*").eq("id", annualClassId!).maybeSingle();
      return data;
    },
  });

  const { data: grades = [] } = useQuery({
    queryKey: ["dash-school-grades", user?.id, trimestre, activeYear],
    enabled: !!user && !!annualClassId,
    queryFn: async () => {
      const { data } = await supabase
        .from("grades_trimestre")
        .select("*")
        .eq("user_id", user!.id)
        .eq("classe_id", annualClassId!)
        .eq("academic_year", activeYear)
        .eq("trimestre", trimestre);
      return data || [];
    },
  });

  const gradeSubjectIds = Array.from(new Set((grades as any[]).map((g) => g.subject_id).filter(Boolean)));

  const { data: subjects = [] } = useQuery({
    queryKey: ["dash-school-subjects", annualClassId, gradeSubjectIds.join(",")],
    enabled: !!annualClassId || gradeSubjectIds.length > 0,
    queryFn: async () => {
      const map: { subject_id: string; name: string }[] = [];
      if (gradeSubjectIds.length > 0) {
        const { data } = await supabase.from("subjects").select("id, name").in("id", gradeSubjectIds);
        (data || []).forEach((s: any) => map.push({ subject_id: s.id, name: s.name }));
      }
      if (annualClassId) {
        const { data } = await supabase
          .from("subject_classes")
          .select("subject_id, subjects(name)")
          .eq("classe_id", profile.classe_id);
        (data || []).forEach((s: any) => {
          if (s.subjects?.name && !map.some((m) => m.subject_id === s.subject_id)) {
            map.push({ subject_id: s.subject_id, name: s.subjects.name });
          }
        });
      }
      return map;
    },
  });


  const { data: classStats } = useQuery({
    queryKey: ["dash-school-stats", user?.id, annualClassId, trimestre, activeYear],
    enabled: !!user && !!annualClassId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .rpc("get_trimestre_class_stats", {
          _user_id: user!.id,
          _classe_id: profile!.classe_id,
          _trimestre: trimestre,
          _academic_year: activeYear,
        })
        .maybeSingle();
      return data;
    },
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["dash-school-payments", user?.id, activeYear],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("payments").select("amount, paid_amount").eq("user_id", user!.id).eq("academic_year", activeYear);
      return data || [];
    },
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ["dash-school-attendance", user?.id, activeYear],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("attendance").select("status").eq("user_id", user!.id).eq("academic_year", activeYear);
      return data || [];
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["dash-school-notifs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("notifications").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const rows = (grades as any[]).map((g) => ({
    ...g,
    moyenne: matiereAverage(g.note1, g.bareme1, g.note2, g.bareme2, thirdNoteEnabled ? g.note3 : null, g.bareme3),
  }));
  const localAvg = trimestreAverage(rows.map((r) => ({ moyenne: r.moyenne, coefficient: r.coefficient })));
  const moyenne = (classStats as any)?.moyenne_eleve ?? localAvg;
  const rang = (classStats as any)?.rang ?? null;
  const effectif = (classStats as any)?.effectif ?? null;
  const moyClasse = (classStats as any)?.moyenne_classe ?? null;

  const totalDebt = (payments as any[]).reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaid = (payments as any[]).reduce((s, p) => s + Number(p.paid_amount || 0), 0);
  const remaining = Math.max(0, totalDebt - totalPaid);
  const absences = (attendance as any[]).filter((a) => a.status === "absent").length;

  const subjectNameById = new Map((subjects as any[]).map((s) => [s.subject_id, s.name]));
  const chartData = rows
    .filter((r) => r.moyenne != null)
    .map((r) => {
      const name = r.matiere || subjectNameById.get(r.subject_id) || "Matière";
      return {
        matiere: name.length > 10 ? `${name.slice(0, 10)}…` : name,
        matiereFull: name,
        note: Number(r.moyenne),
      };
    });


  const statColors = [
    "from-accent to-amber-500",
    "from-emerald-500 to-teal-600",
    "from-rose-500 to-pink-600",
    "from-blue-500 to-indigo-600",
    "from-violet-500 to-purple-600",
    "from-cyan-500 to-sky-600",
  ];

  const stats = [
    { label: `Moyenne ${trimestre}`, value: moyenne != null ? `${Number(moyenne).toFixed(2)}/20` : "–", icon: TrendingUp },
    { label: "Rang", value: rang ? `${rang}${effectif ? ` / ${effectif}` : ""}` : "—", icon: Trophy },
    { label: "Moyenne de la classe", value: moyClasse != null ? Number(moyClasse).toFixed(2) : "—", icon: BookOpen },
    { label: "Reste à payer", value: formatCFA(remaining), icon: CreditCard },
    { label: "Absences", value: `${absences}`, icon: CalendarX },
    { label: "Notifications", value: `${notifications.length}`, icon: Bell },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <ClosureBanner />
      <AcademicYearSelector/>
      {user?.id&&<StudentProgression studentId={user.id}/>}
      <ExamBlancCard />

      <motion.div variants={item} className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-accent/20 blur-2xl" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-accent" />
            <span className="text-sm text-primary-foreground/70">Tableau de bord</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold">Bonjour, {profile?.first_name} 👋</h1>
          <p className="text-primary-foreground/80 mt-1 text-sm">
            Voici un aperçu de votre scolarité — {classe?.nom || "classe non affectée"} · {activeYear}
          </p>
        </div>
      </motion.div>

      {/* Fiche élève */}
      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center shadow-inner">
                <User className="w-6 h-6 text-accent" />
              </div>
              <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div><span className="text-muted-foreground">Nom</span><p className="font-medium text-foreground">{profile?.first_name} {profile?.last_name}</p></div>
                <div><span className="text-muted-foreground">Matricule</span><p className="font-mono text-accent">{profile?.student_number || "—"}</p></div>
                <div><span className="text-muted-foreground">Classe</span><p className="font-medium text-foreground">{classe?.nom || "—"}</p></div>
                <div><span className="text-muted-foreground">Niveau</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-accent/15 text-accent text-xs px-2 py-0.5 rounded-full font-medium">{(classe as any)?.niveau || profile?.level || "—"}</span>
                    {(classe as any)?.serie && (
                      <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">{(classe as any).serie}</span>
                    )}
                    {(profile as any)?.oriente_par_etat && (
                      <span className="bg-success/15 text-success text-xs px-2 py-0.5 rounded-full font-medium">Orienté par l'État</span>
                    )}
                  </div>
                </div>
              </div>
              <Select value={trimestre} onValueChange={setTrimestre}>
                <SelectTrigger className="w-full sm:w-44 bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIMESTRES.map((t) => <SelectItem key={t} value={t}>{TRIMESTRE_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} whileHover={{ y: -4, scale: 1.02 }} transition={{ type: "spring", stiffness: 400, damping: 17 }}>
            <Card className="glass-card-elevated border-border/50 overflow-hidden group cursor-default">
              <CardContent className="p-5 relative">
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br ${statColors[i]} mix-blend-soft-light`} />
                <div className="relative z-10">
                  <div className={`w-10 h-10 mb-3 rounded-xl flex items-center justify-center bg-gradient-to-br ${statColors[i]} shadow-lg`}>
                    <stat.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-2xl font-heading font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {moyenne != null && (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50">
            <CardContent className="p-5 flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Mention {TRIMESTRE_LABEL[trimestre]} :</span>
              <span className="text-sm font-semibold text-accent">{mentionForAverage(Number(moyenne))}</span>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {chartData.length > 0 ? (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-heading flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-accent" /> Moyennes par matière — {TRIMESTRE_LABEL[trimestre]}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
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
                    }}
                    labelStyle={{ fontWeight: 600, color: "hsl(var(--popover-foreground))" }}
                    labelFormatter={(_label: any, payload: any) => payload?.[0]?.payload?.matiereFull || _label}
                    formatter={(value: any) => [`${Number(value).toFixed(2)}/20`, "Moyenne"]}
                  />
                  <Bar dataKey="note" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} barSize={35} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div variants={item}>
          <Card className="glass-card-elevated border-border/50">
            <CardContent className="p-10 text-center">
              <TrendingUp className="w-14 h-14 text-muted-foreground/20 mx-auto mb-4" />
              <h3 className="font-heading font-semibold text-foreground mb-2">Aucune note pour {TRIMESTRE_LABEL[trimestre]}</h3>
              <p className="text-muted-foreground text-sm">Vos notes apparaîtront ici une fois saisies par vos professeurs.</p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-heading flex items-center gap-2"><Bell className="w-5 h-5 text-accent" /> Notifications récentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune notification</p>
            ) : (notifications as any[]).map((notif) => (
              <div key={notif.id} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/30">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${notif.type === "info" ? "bg-info" : notif.type === "warning" ? "bg-warning" : notif.type === "success" ? "bg-success" : "bg-destructive"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{notif.title}</p>
                  <p className="text-sm text-muted-foreground">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{new Date(notif.created_at).toLocaleDateString("fr-FR")}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default StudentSchoolDashboard;
