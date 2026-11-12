import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Plus, Trash2, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const SuperAdminAdminsPage = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<any>(null);
  const [adminToDelete, setAdminToDelete] = useState<any>(null);
  const [form, setForm] = useState({ email: "", password: "123456", first_name: "", last_name: "", institution_id: "" });

  const { data: institutions = [] } = useQuery({
    queryKey: ["sa-institutions"],
    queryFn: async () => {
      const { data } = await supabase.from("institutions" as any).select("*").order("name");
      return data || [];
    },
  });

  const { data: admins = [] } = useQuery({
    queryKey: ["sa-admin-profiles"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (!roles?.length) return [];
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("*").in("user_id", userIds);
      return profiles || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-admin", {
        body: { email: form.email, password: form.password, first_name: form.first_name, last_name: form.last_name, institution_id: form.institution_id || null },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-admin-profiles"] });
      toast.success("Administrateur créé !");
      setOpen(false);
      setForm({ email: "", password: "123456", first_name: "", last_name: "", institution_id: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({
        first_name: editAdmin.first_name,
        last_name: editAdmin.last_name,
        institution_id: editAdmin.institution_id || null,
      }).eq("id", editAdmin.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-admin-profiles"] });
      toast.success("Admin modifié !");
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("delete-user-account", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-admin-profiles"] });
      setAdminToDelete(null);
      toast.success("Administrateur supprimé définitivement");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const instMap = new Map((institutions as any[]).map((i: any) => [i.id, i.name]));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Administrateurs</h1>
          <p className="text-muted-foreground mt-1">Créez et gérez les admins de chaque établissement</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white gap-2">
              <Plus className="w-4 h-4" /> Nouvel admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un administrateur</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Prénom" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                <Input placeholder="Nom" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
              <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input type="password" placeholder="Mot de passe" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <Select value={form.institution_id} onValueChange={(v) => setForm({ ...form, institution_id: v })}>
                <SelectTrigger><SelectValue placeholder="Assigner à un établissement" /></SelectTrigger>
                <SelectContent>
                  {(institutions as any[]).map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => createMutation.mutate()} disabled={!form.email || !form.password || createMutation.isPending} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                {createMutation.isPending ? "Création..." : "Créer l'administrateur"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Modifier l'administrateur</DialogTitle></DialogHeader>
          {editAdmin && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Prénom" value={editAdmin.first_name} onChange={(e) => setEditAdmin({ ...editAdmin, first_name: e.target.value })} />
                <Input placeholder="Nom" value={editAdmin.last_name} onChange={(e) => setEditAdmin({ ...editAdmin, last_name: e.target.value })} />
              </div>
              <Select value={editAdmin.institution_id || ""} onValueChange={(v) => setEditAdmin({ ...editAdmin, institution_id: v })}>
                <SelectTrigger><SelectValue placeholder="Établissement" /></SelectTrigger>
                <SelectContent>
                  {(institutions as any[]).map((i: any) => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                {updateMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <motion.div variants={item}>
        <Card className="border-border/50">
          <CardContent className="p-0">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="text-left p-4 text-sm font-semibold">Nom</th>
                  <th className="text-left p-4 text-sm font-semibold">Email</th>
                  <th className="text-left p-4 text-sm font-semibold">Établissement</th>
                  <th className="text-right p-4 text-sm font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 ? (
                  <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Aucun administrateur</td></tr>
                ) : admins.map((a: any) => (
                  <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/20">
                    <td className="p-4 text-sm font-medium">{a.first_name} {a.last_name}</td>
                    <td className="p-4 text-sm text-muted-foreground">{a.email}</td>
                    <td className="p-4 text-sm text-muted-foreground">{instMap.get(a.institution_id) || "Non assigné"}</td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setEditAdmin({ ...a }); setEditOpen(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setAdminToDelete(a)}>
                          <Trash2 className="w-4 h-4" />
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

      <AlertDialog open={!!adminToDelete} onOpenChange={(open) => !open && setAdminToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement cet administrateur ?</AlertDialogTitle>
            <AlertDialogDescription>
              {adminToDelete ? `Le compte ${adminToDelete.email} sera supprimé définitivement. Cette action est irréversible.` : "Cette action est irréversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => adminToDelete && deleteMutation.mutate(adminToDelete.user_id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Suppression..." : "Oui, supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default SuperAdminAdminsPage;
