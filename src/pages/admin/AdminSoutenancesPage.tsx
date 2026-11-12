import { motion } from "framer-motion";
import { GraduationCap, Plus, Video, Trash2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const AdminSoutenancesPage = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const { getLevels } = useInstitution();
  const LEVELS = getLevels();
  const instId = profile?.institution_id;
  const [createOpen, setCreateOpen] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const currentYear = new Date().getFullYear();
  const [newS, setNewS] = useState({ student_id: "", title: "", subject: "", soutenance_date: "", location: "", filiere_id: "", level: "L3", video_url: "", academic_year: `${currentYear}-${currentYear + 1}` });
  const [juryList, setJuryList] = useState<{ name: string; role: string }[]>([{ name: "", role: "president" }]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [videoSoutenanceId, setVideoSoutenanceId] = useState("");
  const [uploading, setUploading] = useState(false);
  const videoRef = useRef<HTMLInputElement>(null);

  const { data: filieres = [] } = useQuery({
    queryKey: ["filieres", instId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: students = [] } = useQuery({
    queryKey: ["students-for-sout", newS.filiere_id, newS.level, instId],
    queryFn: async () => {
      const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!studentRoles || studentRoles.length === 0) return [];
      const ids = studentRoles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("*").in("user_id", ids);
      if (instId) q = q.eq("institution_id", instId);
      if (newS.filiere_id) q = q.eq("filiere_id", newS.filiere_id);
      if (newS.level) q = q.eq("level", newS.level);
      const { data } = await q.order("last_name");
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: soutenances = [] } = useQuery({
    queryKey: ["admin-soutenances", instId],
    queryFn: async () => {
      let q = supabase.from("soutenances").select("*, filieres(name), soutenance_jury(*)").order("soutenance_date", { ascending: false });
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles-sout", instId],
    queryFn: async () => {
      let q = supabase.from("profiles").select("user_id, first_name, last_name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
  });
  const profileMap = new Map(allProfiles.map((p: any) => [p.user_id, p]));

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("soutenances").insert({
        ...newS,
        soutenance_date: new Date(newS.soutenance_date).toISOString(),
        institution_id: instId || null,
      }).select().single();
      if (error) throw error;
      const juryInserts = juryList.filter((j) => j.name).map((j) => ({ soutenance_id: data.id, professor_name: j.name, role: j.role }));
      if (juryInserts.length > 0) {
        const { error: jErr } = await supabase.from("soutenance_jury").insert(juryInserts);
        if (jErr) throw jErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-soutenances"] });
      setCreateOpen(false);
      toast.success("Soutenance programmée !");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await supabase.from("soutenances").delete().eq("id", id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-soutenances"] }); toast.success("Supprimée"); },
  });

  const uploadVideoMutation = useMutation({
    mutationFn: async () => {
      setUploading(true);
      let videoUrl = "";
      if (videoFile) {
        const ext = videoFile.name.split(".").pop();
        const path = `${profile!.user_id}/soutenances/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, videoFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
        videoUrl = urlData.publicUrl;
      }
      if (!videoUrl) throw new Error("Aucune vidéo sélectionnée");
      const { error } = await supabase.from("soutenances").update({ video_url: videoUrl }).eq("id", videoSoutenanceId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-soutenances"] });
      setVideoOpen(false);
      setVideoFile(null);
      setVideoTitle("");
      setVideoSoutenanceId("");
      setUploading(false);
      toast.success("Vidéo publiée !");
    },
    onError: (e: any) => { setUploading(false); toast.error(e.message); },
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Soutenances</h1>
          <p className="text-muted-foreground mt-1">{soutenances.length} soutenance(s)</p>
        </div>
        <div className="flex gap-2">
          {/* Upload Video Dialog */}
          <Dialog open={videoOpen} onOpenChange={setVideoOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2"><Video className="w-4 h-4" /> Publier une vidéo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Publier une vidéo de soutenance</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <Select value={videoSoutenanceId} onValueChange={setVideoSoutenanceId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner la soutenance" /></SelectTrigger>
                  <SelectContent>
                    {soutenances.map((s: any) => {
                      const student = profileMap.get(s.student_id);
                      return (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title} — {student ? `${student.first_name} ${student.last_name}` : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <div>
                  <input ref={videoRef} type="file" accept="video/*" className="hidden" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
                  <Button variant="outline" className="w-full gap-2" onClick={() => videoRef.current?.click()}>
                    <Upload className="w-4 h-4" /> {videoFile ? videoFile.name : "Choisir une vidéo"}
                  </Button>
                </div>
                <Button
                  onClick={() => uploadVideoMutation.mutate()}
                  disabled={!videoSoutenanceId || !videoFile || uploading}
                  className="w-full gradient-gold text-accent-foreground"
                >
                  {uploading ? "Publication..." : "Publier"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button className="gradient-gold text-accent-foreground gap-2"><Plus className="w-4 h-4" /> Programmer</Button></DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Programmer une soutenance</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Filière</Label>
                    <Select value={newS.filiere_id} onValueChange={(v) => setNewS({ ...newS, filiere_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                      <SelectContent>{filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Niveau</Label>
                    <Select value={newS.level} onValueChange={(v) => setNewS({ ...newS, level: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Étudiant *</Label>
                  <Select value={newS.student_id} onValueChange={(v) => setNewS({ ...newS, student_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>{students.map((s: any) => <SelectItem key={s.user_id} value={s.user_id}>{s.first_name} {s.last_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input placeholder="Titre du mémoire *" value={newS.title} onChange={(e) => setNewS({ ...newS, title: e.target.value })} />
                <Input placeholder="Sujet" value={newS.subject} onChange={(e) => setNewS({ ...newS, subject: e.target.value })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input type="datetime-local" value={newS.soutenance_date} onChange={(e) => setNewS({ ...newS, soutenance_date: e.target.value })} />
                  <Input placeholder="Salle" value={newS.location} onChange={(e) => setNewS({ ...newS, location: e.target.value })} />
                </div>
                <div>
                  <Label className="text-xs">Jury</Label>
                  {juryList.map((j, i) => (
                    <div key={i} className="flex gap-2 mt-1">
                      <Input placeholder="Nom du membre" value={j.name} onChange={(e) => { const l = [...juryList]; l[i].name = e.target.value; setJuryList(l); }} className="flex-1" />
                      <Select value={j.role} onValueChange={(v) => { const l = [...juryList]; l[i].role = v; setJuryList(l); }}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="president">Président</SelectItem>
                          <SelectItem value="rapporteur">Rapporteur</SelectItem>
                          <SelectItem value="directeur">Directeur</SelectItem>
                          <SelectItem value="membre">Membre</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => setJuryList([...juryList, { name: "", role: "membre" }])} className="mt-1 text-xs text-accent">+ Ajouter un membre</Button>
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={!newS.student_id || !newS.title || !newS.soutenance_date || createMutation.isPending} className="w-full gradient-gold text-accent-foreground">
                  {createMutation.isPending ? "Création..." : "Programmer"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {soutenances.map((s: any) => {
          const student = profileMap.get(s.student_id);
          return (
            <Card key={s.id} className="glass-card border-border/50 hover:border-accent/30 transition-all">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === "terminee" ? "bg-success/15 text-success" : "bg-accent/15 text-accent"}`}>{s.status}</span>
                    <h3 className="text-sm font-semibold text-foreground mt-1">🎓 {s.title}</h3>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(s.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(s.soutenance_date), "dd MMMM yyyy · HH:mm", { locale: fr })} · {s.location || "—"}
                </p>
                <p className="text-xs text-foreground">Étudiant : {student ? `${student.first_name} ${student.last_name}` : "—"}</p>
                {s.soutenance_jury?.length > 0 && (
                  <p className="text-xs text-muted-foreground">Jury : {s.soutenance_jury.map((j: any) => `${j.professor_name} (${j.role})`).join(", ")}</p>
                )}
                {s.video_url && (
                  <div className="mt-2">
                    <video src={s.video_url} controls className="w-full rounded-lg max-h-48" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
};

export default AdminSoutenancesPage;
