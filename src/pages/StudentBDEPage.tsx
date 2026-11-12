import { motion } from "framer-motion";
import { Users, Crown, Plus, ImagePlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useRef, useState } from "react";
import { toast } from "sonner";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.08 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 200 } } };
const initials = (first?: string, last?: string) => `${first?.[0] || ""}${last?.[0] || ""}`.toUpperCase() || "B";

const StudentBDEPage = () => {
  const { user, profile } = useAuth();
  const { selectedYear } = useAcademicYear();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [newPost, setNewPost] = useState({ title: "", content: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const { data: institution } = useQuery({
    queryKey: ["student-bde-institution", profile?.institution_id],
    queryFn: async () => {
      if (!profile?.institution_id) return null;
      const { data } = await (supabase as any).from("institutions").select("id, name, bde_logo_url").eq("id", profile.institution_id).maybeSingle();
      return data;
    },
    enabled: !!profile?.institution_id,
  });

  const { data: posts = [] } = useQuery({
    queryKey: ["student-bde-posts"],
    queryFn: async () => {
      const { data } = await supabase.from("bde_posts").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["student-bde-members", selectedYear],
    queryFn: async () => {
      const { data } = await supabase.from("bde_members").select("*").eq("academic_year", selectedYear).order("created_at");
      return data || [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-bde-students"],
    queryFn: async () => {
      const ids = Array.from(new Set([...members.map((m: any) => m.user_id), ...posts.map((p: any) => p.author_id)])).filter(Boolean);
      if (ids.length === 0) return [];
      let q = supabase.from("profiles").select("user_id, first_name, last_name, avatar_url, filiere_id, level, student_number").in("user_id", ids);
      if (profile?.institution_id) q = q.eq("institution_id", profile.institution_id);
      const { data } = await q;
      return data || [];
    },
    enabled: members.length > 0 || posts.length > 0,
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["student-bde-filieres", profile?.institution_id],
    queryFn: async () => {
      let q = supabase.from("filieres").select("id, name").order("name");
      if (profile?.institution_id) q = q.eq("institution_id", profile.institution_id);
      const { data } = await q;
      return data || [];
    },
    enabled: !!profile?.institution_id,
  });

  const profileMap = new Map(profiles.map((p: any) => [p.user_id, p]));
  const filiereMap = new Map(filieres.map((f: any) => [f.id, f.name]));
  const visibleMembers = members.filter((m: any) => profileMap.has(m.user_id));
  const visiblePosts = posts.filter((p: any) => profileMap.has(p.author_id));
  const memberIds = new Set(visibleMembers.map((m: any) => m.user_id));
  const isMember = user ? memberIds.has(user.id) : false;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const postMutation = useMutation({
    mutationFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser || !isMember) throw new Error("Seuls les membres du BDE peuvent publier");
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
      qc.invalidateQueries({ queryKey: ["student-bde-posts"] });
      setPostOpen(false); setNewPost({ title: "", content: "" }); setSelectedFile(null); setPreviewUrl(null);
      toast.success("Publication BDE créée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {institution?.bde_logo_url ? (
            <img src={institution.bde_logo_url} alt="Logo BDE" decoding="async" width={56} height={56} className="h-14 w-14 rounded-2xl object-cover border border-border shadow-sm" />
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-border">
              <Users className="w-7 h-7 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Bureau Des Étudiants</h1>
            <p className="text-muted-foreground mt-1">Actualités et activités officielles du BDE</p>
          </div>
        </div>
        {isMember && (
          <Dialog open={postOpen} onOpenChange={setPostOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="w-4 h-4" /> Publier</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nouvelle publication BDE</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Titre" value={newPost.title} onChange={(e) => setNewPost({ ...newPost, title: e.target.value })} />
                <Textarea placeholder="Contenu *" value={newPost.content} onChange={(e) => setNewPost({ ...newPost, content: e.target.value })} rows={4} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1"><ImagePlus className="w-4 h-4" /> {selectedFile ? selectedFile.name : "Ajouter une image"}</Button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
                {previewUrl && <img src={previewUrl} alt="Aperçu" decoding="async" className="rounded-lg w-full max-h-40 object-cover" />}
                <Button onClick={() => postMutation.mutate()} disabled={!newPost.content || postMutation.isPending} className="w-full">
                  {postMutation.isPending ? "Publication..." : "Publier"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </motion.div>

      {visibleMembers.length > 0 && (
        <motion.div variants={item}>
          <Card className="glass-card border-border/50">
            <CardHeader><CardTitle className="text-base">Membres du BDE</CardTitle></CardHeader>
            <CardContent className="flex gap-3 overflow-x-auto pb-4">
              {visibleMembers.map((m: any) => {
                const p = profileMap.get(m.user_id);
                return (
                  <button key={m.id} onClick={() => setSelectedMember({ ...m, profile: p })} className="group flex min-w-20 flex-col items-center gap-2 text-center">
                    <div className="relative">
                      <Avatar className="h-14 w-14 ring-2 ring-primary/20 group-hover:ring-primary/50 transition-all"><AvatarImage src={p?.avatar_url || m.photo_url || undefined} /><AvatarFallback>{initials(p?.first_name, p?.last_name)}</AvatarFallback></Avatar>
                      {m.role === "president" && <Crown className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-card p-0.5 text-accent" />}
                    </div>
                    <span className="text-xs font-medium text-foreground line-clamp-1">{p?.first_name || "Membre"}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Dialog open={!!selectedMember} onOpenChange={(open) => !open && setSelectedMember(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Détail du membre BDE</DialogTitle></DialogHeader>
          {selectedMember && (
            <div className="flex gap-4">
              <Avatar className="h-20 w-20"><AvatarImage src={selectedMember.profile?.avatar_url || selectedMember.photo_url || undefined} /><AvatarFallback>{initials(selectedMember.profile?.first_name, selectedMember.profile?.last_name)}</AvatarFallback></Avatar>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-foreground">{selectedMember.profile ? `${selectedMember.profile.first_name} ${selectedMember.profile.last_name}` : "Membre BDE"}</h3>
                <p className="text-sm text-primary font-medium">{selectedMember.title || selectedMember.role}</p>
                <p className="text-sm text-muted-foreground">{filiereMap.get(selectedMember.profile?.filiere_id) || "Filière non renseignée"}</p>
                <p className="text-sm text-muted-foreground">Niveau : {selectedMember.profile?.level || "—"}</p>
                {selectedMember.bio && <p className="text-sm text-foreground pt-2">{selectedMember.bio}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {visiblePosts.map((p: any) => {
          const author = profileMap.get(p.author_id);
          return (
            <motion.div key={p.id} variants={item}>
              <Card className="glass-card border-border/50 overflow-hidden">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10"><AvatarImage src={author?.avatar_url || undefined} /><AvatarFallback>{initials(author?.first_name, author?.last_name)}</AvatarFallback></Avatar>
                    <div>
                      {p.title && <h3 className="text-base font-semibold text-foreground">{p.title}</h3>}
                      <p className="text-xs text-muted-foreground">{author ? `${author.first_name} ${author.last_name}` : "BDE"} · {format(new Date(p.created_at), "dd MMM yyyy", { locale: fr })}</p>
                    </div>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{p.content}</p>
                  {p.image_url && <img src={p.image_url} alt="Publication BDE" loading="lazy" decoding="async" className="rounded-lg w-full max-h-96 object-contain bg-secondary/30" />}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
};

export default StudentBDEPage;
