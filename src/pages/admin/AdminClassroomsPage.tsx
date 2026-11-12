import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { DoorOpen, Plus, Pencil, Trash2, Building2, Users as UsersIcon, CheckCircle2, XCircle, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const blank = { name: "", building: "", floor: "", capacity: "", equipment: "", is_available: true };

const AdminClassroomsPage = () => {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const instId = profile?.institution_id;

  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...blank });
  const [editing, setEditing] = useState<any>(null);
  const [deleting, setDeleting] = useState<any>(null);

  /* ---------------- Data ---------------- */
  const { data: classrooms = [], isLoading } = useQuery({
    queryKey: ["classrooms", instId],
    queryFn: async () => {
      let q = supabase.from("classrooms").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!instId,
  });

  // Currently scheduled events (today) → mark room "occupée"
  const { data: occupiedNow = [] } = useQuery({
    queryKey: ["classrooms-occupied-now", instId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data } = await supabase
        .from("schedule_events" as any)
        .select("classroom_id, start_time, end_time")
        .lte("start_time", now)
        .gte("end_time", now);
      return (data || []).map((e: any) => e.classroom_id).filter(Boolean);
    },
    enabled: !!instId,
    refetchInterval: 30_000,
  });

  // 🔥 Mise à jour temps réel : tout changement de planning rafraîchit l'état des salles
  useRealtimeSubscription("schedule_events", [
    ["classrooms-occupied-now", instId],
    ["classrooms-upcoming", instId],
  ]);

  // Upcoming events (next 7 days) for selected classroom
  const { data: upcomingByRoom = {} } = useQuery({
    queryKey: ["classrooms-upcoming", instId],
    queryFn: async () => {
      const now = new Date().toISOString();
      const in7 = new Date(Date.now() + 7 * 86400_000).toISOString();
      const { data } = await supabase
        .from("schedule_events" as any)
        .select("id, title, classroom_id, start_time, end_time")
        .gte("start_time", now)
        .lte("start_time", in7);
      const map: Record<string, any[]> = {};
      (data || []).forEach((e: any) => {
        if (!e.classroom_id) return;
        (map[e.classroom_id] = map[e.classroom_id] || []).push(e);
      });
      return map;
    },
    enabled: !!instId,
  });

  /* ---------------- Mutations ---------------- */
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nom requis");
      const { error } = await (supabase as any).from("classrooms").insert({
        name: form.name.trim(),
        building: form.building.trim() || null,
        floor: form.floor.trim() || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        equipment: form.equipment.trim() || null,
        is_available: form.is_available,
        institution_id: instId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classrooms"] });
      toast.success("Salle créée");
      setForm({ ...blank });
      setCreateOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("classrooms").update({
        name: editing.name,
        building: editing.building || null,
        floor: editing.floor || null,
        capacity: editing.capacity ? Number(editing.capacity) : null,
        equipment: editing.equipment || null,
        is_available: editing.is_available,
      }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classrooms"] });
      toast.success("Salle mise à jour");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (c: any) => {
      const { error } = await (supabase as any).from("classrooms").delete().eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["classrooms"] });
      toast.success("Salle supprimée");
      setDeleting(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  /* ---------------- Derived ---------------- */
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return classrooms;
    return classrooms.filter((c: any) =>
      [c.name, c.building, c.floor, c.equipment].some((v) => (v || "").toLowerCase().includes(q)),
    );
  }, [classrooms, search]);

  const stats = useMemo(() => {
    const total = classrooms.length;
    const dispo = classrooms.filter((c: any) => c.is_available && !occupiedNow.includes(c.id)).length;
    const occupees = classrooms.filter((c: any) => occupiedNow.includes(c.id)).length;
    const inactives = classrooms.filter((c: any) => !c.is_available).length;
    return { total, dispo, occupees, inactives };
  }, [classrooms, occupiedNow]);

  const statusOf = (c: any) => {
    if (!c.is_available) return { label: "Inactive", color: "bg-muted text-muted-foreground border-border" };
    if (occupiedNow.includes(c.id)) return { label: "Occupée", color: "bg-warning/15 text-warning border-warning/30" };
    return { label: "Disponible", color: "bg-success/15 text-success border-success/30" };
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
            <DoorOpen className="w-7 h-7 text-primary" /> Gestion des salles
          </h1>
          <p className="text-muted-foreground mt-1">
            Créez, suivez et reliez vos salles au planning des cours.
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" /> Nouvelle salle
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Créer une salle</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex : Amphi A" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bâtiment</Label>
                  <Input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Étage</Label>
                  <Input value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Capacité</Label>
                <Input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Équipement</Label>
                <Input value={form.equipment} onChange={(e) => setForm({ ...form, equipment: e.target.value })} placeholder="Vidéoprojecteur, tableau, etc." />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium">Salle active</p>
                  <p className="text-xs text-muted-foreground">Désactivez pour la masquer du planning</p>
                </div>
                <Switch checked={form.is_available} onCheckedChange={(v) => setForm({ ...form, is_available: v })} />
              </div>
              <Button className="w-full" disabled={createMutation.isPending} onClick={() => createMutation.mutate()}>
                {createMutation.isPending ? "Création..." : "Créer la salle"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Building2, color: "text-primary bg-primary/10" },
          { label: "Disponibles", value: stats.dispo, icon: CheckCircle2, color: "text-success bg-success/10" },
          { label: "Occupées maintenant", value: stats.occupees, icon: UsersIcon, color: "text-warning bg-warning/10" },
          { label: "Inactives", value: stats.inactives, icon: XCircle, color: "text-muted-foreground bg-muted" },
        ].map((k) => (
          <Card key={k.label} className="border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${k.color}`}>
                <k.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-xl font-bold text-foreground">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Search */}
      <motion.div variants={item} className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une salle..." className="pl-9 bg-card" />
      </motion.div>

      {/* Desktop table */}
      <motion.div variants={item} className="hidden md:block">
        <Card className="border-border/60">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Salle</TableHead>
                  <TableHead>Bâtiment / Étage</TableHead>
                  <TableHead>Capacité</TableHead>
                  <TableHead>Équipement</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Prochains cours</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Chargement...</TableCell></TableRow>
                )}
                {!isLoading && filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune salle trouvée.</TableCell></TableRow>
                )}
                {filtered.map((c: any) => {
                  const status = statusOf(c);
                  const upcoming = upcomingByRoom[c.id] || [];
                  return (
                    <TableRow key={c.id} className="hover:bg-muted/30">
                      <TableCell className="font-semibold text-foreground">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {[c.building, c.floor].filter(Boolean).join(" · ") || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.capacity ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[200px] truncate" title={c.equipment || ""}>{c.equipment || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className={status.color}>{status.label}</Badge></TableCell>
                      <TableCell>
                        {upcoming.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Aucun</span>
                        ) : (
                          <div className="space-y-0.5">
                            {upcoming.slice(0, 2).map((e: any) => (
                              <div key={e.id} className="text-xs">
                                <span className="font-medium">{e.title}</span>{" "}
                                <span className="text-muted-foreground">— {format(new Date(e.start_time), "EEE dd MMM HH:mm", { locale: fr })}</span>
                              </div>
                            ))}
                            {upcoming.length > 2 && (
                              <span className="text-[10px] text-muted-foreground">+{upcoming.length - 2} autres</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setEditing({ ...c })} title="Modifier">
                            <Pencil className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleting(c)} title="Supprimer">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      {/* Mobile cards */}
      <motion.div variants={item} className="md:hidden grid gap-3">
        {filtered.map((c: any) => {
          const status = statusOf(c);
          return (
            <Card key={c.id} className="border-border/60">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-foreground">{c.name}</h3>
                    <p className="text-xs text-muted-foreground">{[c.building, c.floor].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <Badge variant="outline" className={status.color}>{status.label}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Capacité : <span className="font-medium text-foreground">{c.capacity ?? "—"}</span></div>
                  <div className="truncate">Équipement : <span className="font-medium text-foreground">{c.equipment || "—"}</span></div>
                </div>
                <div className="flex justify-end gap-1 pt-1 border-t border-border/40">
                  <Button variant="ghost" size="sm" onClick={() => setEditing({ ...c })}><Pencil className="w-3 h-3 mr-1" /> Modifier</Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(c)}><Trash2 className="w-3 h-3 mr-1 text-destructive" /> Supprimer</Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </motion.div>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier la salle</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Nom</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bâtiment</Label>
                  <Input value={editing.building || ""} onChange={(e) => setEditing({ ...editing, building: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Étage</Label>
                  <Input value={editing.floor || ""} onChange={(e) => setEditing({ ...editing, floor: e.target.value })} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Capacité</Label>
                <Input type="number" value={editing.capacity ?? ""} onChange={(e) => setEditing({ ...editing, capacity: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Équipement</Label>
                <Input value={editing.equipment || ""} onChange={(e) => setEditing({ ...editing, equipment: e.target.value })} />
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <p className="text-sm font-medium">Salle active</p>
                <Switch checked={!!editing.is_available} onCheckedChange={(v) => setEditing({ ...editing, is_available: v })} />
              </div>
              <Button className="w-full" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
                {updateMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la salle ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est définitive. Les cours déjà programmés dans cette salle perdront leur référence.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && deleteMutation.mutate(deleting)} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default AdminClassroomsPage;
