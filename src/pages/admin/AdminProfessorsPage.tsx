import { generateInitialPassword } from "@/lib/password";
import { motion } from "framer-motion";
import { Plus, Copy, Eye, EyeOff, BookOpen, Pencil, Trash2, FolderOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import { ProfessorDossierDialog } from "@/components/admin/ProfessorDossierDialog";
import { getProfessorTitle } from "@/lib/professorTitle";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const AdminProfessorsPage = () => {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newProf, setNewProf] = useState({ first_name: "", last_name: "", password: generateInitialPassword(),request_key:crypto.randomUUID(), department: "", phone: "" });
  const [createdInfo, setCreatedInfo] = useState<{ matricule: string; password: string } | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [editProf, setEditProf] = useState<any>(null);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", department: "", phone: "" });
  const [deleteProf, setDeleteProf] = useState<any>(null);
  const [dossierProf, setDossierProf] = useState<any>(null);

  const { profile } = useAuth();
  const instId = profile?.institution_id;

  const { data: professors = [] } = useQuery({
    queryKey: ["admin-professors", instId],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "professor");
      if (!roles || roles.length === 0) return [];
      const ids = roles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("*").in("user_id", ids);
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q.order("last_name");
      return data || [];
    },
    enabled: !!instId,
  });

  const profIds = professors.map((p: any) => p.user_id);
  const { data: profDiplomas = [] } = useQuery({
    queryKey: ["admin-professors-diplomas", profIds.join(",")],
    queryFn: async () => {
      if (profIds.length === 0) return [];
      const { data } = await (supabase as any).from("professor_documents")
        .select("professor_user_id,doc_type,diploma_level")
        .in("professor_user_id", profIds);
      return (data as any[]) || [];
    },
    enabled: profIds.length > 0,
  });
  const titleByUser: Record<string, string> = {};
  for (const p of professors) {
    const docs = profDiplomas.filter((d: any) => d.professor_user_id === p.user_id);
    titleByUser[p.user_id] = getProfessorTitle(docs, p.academic_title);
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await supabase.functions.invoke("create-professor", {
        body: { ...newProf, institution_id: instId },
      });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admin-professors"] });
      setCreatedInfo({ matricule: data.matricule, password: newProf.password });
      setNewProf({ first_name: "", last_name: "", password: generateInitialPassword(),request_key:crypto.randomUUID(), department: "", phone: "" });
      toast.success(`Professeur créé ! Matricule: ${data.matricule}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        department: editForm.department || null,
        phone: editForm.phone || null,
      }).eq("user_id", editProf.user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-professors"] });
      setEditProf(null);
      toast.success("Professeur modifié !");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await supabase.functions.invoke("delete-user-account", { body: { user_id: userId } });
      if (res.error) throw new Error(res.error.message);
      if (res.data?.error) throw new Error(res.data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-professors"] });
      setDeleteProf(null);
      toast.success("Professeur supprimé définitivement");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success("Copié !"); };

  const openEdit = (p: any) => {
    setEditProf(p);
    setEditForm({ first_name: p.first_name, last_name: p.last_name, department: p.department || "", phone: p.phone || "" });
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Professeurs</h1>
          <p className="text-muted-foreground mt-1">{professors.length} professeur(s)</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setCreatedInfo(null); }}>
          <DialogTrigger asChild>
            <Button className="gradient-gold text-accent-foreground gap-2"><Plus className="w-4 h-4" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5 text-accent" /> Créer un professeur</DialogTitle>
            </DialogHeader>
            {createdInfo ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <p className="text-sm font-medium text-foreground mb-3">✅ Professeur créé !</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                      <span className="text-sm"><strong>Matricule :</strong> {createdInfo.matricule}</span>
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(createdInfo.matricule)}><Copy className="w-4 h-4" /></Button>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded bg-secondary/50">
                      <span className="text-sm"><strong>Mot de passe :</strong> {showPwd ? createdInfo.password : "••••••••"}</span>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setShowPwd(!showPwd)}>{showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                        <Button variant="ghost" size="icon" onClick={() => copyToClipboard(createdInfo.password)}><Copy className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Le professeur se connecte via l'onglet "Professeur" avec son matricule.</p>
                </div>
                <Button onClick={() => { setCreatedInfo(null); setCreateOpen(false); }} className="w-full">Fermer</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground italic">Le matricule sera généré automatiquement (initiales établissement, initiales du professeur, année et numéro unique)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Prénom *</Label>
                    <Input value={newProf.first_name} onChange={(e) => setNewProf({ ...newProf, first_name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Nom *</Label>
                    <Input value={newProf.last_name} onChange={(e) => setNewProf({ ...newProf, last_name: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Département</Label>
                  <Input value={newProf.department} onChange={(e) => setNewProf({ ...newProf, department: e.target.value })} placeholder="Informatique, Droit..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Téléphone</Label>
                  <Input value={newProf.phone} onChange={(e) => setNewProf({ ...newProf, phone: e.target.value })} placeholder="+221 ..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Mot de passe *</Label>
                  <Input type="password" value={newProf.password} onChange={(e) => setNewProf({ ...newProf, password: e.target.value })} minLength={10} placeholder="10 caractères minimum" />
                  <p className="text-xs text-muted-foreground">Mot de passe initial généré automatiquement.</p>
                </div>
                <Button onClick={() => createMutation.mutate()} disabled={!newProf.first_name || !newProf.last_name || newProf.password.length < 6 || createMutation.isPending} className="w-full gradient-gold text-accent-foreground">
                  {createMutation.isPending ? "Création..." : "Créer le professeur"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Edit Dialog */}
      <Dialog open={!!editProf} onOpenChange={(o) => { if (!o) setEditProf(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-accent" /> Modifier le professeur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Prénom</Label>
                <Input value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Nom</Label>
                <Input value={editForm.last_name} onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Département</Label>
              <Input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Téléphone</Label>
              <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            </div>
            <Button onClick={() => updateMutation.mutate()} disabled={!editForm.first_name || !editForm.last_name || updateMutation.isPending} className="w-full gradient-gold text-accent-foreground">
              {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteProf} onOpenChange={(o) => { if (!o) setDeleteProf(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce professeur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le compte de <strong>{deleteProf?.first_name} {deleteProf?.last_name}</strong> sera supprimé définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate(deleteProf.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-4 text-sm font-semibold text-foreground">Nom</th>
                  <th className="text-center p-4 text-sm font-semibold text-foreground">Matricule</th>
                  <th className="text-center p-4 text-sm font-semibold text-foreground">Titre</th>
                  <th className="text-center p-4 text-sm font-semibold text-foreground">Département</th>
                  <th className="text-center p-4 text-sm font-semibold text-foreground">Téléphone</th>
                  <th className="text-center p-4 text-sm font-semibold text-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {professors.length === 0 ? (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Aucun professeur</td></tr>
                ) : professors.map((p: any) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                    <td className="p-4 text-sm font-medium text-foreground">
                      {titleByUser[p.user_id] && <span className="text-accent font-bold mr-1">{titleByUser[p.user_id]}</span>}
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="p-4 text-sm text-center font-mono text-accent">{p.student_number || "—"}</td>
                    <td className="p-4 text-sm text-center">
                      {titleByUser[p.user_id]
                        ? <Badge className="text-[10px] bg-accent text-accent-foreground">{titleByUser[p.user_id]}</Badge>
                        : p.academic_title ? <Badge variant="outline" className="text-[10px]">{p.academic_title}</Badge> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="p-4 text-sm text-center text-muted-foreground">{p.department || "—"}</td>
                    <td className="p-4 text-sm text-center text-muted-foreground">{p.phone || "—"}</td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDossierProf(p)} title="Dossier">
                          <FolderOpen className="w-4 h-4 text-accent" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)} title="Modifier">
                          <Pencil className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteProf(p)} title="Supprimer">
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </motion.div>

      <ProfessorDossierDialog professor={dossierProf} open={!!dossierProf} onOpenChange={(o) => { if (!o) setDossierProf(null); }} />
    </motion.div>
  );
};

export default AdminProfessorsPage;
