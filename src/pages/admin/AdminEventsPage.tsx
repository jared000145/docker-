import {useCampus} from '@/hooks/useCampus';
import { motion } from "framer-motion";
import { CalendarDays, Plus, Trash2, Upload, Image, Video } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const EVENT_TYPES = [
  { value: "general", label: "📢 Général" },
  { value: "soutenance", label: "🎓 Soutenance" },
  { value: "conference", label: "🎤 Conférence" },
  { value: "competition", label: "🏆 Compétition" },
  { value: "portes_ouvertes", label: "🏫 Portes ouvertes" },
  { value: "seminaire", label: "📚 Séminaire" },
];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const AdminEventsPage = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newEvent, setNewEvent] = useState({ title: "", description: "", event_type: "general", event_date: "", location: "", image_url: "", video_url: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useRealtimeSubscription("events", [["admin-events"]]);

  const { profile } = useAuth();
  const instId = profile?.institution_id;
  const {campusId}=useCampus();

  const { data: events = [] } = useQuery({
    queryKey: ["admin-events", instId,campusId],
    queryFn: async () => {
      let q = supabase.from("events").select("*").order("event_date", { ascending: false });
      if (instId) q = q.eq("institution_id", instId);
      if(campusId)q=q.or(`campus_id.eq.${campusId},campus_id.is.null`);
      const { data,error } = await q;
      if(error)throw error;
      return data || [];
    },
    enabled: !!instId,
  });

  const uploadFile = async (file: File, folder: string) => {
    const ext = file.name.split(".").pop();
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("event-media").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("event-media").getPublicUrl(path);
    return data.publicUrl;
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let imageUrl = newEvent.image_url;
      let videoUrl = newEvent.video_url;

      if (imageFile) {
        imageUrl = await uploadFile(imageFile, "images");
      }
      if (videoFile) {
        videoUrl = await uploadFile(videoFile, "videos");
      }

      const { error } = await supabase.from("events").insert({
        title: newEvent.title,
        description: newEvent.description,
        event_type: newEvent.event_type,
        event_date: new Date(newEvent.event_date).toISOString(),
        location: newEvent.location,
        image_url: imageUrl || null,
        video_url: videoUrl || null,
        created_by: user!.id,
        institution_id: instId || null,
        campus_id:campusId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      setNewEvent({ title: "", description: "", event_type: "general", event_date: "", location: "", image_url: "", video_url: "" });
      setImageFile(null);
      setVideoFile(null);
      setCreateOpen(false);
      setUploading(false);
      toast.success("Événement créé !");
    },
    onError: (e: any) => { setUploading(false); toast.error(e.message); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Événement supprimé");
    },
  });

  const isVideoUrl = (url: string) => {
    if (!url) return false;
    return url.includes("youtube") || url.includes("youtu.be") || url.match(/\.(mp4|webm|ogg)$/i);
  };

  const getYouTubeEmbedUrl = (url: string) => {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Événements</h1>
          <p className="text-muted-foreground mt-1">{events.length} événement(s)</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-gold text-accent-foreground gap-2"><Plus className="w-4 h-4" /> Publier</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nouvel événement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Titre *</Label>
                <Input value={newEvent.title} onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Type</Label>
                <Select value={newEvent.event_type} onValueChange={(v) => setNewEvent({ ...newEvent, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date et heure *</Label>
                  <Input type="datetime-local" value={newEvent.event_date} onChange={(e) => setNewEvent({ ...newEvent, event_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Lieu</Label>
                  <Input value={newEvent.location} onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea value={newEvent.description} onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })} rows={3} />
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Image className="w-3.5 h-3.5" /> Photo</Label>
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setImageFile(e.target.files[0]); }} />
                <div className="flex gap-2 items-center">
                  <Button type="button" variant="outline" size="sm" onClick={() => imageInputRef.current?.click()} className="gap-1">
                    <Upload className="w-3.5 h-3.5" /> {imageFile ? "Changer" : "Uploader une photo"}
                  </Button>
                  {imageFile && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{imageFile.name}</span>}
                </div>
                {!imageFile && (
                  <Input placeholder="Ou collez une URL d'image..." value={newEvent.image_url} onChange={(e) => setNewEvent({ ...newEvent, image_url: e.target.value })} className="text-xs" />
                )}
                {imageFile && (
                  <img src={URL.createObjectURL(imageFile)} alt="Aperçu de l'image de l'événement" decoding="async" className="w-full h-32 object-cover rounded-lg" />
                )}
              </div>

              {/* Video upload */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Video className="w-3.5 h-3.5" /> Vidéo</Label>
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) setVideoFile(e.target.files[0]); }} />
                <div className="flex gap-2 items-center">
                  <Button type="button" variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} className="gap-1">
                    <Upload className="w-3.5 h-3.5" /> {videoFile ? "Changer" : "Uploader une vidéo"}
                  </Button>
                  {videoFile && <span className="text-xs text-muted-foreground truncate max-w-[200px]">{videoFile.name}</span>}
                </div>
                {!videoFile && (
                  <Input placeholder="Ou collez un lien YouTube..." value={newEvent.video_url} onChange={(e) => setNewEvent({ ...newEvent, video_url: e.target.value })} className="text-xs" />
                )}
              </div>

              <Button onClick={() => createMutation.mutate()} disabled={!newEvent.title || !newEvent.event_date || createMutation.isPending || uploading} className="w-full gradient-gold text-accent-foreground">
                {uploading ? "Upload en cours..." : createMutation.isPending ? "Création..." : "Publier l'événement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {events.map((e: any) => (
          <motion.div key={e.id} variants={item}>
            <Card className="glass-card border-border/50 hover:border-accent/30 transition-all overflow-hidden">
              {e.image_url && <img src={e.image_url} alt={e.title} loading="lazy" decoding="async" className="w-full max-h-80 object-contain bg-secondary/30" />}
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full">
                      {EVENT_TYPES.find((t) => t.value === e.event_type)?.label || e.event_type}
                    </span>
                    <h3 className="text-base font-semibold text-foreground mt-1">{e.title}</h3>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(e.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{e.description?.slice(0, 100)}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {format(new Date(e.event_date), "dd MMMM yyyy · HH:mm", { locale: fr })}
                </div>
                {e.location && <p className="text-xs text-muted-foreground">📍 {e.location}</p>}
                {e.video_url && (() => {
                  const embedUrl = getYouTubeEmbedUrl(e.video_url);
                  if (embedUrl) {
                    return <iframe src={embedUrl} className="w-full h-36 rounded-lg" allowFullScreen />;
                  }
                  if (e.video_url.match(/\.(mp4|webm|ogg)$/i) || e.video_url.includes("event-media")) {
                    return <video src={e.video_url} controls className="w-full h-36 rounded-lg object-cover" />;
                  }
                  return <a href={e.video_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent hover:underline">▶️ Voir la vidéo</a>;
                })()}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default AdminEventsPage;
