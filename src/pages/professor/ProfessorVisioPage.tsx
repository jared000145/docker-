import { motion } from "framer-motion";
import { Video, Plus, ExternalLink, StopCircle, Users, Clock, BookOpen, Sparkles, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";

const generateJitsiUrl = (subjectName?: string) => {
  const slug = (subjectName || "Cours")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 20) || "Cours";
  const random = Math.random().toString(36).slice(2, 10);
  return `https://meet.jit.si/Rectorplus-${slug}-${random}`;
};

const ProfessorVisioPage = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  useRealtimeSubscription("video_conferences", [["prof-conferences"]]);

  const { data: subjects = [] } = useQuery({
    queryKey: ["prof-subjects-visio", profile?.first_name, profile?.last_name, profile?.institution_id],
    queryFn: async () => {
      const fullName = `${profile?.first_name} ${profile?.last_name}`.trim();
      let q = supabase.from("subjects").select("*, filieres(name)").ilike("professor", `%${fullName}%`).order("name");
      if (profile?.institution_id) q = q.eq("institution_id", profile.institution_id);
      const { data } = await q;
      return data || [];
    },
    enabled: !!profile,
  });

  const { data: conferences = [], isLoading } = useQuery({
    queryKey: ["prof-conferences", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("video_conferences")
        .select("*, filieres(name)")
        .eq("professor_id", user!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const subject = subjects.find((s: any) => s.id === selectedSubject);
      if (!subject) throw new Error("Veuillez sélectionner une matière");
      if (!meetingUrl.trim()) throw new Error("Veuillez entrer un lien de réunion");
      if (!title.trim()) throw new Error("Veuillez entrer un titre");

      const { error } = await supabase.from("video_conferences").insert({
        professor_id: user!.id,
        title: title.trim(),
        meeting_url: meetingUrl.trim(),
        filiere_id: subject.filiere_id,
        level: subject.level,
        institution_id: profile?.institution_id,
        status: "active",
      });
      if (error) throw error;

      // Notify students of this filiere/level
      const { data: students } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("institution_id", profile?.institution_id)
        .eq("filiere_id", subject.filiere_id)
        .eq("level", subject.level);

      if (students && students.length > 0) {
        const notifications = students.map((s: any) => ({
          user_id: s.user_id,
          title: "🎥 Cours en direct",
          message: `${profile?.first_name} ${profile?.last_name} a lancé "${title.trim()}". Cliquez pour rejoindre !`,
          type: "visio",
          institution_id: profile?.institution_id,
        }));
        await supabase.from("notifications").insert(notifications);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prof-conferences"] });
      setOpen(false);
      setTitle("");
      setMeetingUrl("");
      setSelectedSubject("");
      toast.success("Visioconférence lancée ! Les étudiants ont été notifiés.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const endMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("video_conferences").update({ status: "ended" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["prof-conferences"] });
      toast.success("Visioconférence terminée.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const activeConfs = conferences.filter((c: any) => c.status === "active");
  const pastConfs = conferences.filter((c: any) => c.status === "ended");

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
            <Video className="w-6 h-6 text-accent" /> Visioconférence
          </h1>
          <p className="text-muted-foreground mt-1">Lancez un cours en direct pour vos étudiants</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Lancer une visio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle visioconférence</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Matière concernée</Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger><SelectValue placeholder="Choisir une matière" /></SelectTrigger>
                  <SelectContent>
                    {subjects.map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({(s as any).filieres?.name} · {s.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Titre du cours</Label>
                <Input placeholder="Ex: Cours de Mathématiques - Chapitre 5" value={title} onChange={e => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Lien de la réunion</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 text-xs text-accent hover:text-accent"
                    onClick={() => {
                      const subject = subjects.find((s: any) => s.id === selectedSubject);
                      const url = generateJitsiUrl(subject?.name || title);
                      setMeetingUrl(url);
                      toast.success("Lien Jitsi généré automatiquement");
                    }}
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Générer auto
                  </Button>
                </div>
                <div className="relative">
                  <Input
                    placeholder="Cliquez sur 'Générer auto' ou collez un lien Zoom/Meet/Teams"
                    value={meetingUrl}
                    onChange={e => setMeetingUrl(e.target.value)}
                    className="pr-10"
                  />
                  {meetingUrl && (
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(meetingUrl); toast.success("Lien copié"); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-secondary rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      title="Copier le lien"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  💡 Le bouton « Générer auto » crée instantanément une salle Jitsi Meet sécurisée — aucun compte requis.
                </p>
              </div>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="w-full gap-2">
                <Video className="w-4 h-4" />
                {createMutation.isPending ? "Lancement..." : "Lancer la visioconférence"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Active conferences */}
      {activeConfs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            En cours
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {activeConfs.map((c: any) => (
              <Card key={c.id} className="glass-card border-green-500/30 overflow-hidden">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <h3 className="font-semibold text-foreground">{c.title}</h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          <BookOpen className="w-3 h-3 mr-1" />
                          {(c as any).filieres?.name || "—"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">{c.level}</Badge>
                      </div>
                    </div>
                    <Badge className="bg-green-500/10 text-green-500 border-green-500/30">En direct</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Lancée le {new Date(c.created_at).toLocaleDateString("fr-FR")} à {new Date(c.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-2" onClick={() => window.open(c.meeting_url, "_blank")}>
                      <ExternalLink className="w-3.5 h-3.5" /> Rejoindre
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-2" onClick={() => endMutation.mutate(c.id)} disabled={endMutation.isPending}>
                      <StopCircle className="w-3.5 h-3.5" /> Terminer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* No active */}
      {activeConfs.length === 0 && !isLoading && (
        <Card className="glass-card border-border/50">
          <CardContent className="p-10 text-center space-y-3">
            <Video className="w-12 h-12 text-muted-foreground/40 mx-auto" />
            <p className="text-muted-foreground">Aucune visioconférence en cours. Cliquez sur "Lancer une visio" pour commencer.</p>
          </CardContent>
        </Card>
      )}

      {/* Past conferences */}
      {pastConfs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-muted-foreground">Historique</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pastConfs.slice(0, 9).map((c: any) => (
              <Card key={c.id} className="glass-card border-border/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium text-foreground truncate">{c.title}</h3>
                    <Badge variant="outline" className="text-xs text-muted-foreground">Terminée</Badge>
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

export default ProfessorVisioPage;
