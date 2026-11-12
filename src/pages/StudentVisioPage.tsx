import { motion } from "framer-motion";
import { Video, ExternalLink, Clock, BookOpen, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

const StudentVisioPage = () => {
  const { profile } = useAuth();

  useRealtimeSubscription("video_conferences", [["student-conferences"]]);

  // Fetch conferences for student's filiere/level
  const { data: conferences = [], isLoading } = useQuery({
    queryKey: ["student-conferences", profile?.institution_id, profile?.filiere_id, profile?.level],
    queryFn: async () => {
      if (!profile?.institution_id || !profile?.filiere_id) return [];
      const q = supabase
        .from("video_conferences")
        .select("*, filieres(name)")
        .eq("institution_id", profile.institution_id)
        .eq("filiere_id", profile.filiere_id)
        .eq("level", profile.level)
        .order("created_at", { ascending: false });
      const { data } = await q;
      return data || [];
    },
    enabled: !!profile?.institution_id && !!profile?.filiere_id,
  });

  // Get professor names
  const professorIds = [...new Set(conferences.map((c: any) => c.professor_id))];
  const { data: professors = [] } = useQuery({
    queryKey: ["visio-professors", professorIds],
    queryFn: async () => {
      if (professorIds.length === 0) return [];
      const { data } = await supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", professorIds);
      return data || [];
    },
    enabled: professorIds.length > 0,
  });
  const profMap = new Map(professors.map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`]));

  const activeConfs = conferences.filter((c: any) => c.status === "active");
  const pastConfs = conferences.filter((c: any) => c.status === "ended");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
          <Video className="w-6 h-6 text-accent" /> Cours en visio
        </h1>
        <p className="text-muted-foreground mt-1">Rejoignez les cours en direct de vos professeurs</p>
      </div>

      {/* Active conferences */}
      {activeConfs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            En direct maintenant
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeConfs.map((c: any) => (
              <motion.div key={c.id} initial={{ scale: 0.95 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                <Card className="glass-card border-green-500/30 overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1.5">
                        <h3 className="font-semibold text-foreground text-lg">{c.title}</h3>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-xs gap-1">
                            <BookOpen className="w-3 h-3" />
                            {(c as any).filieres?.name || "—"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">{c.level}</Badge>
                        </div>
                      </div>
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/30 animate-pulse">
                        🔴 En direct
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5" />
                        <span>{profMap.get(c.professor_id) || "Professeur"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Lancée à {new Date(c.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                    <Button className="w-full gap-2" onClick={() => window.open(c.meeting_url, "_blank")}>
                      <ExternalLink className="w-4 h-4" /> Rejoindre le cours
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* No active */}
      {activeConfs.length === 0 && !isLoading && (
        <Card className="glass-card border-border/50">
          <CardContent className="p-12 text-center space-y-4">
            <div className="relative mx-auto w-20 h-20">
              <div className="w-20 h-20 rounded-full bg-secondary/50 flex items-center justify-center">
                <Video className="w-8 h-8 text-muted-foreground/50" />
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-foreground">Aucun cours en direct</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Il n'y a pas de visioconférence en cours pour votre filière. Vous recevrez une notification dès qu'un professeur lancera un cours.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past conferences */}
      {pastConfs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Cours passés</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pastConfs.slice(0, 12).map((c: any) => (
              <Card key={c.id} className="glass-card border-border/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground truncate">{c.title}</h3>
                    <Badge variant="outline" className="text-xs text-muted-foreground shrink-0">Terminée</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="w-3 h-3" />
                    <span>{profMap.get(c.professor_id) || "Professeur"}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("fr-FR")} à {new Date(c.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default StudentVisioPage;
