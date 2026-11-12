import { motion } from "framer-motion";
import { BookOpen, Users, Calendar, ClipboardList, Archive, TrendingUp, Clock, GraduationCap, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProfessorSubjects } from "@/hooks/useProfessorSubjects";
import { useState, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const ProfessorDashboardPage = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const { data: subjectsInfo = [], isLoading } = useProfessorSubjects();

  const active = useMemo(() => subjectsInfo.filter(s => !s.isArchived), [subjectsInfo]);
  const archived = useMemo(() => subjectsInfo.filter(s => s.isArchived), [subjectsInfo]);
  const visible = showArchived ? archived : active;

  const totalStudents = active.reduce((sum, s) => sum + s.studentCount, 0);
  const subjectIds = subjectsInfo.map(s => s.subject.id);

  const { data: gradeStats } = useQuery({
    queryKey: ["prof-grade-stats", subjectIds.join(",")],
    queryFn: async () => {
      if (subjectIds.length === 0) return { total: 0, submitted: 0 };
      const { data } = await supabase.from("grades").select("submission_status").in("subject_id", subjectIds);
      const total = (data || []).length;
      const submitted = (data || []).filter((g: any) => g.submission_status === "submitted").length;
      return { total, submitted };
    },
    enabled: subjectIds.length > 0,
  });

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ["prof-upcoming-events", subjectIds.join(",")],
    queryFn: async () => {
      if (subjectIds.length === 0) return [];
      const { data } = await supabase
        .from("schedule_events")
        .select("id, title, start_time, end_time, location, subjects(name)")
        .in("subject_id", subjectIds)
        .gte("start_time", new Date().toISOString())
        .order("start_time")
        .limit(5);
      return data || [];
    },
    enabled: subjectIds.length > 0,
  });

  const hasSig = !!(profile as any)?.signature_url;

  const stats = [
    { label: "Matières actives", value: active.length, icon: BookOpen, color: "text-accent", bg: "bg-accent/10" },
    { label: "Étudiants suivis", value: totalStudents, icon: Users, color: "text-info", bg: "bg-info/10" },
    { label: "Cours à venir", value: upcomingEvents.length, icon: Calendar, color: "text-success", bg: "bg-success/10" },
    { label: "Notes transmises", value: `${gradeStats?.submitted || 0}/${gradeStats?.total || 0}`, icon: ClipboardList, color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
            Bonjour, {profile?.first_name || "Professeur"} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Tableau de bord enseignant — vue d'ensemble de vos matières</p>
        </div>
        {!hasSig && (
          <Button variant="outline" size="sm" onClick={() => navigate("/professor/settings")} className="gap-2">
            <GraduationCap className="w-4 h-4" /> Ajouter votre signature
          </Button>
        )}
      </motion.div>

      {!hasSig && (
        <motion.div variants={item}>
          <Card className="border-amber-500/40 bg-amber-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <GraduationCap className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-foreground">Signature numérique manquante</p>
                <p className="text-muted-foreground mt-0.5">Pour que votre signature apparaisse sur les procès-verbaux des notes, importez-la dans Paramètres.</p>
              </div>
              <Button size="sm" onClick={() => navigate("/professor/settings")}>Configurer</Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <motion.div key={s.label} variants={item}>
            <Card className="glass-card border-border/50 hover:border-accent/40 transition-colors">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${s.bg} ${s.color}`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold text-foreground truncate">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div variants={item} className="grid lg:grid-cols-3 gap-4">
        <Card className="glass-card border-border/50 lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-accent" />
              {showArchived ? "Matières archivées" : "Mes matières en cours"}
              <Badge variant="outline">{visible.length}</Badge>
            </CardTitle>
            <Button size="sm" variant={showArchived ? "default" : "outline"} onClick={() => setShowArchived(!showArchived)} className="gap-1.5">
              <Archive className="w-3.5 h-3.5" />
              {showArchived ? "Voir actives" : `Archives (${archived.length})`}
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">Chargement...</p>
            ) : visible.length === 0 ? (
              <p className="text-muted-foreground text-sm py-6 text-center">
                {showArchived ? "Aucune matière archivée." : "Aucune matière active."}
              </p>
            ) : (
              <div className="space-y-2">
                {visible.map(({ subject: s, studentCount, lastSessionEnd, isArchived }) => (
                  <div
                    key={s.id}
                    onClick={() => navigate("/professor/grades")}
                    className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border/50 hover:border-accent/40 hover:bg-secondary/50 transition cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                        {isArchived && <Badge variant="secondary" className="text-[10px] gap-1"><Archive className="w-3 h-3" />Archivée</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(s as any).filieres?.name || "—"} · {s.level} · {s.semester}
                        {lastSessionEnd && (
                          <span className="ml-2 inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {isArchived ? "Terminée le " : "Jusqu'au "}
                            {format(lastSessionEnd, "dd MMM yyyy", { locale: fr })}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <div className="text-right">
                        <p className="text-lg font-bold text-accent leading-none">{isArchived ? "—" : studentCount}</p>
                        <p className="text-[10px] text-muted-foreground uppercase">étudiants</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{s.credits} crédits</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="w-5 h-5 text-success" /> Prochains cours
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">Aucun cours programmé.</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map((e: any) => (
                  <div key={e.id} className="p-2.5 rounded-lg bg-secondary/30 border border-border/50">
                    <p className="text-sm font-medium text-foreground truncate">{e.subjects?.name || e.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(e.start_time), "EEE dd MMM · HH:mm", { locale: fr })}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {gradeStats && gradeStats.total > 0 && (
        <motion.div variants={item}>
          <Card className="glass-card border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-success" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-foreground">
                  Progression saisie des notes : <span className="text-accent">{Math.round((gradeStats.submitted / gradeStats.total) * 100)}%</span>
                </p>
                <p className="text-xs text-muted-foreground">{gradeStats.submitted} / {gradeStats.total} notes transmises à l'administration</p>
              </div>
              <TrendingUp className="w-5 h-5 text-success" />
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ProfessorDashboardPage;
