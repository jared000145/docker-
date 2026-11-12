import {PrivateMediaImage} from "@/components/PrivateMediaImage";
import { motion } from "framer-motion";
import { Users, Plus, Trash2, ImagePlus, Crown, Upload, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const initials = (first?: string, last?: string) => `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "B";

const AdminBDEPage = () => {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const { selectedYear } = useAcademicYear();
  const [postOpen, setPostOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [newPost, setNewPost] = useState({ title: "", content: "" });
  const [memberForm, setMemberForm] = useState({ user_id: "", role: "membre", title: "", bio: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const instId = profile?.institution_id;

  const { data: institution } = useQuery({
    queryKey: ["bde-institution", instId],
    queryFn: async () => {
      if (!instId) return null;
      const { data } = await (supabase as any).from("institutions").select("id, name, bde_logo_url").eq("id", instId).maybeSingle();
      return data;
    },
    enabled: !!instId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["bde-members", selectedYear],
    queryFn: async () => {
      const { data } = await supabase.from("bde_members").select("*").eq("academic_year", selectedYear).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["bde-posts"],
    queryFn: async () => {
      const { data } = await supabase.from("bde_posts").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["bde-student-profiles", instId],
    queryFn: async () => {
      const { data: studentRoles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      if (!studentRoles?.length) return [];
      let q = supabase.from("profiles").select("user_id, first_name, last_name, avatar_url, filiere_id, level, student_number").in("user_id", studentRoles.map((r: any) => r.user_id));
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q.order("last_name");
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["bde-filieres", instId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("id, name").order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));
  const filiereMap = new Map(filieres.map((f: any) => [f.id, f.name]));
  const visibleMembers = members.filter((m: any) => profileMap.has(m.user_id));
  const visiblePosts = posts.filter((p: any) => profileMap.has(p.author_id));
  const memberIds = new Set(visibleMembers.map((m: any) => m.user_id));
  const availableStudents = profiles.filter((p: any) => !memberIds.has(p.user_id));
  const isCurrentUserMember = user ? memberIds.has(user.id) : false;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!user || !instId) throw new Error("Compte administrateur introuvable");
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/bde-logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
      const { error } = await (supabase as any).from("institutions").update({ bde_logo_url: urlData.publicUrl }).eq("id", instId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bde-institution"] }); toast.success("Logo BDE mis à jour"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bde_members").insert({ ...memberForm, academic_year: selectedYear });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bde-members"] });
      setMemberOpen(false);
      setMemberForm({ user_id: "", role: "membre", title: "", bio: "" });
      toast.success("Membre BDE ajouté");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bde_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bde-members"] }); toast.success("Membre retiré"); },
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || !isCurrentUserMember) throw new Error("Seuls les membres BDE peuvent publier");
      let imageUrl: string | null = null;
      if (selectedFile) {
        const ext = selectedFile.name.split(".").pop();
        const path = `${authUser.id}/bde/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, selectedFile);
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("media").getPublicUrl(path);
        imageUrl = urlData.publicUrl;
      }
      const { error } = await supabase.from("bde_posts").insert({ ...newPost, image_url: imageUrl, author_id: authUser.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bde-posts"] });
      setPostOpen(false); setNewPost({ title: "", content: "" }); setSelectedFile(null); setPreviewUrl(null);
      toast.success("Publication BDE créée !");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bde_posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bde-posts"] }); toast.success("Supprimée"); },
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {institution?.bde_logo_url ? (
            <PrivateMediaImage src={institution.bde_logo_url} alt="Logo BDE" className="h-14 w-14 rounded-2xl object-cover border border-border shadow-sm" />
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-border">
              <Users className="w-7 h-7 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">Bureau Des Étudiants</h1>
            <p className="text-sm text-muted-foreground">Membres, logo et publications officielles</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadLogo.mutate(e.target.files[0])} />
          <Button variant="outline" className="gap-2" onClick={() => logoRef.current?.click()} disabled={uploadLogo.isPending}>
            <Upload className="w-4 h-4" /> Logo BDE
          </Button>
          <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
            <DialogTrigger asChild><Button variant="outline" className="gap-2"><BadgeCheck className="w-4 h-4" /> Ajouter membre</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Ajouter un membre BDE</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Select value={memberForm.user_id} onValueChange={(v) => setMemberForm({ ...memberForm, user_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Choisir un étudiant" /></SelectTrigger>
                  <SelectContent>
                    {availableStudents.map((s: any) => <SelectItem key={s.user_id} value={s.user_id}>{s.first_name} {s.last_name} {s.level ? `• ${s.level}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={memberForm.role} onValueChange={(v) => setMemberForm({ ...memberForm, role: v, title: v === "president" ? "Président" : memberForm.title })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="president">Président</SelectItem>
                    <SelectItem value="vice_president">Vice-président</SelectItem>
                    <SelectItem value="secretaire">Secrétaire</SelectItem>
                    <SelectItem value="tresorier">Trésorier</SelectItem>
                    <SelectItem value="membre">Membre</SelectItem>
                  </SelectContent>
                </Select>
                <Input placeholder="Poste affiché" value={memberForm.title} onChange={(e) => setMemberForm({ ...memberForm, title: e.target.value })} />
                <Textarea placeholder="Bio / mission" value={memberForm.bio} onChange={(e) => setMemberForm({ ...memberForm, bio: e.target.value })} />
                <Button onClick={() => addMember.mutate()} disabled={!memberForm.user_id || addMember.isPending} className="w-full">Ajouter</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={postOpen} onOpenChange={setPostOpen}>
            <DialogTrigger asChild><Button className="gap-2" disabled={!isCurrentUserMember}><Plus className="w-4 h-4" /> Publier</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvelle publication BDE</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Titre" value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} />
                <Textarea placeholder="Contenu *" value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} rows={4} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1"><ImagePlus className="w-4 h-4" /> {selectedFile ? selectedFile.name : "Ajouter une image"}</Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                {previewUrl && <PrivateMediaImage src={previewUrl} alt="Aperçu" className="rounded-lg w-full max-h-40 object-cover" />}
                <Button onClick={() => postMutation.mutate()} disabled={!newPost.content || postMutation.isPending} className="w-full">
                  {postMutation.isPending ? "Publication..." : "Publier"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="glass-card border-border/50">
        <CardHeader><CardTitle className="text-base">Membres du BDE</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {visibleMembers.length === 0 && <p className="text-sm text-muted-foreground">Aucun membre ajouté.</p>}
          {visibleMembers.map((m: any) => {
            const p = profileMap.get(m.user_id);
            return (
              <div key={m.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <Avatar className="h-11 w-11"><AvatarImage src={p?.avatar_url || m.photo_url || undefined} /><AvatarFallback>{initials(p?.first_name, p?.last_name)}</AvatarFallback></Avatar>
                <div className="min-w-0">
                  <p className="font-medium text-sm text-foreground truncate">{p ? `${p.first_name} ${p.last_name}` : "Étudiant"}</p>
                  <p className="text-xs text-muted-foreground">{m.title || m.role}</p>
                  <p className="text-[11px] text-muted-foreground">{p?.level || "—"} • {filiereMap.get(p?.filiere_id) || "Filière"}</p>
                </div>
                {m.role === "president" && <Crown className="w-4 h-4 text-accent" />}
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMember.mutate(m.id)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {visiblePosts.map((p: any) => {
          const author = profileMap.get(p.author_id);
          return (
            <Card key={p.id} className="glass-card border-border/50">
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between gap-3">
                  <div>
                    {p.title && <h3 className="text-sm font-semibold text-foreground">{p.title}</h3>}
                    <p className="text-xs text-muted-foreground">{author ? `${author.first_name} ${author.last_name}` : "BDE"} · {format(new Date(p.created_at), "dd/MM/yyyy", { locale: fr })}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deletePost.mutate(p.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{p.content}</p>
                {p.image_url && <PrivateMediaImage src={p.image_url} alt="Publication BDE" className="rounded-lg w-full max-h-96 object-contain bg-secondary/30" />}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </motion.div>
  );
};

export default AdminBDEPage;
