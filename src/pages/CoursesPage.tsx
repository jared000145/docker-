import {useAcademicYear} from '@/hooks/useAcademicYear';
import {useStudentPlacement} from '@/hooks/useStudentPlacement';
import PlacementNotice from '@/components/student/PlacementNotice';
import { useCycle } from "@/hooks/useCycle";
import StudentSchoolCourses from "@/components/student/StudentSchoolCourses";
import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewYearAccessGuard } from "@/components/student/NewYearAccessGuard";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const colors = [
  "bg-info/15 text-info",
  "bg-success/15 text-success",
  "bg-accent/15 text-accent",
  "bg-warning/15 text-warning",
  "bg-destructive/15 text-destructive",
];

const CoursesUniversity = () => {
  const { user, profile } = useAuth();

  const { data: filiere } = useQuery({
    queryKey: ["my-filiere", profile?.filiere_id],
    enabled: !!profile?.filiere_id,
    queryFn: async () => {
      const { data } = await supabase.from("filieres").select("name").eq("id", profile!.filiere_id!).maybeSingle();
      return data;
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["my-subjects", profile?.filiere_id, profile?.level],
    queryFn: async () => {
      let query = supabase.from("subjects").select("*, filieres(name)");
      if (profile?.filiere_id) query = query.eq("filiere_id", profile.filiere_id);
      if (profile?.level) query = query.eq("level", profile.level);
      const { data } = await query.order("name");
      return data || [];
    },
    enabled: !!user,
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ["enrollments-courses", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("enrollments")
        .select("*, subjects(*)")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: history = [] } = useQuery({
    queryKey: ["my-year-history", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("student_year_history")
        .select("*, filieres(name)")
        .eq("user_id", user!.id)
        .order("academic_year", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  return (
    <NewYearAccessGuard>
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Mes Cours</h1>
        <p className="text-muted-foreground mt-1">
          {filiere?.name || profile?.department || "—"} · {profile?.level || "—"} · {profile?.academic_year || "—"}
        </p>
      </motion.div>

      <Tabs defaultValue="current">
        <TabsList>
          <TabsTrigger value="current">Année en cours</TabsTrigger>
          <TabsTrigger value="archives">Archives ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="mt-4">
          {subjects.length === 0 ? (
            <motion.div variants={item}>
              <Card className="glass-card-elevated border-border/50">
                <CardContent className="p-8 text-center">
                  <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="font-heading font-semibold text-foreground mb-2">Aucun cours</h3>
                  <p className="text-muted-foreground text-sm">
                    Vos matières apparaîtront ici une fois que votre filière sera configurée.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {subjects.map((subject: any, i: number) => {
                const enrollment = enrollments.find((e: any) => e.subject_id === subject.id);
                return (
                  <motion.div key={subject.id} variants={item}>
                    <Card className="glass-card-elevated border-border/50 hover:shadow-lg transition-all group cursor-pointer">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${colors[i % colors.length]}`}>
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded-full">
                            {subject.credits} crédits
                          </span>
                        </div>

                        <h3 className="font-heading font-semibold text-foreground mb-1 group-hover:text-accent transition-colors">
                          {subject.name}
                        </h3>
                        <p className="text-xs text-accent font-medium mb-1">{subject.filieres?.name || filiere?.name || "—"}</p>
                        <p className="text-sm text-muted-foreground mb-4">{subject.professor || "Professeur non assigné"}</p>

                        <div className="space-y-3">
                          {enrollment && (
                            <div>
                              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                                <span>Progression</span>
                                <span className="font-medium text-foreground">{enrollment.progress}%</span>
                              </div>
                              <Progress value={enrollment.progress} className="h-2" />
                            </div>
                          )}
                          <div className="flex items-center justify-between pt-2 border-t border-border/50">
                            <span className="text-xs text-muted-foreground">
                              {subject.semester} · Coef {subject.coefficient}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archives" className="mt-4">
          {history.length === 0 ? (
            <Card className="glass-card-elevated border-border/50">
              <CardContent className="p-8 text-center">
                <p className="text-muted-foreground">Aucun historique disponible</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {history.map((h: any) => (
                <Card key={h.id} className="glass-card-elevated border-border/50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-foreground">{h.academic_year} — {h.level}</p>
                      <p className="text-sm text-muted-foreground">{h.filieres?.name || "—"}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${h.status === "completed" || h.decision === "admis" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {h.status === "completed" || h.decision === "admis" ? "Validé" : "À reprendre"}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
    </NewYearAccessGuard>
  );
};

const CoursesPage = () => {
  const {selectedYear}=useAcademicYear();
  const placement=useStudentPlacement(undefined,selectedYear);
  if(placement.isPending||placement.isError||!placement.cycle)return <PlacementNotice loading={placement.isPending} error={placement.isError}/>;
  if(placement.isSchool)return <StudentSchoolCourses />;
  return <CoursesUniversity />;
};

export default CoursesPage;
