import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Plus, Shield, ShieldCheck, Pencil, Trash2, Users } from "lucide-react";

type Permission = { id: string; key: string; label: string; category: string; description: string | null };
type Role = { id: string; institution_id: string; name: string; description: string | null; is_system: boolean; system_key: string | null };
type Member = { id: string; user_id: string; first_name: string; last_name: string; email: string; is_principal: boolean };

export default function RolesManager() {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const instId = profile?.institution_id;

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; perms: Set<string> }>({ name: "", description: "", perms: new Set() });
  const [assignFor, setAssignFor] = useState<Role | null>(null);

  const { data: permissions = [] } = useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: async () => {
      const { data } = await supabase.from("permissions").select("*").order("category").order("label");
      return (data || []) as Permission[];
    },
    staleTime: 5 * 60_000,
  });

  const { data: roles = [] } = useQuery({
    queryKey: ["roles", instId],
    queryFn: async () => {
      const { data } = await supabase.from("roles").select("*").eq("institution_id", instId!).order("is_system", { ascending: false }).order("name");
      return (data || []) as Role[];
    },
    enabled: !!instId,
  });

  const { data: rolePerms = [] } = useQuery({
    queryKey: ["role-permissions", instId],
    queryFn: async () => {
      const { data } = await supabase.from("role_permissions").select("role_id, permission_id");
      return (data || []) as { role_id: string; permission_id: string }[];
    },
    enabled: !!instId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["team-members-light", instId],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, user_id, first_name, last_name, email, is_principal").eq("institution_id", instId!).order("last_name");
      return (data || []) as Member[];
    },
    enabled: !!instId,
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["user-roles-v2", instId],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles_v2").select("user_id, role_id").eq("institution_id", instId!);
      return (data || []) as { user_id: string; role_id: string }[];
    },
    enabled: !!instId,
  });

  const permsByCategory = useMemo(() => {
    const map: Record<string, Permission[]> = {};
    permissions.forEach((p) => { (map[p.category] ||= []).push(p); });
    return map;
  }, [permissions]);

  const permsByRole = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    rolePerms.forEach((rp) => { (map[rp.role_id] ||= new Set()).add(rp.permission_id); });
    return map;
  }, [rolePerms]);

  const openCreate = () => {
    setForm({ name: "", description: "", perms: new Set() });
    setEditing(null);
    setCreateOpen(true);
  };

  const openEdit = (r: Role) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description || "", perms: new Set(permsByRole[r.id] || []) });
    setCreateOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nom requis");
      let roleId = editing?.id;
      if (editing) {
        // Update name/desc only if not system (system role name locked)
        const updates: any = { description: form.description || null };
        if (!editing.is_system) updates.name = form.name.trim();
        const { error } = await supabase.from("roles").update(updates).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("roles").insert({
          institution_id: instId!,
          name: form.name.trim(),
          description: form.description || null,
          is_system: false,
        }).select("id").single();
        if (error) throw error;
        roleId = data.id;
      }
      // Replace permissions
      await supabase.from("role_permissions").delete().eq("role_id", roleId!);
      const rows = Array.from(form.perms).map((pid) => ({ role_id: roleId!, permission_id: pid }));
      if (rows.length) {
        const { error } = await supabase.from("role_permissions").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles", instId] });
      qc.invalidateQueries({ queryKey: ["role-permissions", instId] });
      qc.invalidateQueries({ queryKey: ["user-permission-keys"] });
      toast.success(editing ? "Rôle mis à jour" : "Rôle créé");
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: Role) => {
      if (r.is_system) throw new Error("Les rôles système ne peuvent être supprimés.");
      const { error } = await supabase.from("roles").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles", instId] });
      qc.invalidateQueries({ queryKey: ["user-permission-keys"] });
      toast.success("Rôle supprimé");
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleAssignMutation = useMutation({
    mutationFn: async ({ userId, roleId, assign }: { userId: string; roleId: string; assign: boolean }) => {
      if (assign) {
        const { error } = await supabase.from("user_roles_v2").insert({ user_id: userId, role_id: roleId, institution_id: instId! });
        if (error && !error.message.includes("duplicate")) throw error;
      } else {
        const { error } = await supabase.from("user_roles_v2").delete().eq("user_id", userId).eq("role_id", roleId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-roles-v2", instId] });
      qc.invalidateQueries({ queryKey: ["user-permission-keys"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePerm = (pid: string) => {
    const next = new Set(form.perms);
    if (next.has(pid)) next.delete(pid); else next.add(pid);
    setForm({ ...form, perms: next });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-heading font-bold flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Rôles & permissions</h2>
          <p className="text-sm text-muted-foreground mt-1">Créez des rôles personnalisés et attribuez-leur des permissions. L'interface s'adapte automatiquement.</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Nouveau rôle</Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {roles.map((r) => {
          const rPerms = permsByRole[r.id] || new Set();
          const assignedUsers = userRoles.filter((ur) => ur.role_id === r.id);
          return (
            <Card key={r.id} className="border-border/60">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {r.is_system ? <ShieldCheck className="w-4 h-4 text-accent" /> : <Shield className="w-4 h-4 text-muted-foreground" />}
                      <span className="font-semibold">{r.name}</span>
                      {r.is_system && <Badge variant="outline" className="text-[10px]">Système</Badge>}
                    </div>
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Modifier"><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setAssignFor(r)} title="Attribuer"><Users className="w-4 h-4" /></Button>
                    {!r.is_system && <Button size="icon" variant="ghost" onClick={() => setDeleting(r)} title="Supprimer"><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {permissions.filter((p) => rPerms.has(p.id)).slice(0, 6).map((p) => (
                    <Badge key={p.id} variant="secondary" className="text-[10px]">{p.label}</Badge>
                  ))}
                  {rPerms.size > 6 && <Badge variant="secondary" className="text-[10px]">+{rPerms.size - 6}</Badge>}
                  {rPerms.size === 0 && <span className="text-xs text-muted-foreground">Aucune permission</span>}
                </div>
                <p className="text-xs text-muted-foreground">{assignedUsers.length} membre(s) assigné(s)</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create/Edit dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Modifier "${editing.name}"` : "Nouveau rôle"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nom du rôle *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={!!editing?.is_system} />
              {editing?.is_system && <p className="text-[11px] text-muted-foreground mt-1">Nom verrouillé (rôle système). Vous pouvez modifier les permissions.</p>}
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label className="text-xs">Permissions</Label>
              <div className="space-y-3 mt-2">
                {Object.entries(permsByCategory).map(([cat, perms]) => (
                  <div key={cat} className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{cat}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {perms.map((p) => (
                        <label key={p.id} className="flex items-start gap-2 text-sm cursor-pointer rounded-md px-2 py-1.5 hover:bg-muted/60">
                          <Checkbox checked={form.perms.has(p.id)} onCheckedChange={() => togglePerm(p.id)} className="mt-0.5" />
                          <div className="min-w-0">
                            <span className="block">{p.label}</span>
                            {p.description && <span className="block text-[10px] text-muted-foreground">{p.description}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <Button className="w-full" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assignment dialog */}
      <Dialog open={!!assignFor} onOpenChange={(o) => !o && setAssignFor(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Attribuer "{assignFor?.name}" aux membres</DialogTitle></DialogHeader>
          <div className="space-y-1">
            {members.filter((m) => !m.is_principal).map((m) => {
              const checked = userRoles.some((ur) => ur.user_id === m.user_id && ur.role_id === assignFor?.id);
              return (
                <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer rounded-md px-2 py-2 hover:bg-muted/60 border border-border">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => assignFor && toggleAssignMutation.mutate({ userId: m.user_id, roleId: assignFor.id, assign: !checked })}
                  />
                  <div className="min-w-0">
                    <p className="font-medium">{m.first_name} {m.last_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  </div>
                </label>
              );
            })}
            {members.filter((m) => !m.is_principal).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun membre à attribuer.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer "{deleting?.name}" ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les membres assignés perdront ces permissions. Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting)} className="bg-destructive hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
