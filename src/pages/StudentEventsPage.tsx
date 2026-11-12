import { motion } from "framer-motion";
import { CalendarDays, Heart, MessageCircle, UserPlus, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 200 } } };

const getYouTubeEmbedUrl = (url: string) => {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
};

const StudentEventsPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});

  useRealtimeSubscription("events", [["student-events"]]);
  useRealtimeSubscription("event_comments", [["all-event-comments"]]);

  const { data: events = [] } = useQuery({
    queryKey: ["student-events"],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("*").order("event_date", { ascending: false });
      return data || [];
    },
  });

  const { data: likes = [] } = useQuery({
    queryKey: ["event-likes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("event_likes").select("event_id").eq("user_id", user!.id);
      return data?.map((l: any) => l.event_id) || [];
    },
    enabled: !!user,
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["event-regs", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("event_registrations").select("event_id").eq("user_id", user!.id);
      return data?.map((r: any) => r.event_id) || [];
    },
    enabled: !!user,
  });

  const { data: allComments = [] } = useQuery({
    queryKey: ["all-event-comments"],
    queryFn: async () => {
      const { data } = await supabase.from("event_comments").select("*").order("created_at", { ascending: true });
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-comments"],
    queryFn: async () => { const { data } = await supabase.from("profiles").select("user_id, first_name, last_name"); return data || []; },
  });
  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));

  const likeMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (likes.includes(eventId)) {
        await supabase.from("event_likes").delete().eq("event_id", eventId).eq("user_id", user!.id);
      } else {
        await supabase.from("event_likes").insert({ event_id: eventId, user_id: user!.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event-likes"] }),
  });

  const registerMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (registrations.includes(eventId)) {
        await supabase.from("event_registrations").delete().eq("event_id", eventId).eq("user_id", user!.id);
      } else {
        await supabase.from("event_registrations").insert({ event_id: eventId, user_id: user!.id });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["event-regs"] }); toast.success("Inscription mise à jour !"); },
  });

  const commentMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const text = commentText[eventId];
      if (!text) return;
      await supabase.from("event_comments").insert({ event_id: eventId, user_id: user!.id, content: text });
    },
    onSuccess: (_, eventId) => {
      qc.invalidateQueries({ queryKey: ["all-event-comments"] });
      setCommentText({ ...commentText, [eventId]: "" });
    },
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl font-heading font-bold text-foreground">📅 Événements</h1>
        <p className="text-muted-foreground mt-1">Découvrez les activités de l'université</p>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        {events.map((e: any) => {
          const isLiked = likes.includes(e.id);
          const isRegistered = registrations.includes(e.id);
          const comments = allComments.filter((c: any) => c.event_id === e.id);
          const showC = showComments[e.id];
          return (
            <motion.div key={e.id} variants={item}>
              <Card className="glass-card border-border/50 overflow-hidden hover:shadow-lg transition-shadow">
                {e.image_url && <img src={e.image_url} alt={e.title} loading="lazy" decoding="async" className="w-full max-h-80 object-contain bg-secondary/30" />}
                <CardContent className="p-4 space-y-3">
                  <div>
                    <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full">{e.event_type}</span>
                    <h3 className="text-lg font-semibold text-foreground mt-1">{e.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{e.description?.slice(0, 150)}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CalendarDays className="w-3.5 h-3.5" />
                    {format(new Date(e.event_date), "EEEE dd MMMM yyyy · HH:mm", { locale: fr })}
                  </div>
                  {e.location && <p className="text-xs text-muted-foreground">📍 {e.location}</p>}
                  
                  {/* Video display */}
                  {e.video_url && (() => {
                    const embedUrl = getYouTubeEmbedUrl(e.video_url);
                    if (embedUrl) {
                      return <iframe src={embedUrl} className="w-full h-40 rounded-lg" allowFullScreen />;
                    }
                    if (e.video_url.match(/\.(mp4|webm|ogg)$/i) || e.video_url.includes("event-media")) {
                      return <video src={e.video_url} controls className="w-full h-40 rounded-lg object-cover" />;
                    }
                    return <a href={e.video_url} target="_blank" className="text-xs text-accent hover:underline">▶️ Voir la vidéo</a>;
                  })()}

                  <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                    <Button variant="ghost" size="sm" onClick={() => likeMutation.mutate(e.id)} className={isLiked ? "text-destructive" : "text-muted-foreground"}>
                      <Heart className={`w-4 h-4 mr-1 ${isLiked ? "fill-current" : ""}`} /> J'aime
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setShowComments({ ...showComments, [e.id]: !showC })} className="text-muted-foreground">
                      <MessageCircle className="w-4 h-4 mr-1" /> {comments.length}
                    </Button>
                    <Button variant={isRegistered ? "secondary" : "ghost"} size="sm" onClick={() => registerMutation.mutate(e.id)} className={isRegistered ? "text-success" : "text-muted-foreground"}>
                      {isRegistered ? <Check className="w-4 h-4 mr-1" /> : <UserPlus className="w-4 h-4 mr-1" />}
                      {isRegistered ? "Inscrit" : "S'inscrire"}
                    </Button>
                  </div>

                  {showC && (
                    <div className="space-y-2 pt-2">
                      {comments.map((c: any) => {
                        const author = profileMap.get(c.user_id);
                        return (
                          <div key={c.id} className="p-2 rounded bg-secondary/30 text-xs">
                            <span className="font-medium text-foreground">{author ? `${author.first_name} ${author.last_name}` : "Anonyme"}</span>
                            <span className="text-muted-foreground ml-2">{c.content}</span>
                          </div>
                        );
                      })}
                      <div className="flex gap-2">
                        <Input placeholder="Commenter..." value={commentText[e.id] || ""} onChange={(ev) => setCommentText({ ...commentText, [e.id]: ev.target.value })} className="text-xs h-8" />
                        <Button size="sm" onClick={() => commentMutation.mutate(e.id)} disabled={!commentText[e.id]} className="h-8 text-xs">Envoyer</Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default StudentEventsPage;
