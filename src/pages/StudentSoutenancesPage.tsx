import { motion } from "framer-motion";
import { GraduationCap, Video, Calendar, Play } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 200 } } };

const StudentSoutenancesPage = () => {
  const { profile } = useAuth();
  const instId = profile?.institution_id;

  const { data: soutenances = [] } = useQuery({
    queryKey: ["student-soutenances", instId],
    queryFn: async () => {
      let q = supabase.from("soutenances").select("*, filieres(name), soutenance_jury(*)").order("soutenance_date", { ascending: false });
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-sout", instId],
    queryFn: async () => {
      let q = supabase.from("profiles").select("user_id, first_name, last_name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
  });
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  const upcoming = soutenances.filter((s: any) => s.status !== "terminee");
  const withVideo = soutenances.filter((s: any) => s.video_url);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-heading font-bold text-foreground">🎓 Soutenances</h1>
        <p className="text-muted-foreground mt-1">Planning et vidéos des soutenances</p>
      </motion.div>

      <Tabs defaultValue="planning" className="space-y-4">
        <TabsList>
          <TabsTrigger value="planning" className="gap-2"><Calendar className="w-4 h-4" /> Planning</TabsTrigger>
          <TabsTrigger value="videos" className="gap-2"><Video className="w-4 h-4" /> Vidéos ({withVideo.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="planning">
          <div className="grid gap-4 md:grid-cols-2">
            {soutenances.length === 0 ? (
              <p className="text-muted-foreground col-span-2 text-center py-8">Aucune soutenance programmée</p>
            ) : soutenances.map((s: any) => {
              const student = profileMap.get(s.student_id);
              return (
                <motion.div key={s.id} variants={item}>
                  <Card className="glass-card border-border/50 hover:border-accent/30 transition-all">
                    <CardContent className="p-4 space-y-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "terminee" ? "bg-success/15 text-success" : "bg-accent/15 text-accent"}`}>
                        {s.status === "terminee" ? "Terminée" : "Programmée"}
                      </span>
                      <h3 className="text-base font-semibold text-foreground">🎓 {s.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(s.soutenance_date), "EEEE dd MMMM yyyy · HH:mm", { locale: fr })}
                      </p>
                      <p className="text-xs text-muted-foreground">📍 {s.location || "—"} · {(s as any).filieres?.name || "—"} · {s.level}</p>
                      <p className="text-xs text-foreground">Étudiant : <strong>{student ? `${student.first_name} ${student.last_name}` : "—"}</strong></p>
                      {s.soutenance_jury?.length > 0 && (
                        <p className="text-xs text-muted-foreground">Jury : {s.soutenance_jury.map((j: any) => `${j.professor_name} (${j.role})`).join(", ")}</p>
                      )}
                      {s.final_grade && <p className="text-xs font-medium text-success">Note finale : {s.final_grade}/20</p>}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="videos">
          {withVideo.length === 0 ? (
            <div className="text-center py-12">
              <Video className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Aucune vidéo de soutenance disponible</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {withVideo.map((s: any) => {
                const student = profileMap.get(s.student_id);
                return (
                  <motion.div key={s.id} variants={item}>
                    <Card className="glass-card border-border/50 overflow-hidden">
                      <div className="relative">
                        <video
                          src={s.video_url}
                          controls
                          className="w-full aspect-video object-cover"
                          poster=""
                        />
                      </div>
                      <CardContent className="p-4 space-y-1">
                        <h3 className="text-sm font-semibold text-foreground">{s.title}</h3>
                        <p className="text-xs text-muted-foreground">
                          {student ? `${student.first_name} ${student.last_name}` : "—"} · {(s as any).filieres?.name || ""} · {s.level}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(s.soutenance_date), "dd MMMM yyyy", { locale: fr })}
                        </p>
                        {s.final_grade && <p className="text-xs font-medium text-success">Note : {s.final_grade}/20</p>}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default StudentSoutenancesPage;
