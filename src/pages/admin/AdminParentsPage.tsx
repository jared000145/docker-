import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const AdminParentsPage = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const instId = profile?.institution_id;
  const [open, setOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState<string | null>(null);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "123456" });
  const [studentToLink, setStudentToLink] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [filterFiliere, setFilterFiliere] = useState<string>("all");
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [searchName, setSearchName] = useState<string>("");

  const { data: parents = [] } = useQuery({
    queryKey: ["admin-parents"],
    queryFn: async () => {
      const { data } = await supabase.from("parents" as any).select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["admin-students-for-parent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number, filiere_id, level")
        .order("last_name");
      const ids = (data || []).map((p: any) => p.user_id);
      if (!ids.length) return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "user").in("user_id", ids);
      const studentIds = new Set((roles || []).map((r: any) => r.user_id));
      return (data || []).filter((p: any) => studentIds.has(p.user_id));
    },
  });

  const { data: filieres = [] } = useQuery({
    queryKey: ["parents-filieres", instId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("id, name, institution_id").order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data } = await q;
      // Dedupe by normalized name (case/whitespace-insensitive)
      const seen = new Map<string, any>();
      for (const f of (data || []) as any[]) {
        const key = (f.name || "").trim().toLowerCase();
        if (!seen.has(key)) seen.set(key, f);
      }
      return Array.from(seen.values());
    },
  });

  const { data: links = [] } = useQuery({
    queryKey: ["admin-parent-links"],
    queryFn: async () => {
      const { data } = await supabase.from("parent_students" as any).select("*");
      return data || [];
    },
  });

  const handleCreate = async () => {
    if (!form.full_name || !form.email || !form.password) {
      toast.error("Nom, email et mot de passe requis");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-parent", { body: form });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Erreur");
      toast.success("Parent créé");
      setOpen(false);
      setForm({ full_name: "", email: "", phone: "", password: "123456" });
      qc.invalidateQueries({ queryKey: ["admin-parents"] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Création impossible"); }
    finally { setBusy(false); }
  };

  const handleLink = async (parentId: string) => {
    if (!studentToLink) return;
    const { error } = await supabase.from("parent_students" as any).insert({ parent_id: parentId, student_user_id: studentToLink });
    if (error) toast.error(error.message);
    else { toast.success("Enfant associé"); qc.invalidateQueries({ queryKey: ["admin-parent-links"] }); }
    setStudentToLink("");
    setLinkOpen(null);
  };

  const handleUnlink = async (linkId: string) => {
    await supabase.from("parent_students" as any).delete().eq("id", linkId);
    qc.invalidateQueries({ queryKey: ["admin-parent-links"] });
  };

  const handleDelete = async (parent: any) => {
    const { error } = await supabase.functions.invoke("delete-user-account", { body: { user_id: parent.user_id } });
    if (error) toast.error(error.message);
    else { toast.success("Parent supprimé"); qc.invalidateQueries({ queryKey: ["admin-parents"] }); }
  };

  const childrenOf = (pid: string) =>
    (links as any[]).filter((l) => l.parent_id === pid).map((l) => {
      const s = (students as any[]).find((st) => st.user_id === l.student_user_id);
      return { linkId: l.id, label: s ? `${s.first_name} ${s.last_name}` : l.student_user_id };
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Users className="w-6 h-6" /> Parents</h1>
          <p className="text-sm text-muted-foreground">Gérez les comptes parents et leurs enfants associés.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Nouveau parent</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un compte parent</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nom complet" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Input type="password" placeholder="Mot de passe initial (123456 par défaut)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={handleCreate} disabled={busy}>{busy ? "Création..." : "Créer"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>Liste des parents</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow><TableHead>Nom</TableHead><TableHead>Email</TableHead><TableHead>Téléphone</TableHead><TableHead>Enfants associés</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {parents.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucun parent</TableCell></TableRow>}
              {(parents as any[]).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>{p.phone || "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {childrenOf(p.id).length === 0 && <span className="text-xs text-muted-foreground">Aucun</span>}
                      {childrenOf(p.id).map((c) => (
                        <Badge key={c.linkId} variant="secondary" className="cursor-pointer" onClick={() => handleUnlink(c.linkId)} title="Cliquer pour retirer">
                          {c.label} ✕
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Dialog open={linkOpen === p.id} onOpenChange={(o) => { setLinkOpen(o ? p.id : null); if (!o) { setFilterFiliere("all"); setFilterLevel("all"); setSearchName(""); setStudentToLink(""); } }}>
                      <DialogTrigger asChild><Button size="sm" variant="outline"><UserPlus className="w-4 h-4 mr-1" /> Associer</Button></DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Associer un enfant à {p.full_name}</DialogTitle></DialogHeader>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <Select value={filterFiliere} onValueChange={(v) => { setFilterFiliere(v); setStudentToLink(""); }}>
                              <SelectTrigger><SelectValue placeholder="Filière" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Toutes filières</SelectItem>
                                {(filieres as any[]).map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Select value={filterLevel} onValueChange={(v) => { setFilterLevel(v); setStudentToLink(""); }}>
                              <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Tous niveaux</SelectItem>
                                {["L1","L2","L3","M1","M2"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Input placeholder="Rechercher par nom..." value={searchName} onChange={(e) => setSearchName(e.target.value)} />
                          <Select value={studentToLink} onValueChange={setStudentToLink}>
                            <SelectTrigger><SelectValue placeholder="Choisir un étudiant" /></SelectTrigger>
                            <SelectContent>
                              {(students as any[])
                                .filter((s) => filterFiliere === "all" || s.filiere_id === filterFiliere)
                                .filter((s) => filterLevel === "all" || s.level === filterLevel)
                                .filter((s) => {
                                  const q = searchName.trim().toLowerCase();
                                  if (!q) return true;
                                  return `${s.first_name} ${s.last_name} ${s.student_number || ""}`.toLowerCase().includes(q);
                                })
                                .slice(0, 100)
                                .map((s) => (
                                  <SelectItem key={s.user_id} value={s.user_id}>{s.first_name} {s.last_name} {s.student_number ? `(${s.student_number})` : ""}</SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <DialogFooter><Button onClick={() => handleLink(p.id)} disabled={!studentToLink}>Associer</Button></DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button size="sm" variant="destructive"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Supprimer ce parent ?</AlertDialogTitle><AlertDialogDescription>Le compte sera supprimé définitivement.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(p)}>Supprimer</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminParentsPage;
