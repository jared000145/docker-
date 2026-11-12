import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { LayoutGrid, Plus, Pencil, Trash2, Users, GraduationCap, Search, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Classe = {
  id: string;
  nom: string;
  niveau: string;
  filiere_id: string | null;
  cycle: string;
  academic_year: string;
};

export default function AdminGroupsPage() {
  const navigate = useNavigate();
  const { institution, getLevels } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const qc = useQueryClient();
  const instId = institution?.id;

  const LEVELS = getLevels();

  const [filiereFilter, setFiliereFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<Classe | null>(null);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Classe | null>(null);
  const [form, setForm] = useState({ nom: "", filiere_id: "", niveau: "" });

  // Filières
  const { data: filieres = [] } = useQuery({
    queryKey: ["admin-filieres", instId],
    queryFn: async () => {
      const { data } = await supabase.from("filieres").select("id, name").eq("institution_id", instId!).order("name");
      return data || [];
    },
    enabled: !!instId,
  });

  // Groupes universitaires (classes rattachées à une filière)
  const { data: groups = [] } = useQuery<Classe[]>({
    queryKey: ["admin-groups", instId, selectedYear],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("classes")
        .select("id, nom, niveau, filiere_id, cycle, academic_year")
        .eq("institution_id", instId)
        .eq("academic_year", selectedYear)
        .not("filiere_id", "is", null)
        .order("niveau").order("nom");
      return (data || []) as Classe[];
    },
  });

  // Effectifs par groupe
  const { data: counts = {} } = useQuery<Record<string, number>>({
    queryKey: ["admin-groups-counts", instId],
    enabled: !!instId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("classe_id")
        .eq("institution_id", instId!)
        .not("classe_id", "is", null);
      const m: Record<string, number> = {};
      (data || []).forEach((p: any) => { m[p.classe_id] = (m[p.classe_id] || 0) + 1; });
      return m;
    },
  });

  // Étudiants du groupe ouvert
  const { data: detailStudents = [] } = useQuery({
    queryKey: ["admin-group-students", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number, avatar_url")
        .eq("classe_id", detail!.id)
        .order("last_name");
      return data || [];
    },
  });

  // Realtime : classes + profiles.classe_id
  useEffect(() => {
    if (!instId) return;
    const ch = supabase
      .channel(`admin-groups-${instId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "classes", filter: `institution_id=eq.${instId}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-groups"] });
        qc.invalidateQueries({ queryKey: ["filiere-classes"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `institution_id=eq.${instId}` }, () => {
        qc.invalidateQueries({ queryKey: ["admin-groups-counts"] });
        qc.invalidateQueries({ queryKey: ["admin-group-students"] });
        qc.invalidateQueries({ queryKey: ["filiere-students"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [instId, qc]);

  const filiereName = (id: string | null) => filieres.find((f: any) => f.id === id)?.name || "—";

  const filtered = useMemo(() => {
    return groups.filter((g) => {
      if (filiereFilter !== "all" && g.filiere_id !== filiereFilter) return false;
      if (levelFilter !== "all" && g.niveau !== levelFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!(`${g.nom} ${filiereName(g.filiere_id)} ${g.niveau}`.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [groups, filiereFilter, levelFilter, search, filieres]);

  const openCreate = () => {
    setEditing(null);
    setForm({ nom: "", filiere_id: filiereFilter !== "all" ? filiereFilter : "", niveau: levelFilter !== "all" ? levelFilter : "" });
    setOpen(true);
  };
  const openEdit = (g: Classe) => {
    setEditing(g);
    setForm({ nom: g.nom, filiere_id: g.filiere_id || "", niveau: g.niveau });
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.nom.trim()) throw new Error("Nom requis");
      if (!form.filiere_id) throw new Error("Filière requise");
      if (!form.niveau) throw new Error("Niveau requis");
      if (editing) {
        const { error } = await (supabase as any).from("classes")
          .update({ nom: form.nom.trim(), filiere_id: form.filiere_id, niveau: form.niveau })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("classes").insert({
          institution_id: instId,
          academic_year: selectedYear,
          cycle: "universite",
          niveau: form.niveau,
          nom: form.nom.trim(),
          filiere_id: form.filiere_id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Groupe modifié" : "Groupe créé");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      qc.invalidateQueries({ queryKey: ["filiere-classes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Groupe supprimé");
      qc.invalidateQueries({ queryKey: ["admin-groups"] });
      qc.invalidateQueries({ queryKey: ["filiere-classes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-accent" />
            Groupes / Classes
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Vue globale de tous les groupes universitaires (L1 MGO A, L2 Info B…), synchronisée avec la page Filières.
          </p>
        </div>
        <Button className="gap-2 gradient-gold text-accent-foreground" onClick={openCreate}>
          <Plus className="w-4 h-4" /> Nouveau groupe
        </Button>
      </div>

      {/* Filtres */}
      <Card className="glass-card-elevated border-border/50">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8" placeholder="Rechercher un groupe…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filiereFilter} onValueChange={setFiliereFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les filières</SelectItem>
              {filieres.map((f: any) => (
                <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Niveau" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les niveaux</SelectItem>
              {LEVELS.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Grille des groupes */}
      {filtered.length === 0 ? (
        <Card className="glass-card-elevated border-border/50">
          <CardContent className="p-10 text-center text-muted-foreground">
            Aucun groupe. Créez-en un ou ajustez les filtres.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <Card key={g.id} className="glass-card-elevated border-border/50 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-accent" />
                    {g.nom}
                  </CardTitle>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(g)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm(`Supprimer le groupe ${g.nom} ?`)) del.mutate(g.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">{filiereName(g.filiere_id)}</Badge>
                  <Badge>{g.niveau}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="w-4 h-4" /> {counts[g.id] || 0} étudiant(s)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setDetail(g)}>
                    <Users className="w-4 h-4 mr-1" /> Étudiants
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`/admin/filieres/${g.filiere_id}/${encodeURIComponent(g.niveau)}`)}>
                    <ExternalLink className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialogue création / édition */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Modifier le groupe" : "Nouveau groupe"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Filière</Label>
              <Select value={form.filiere_id} onValueChange={(v) => setForm({ ...form, filiere_id: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir une filière" /></SelectTrigger>
                <SelectContent>
                  {filieres.map((f: any) => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Niveau</Label>
              <Select value={form.niveau} onValueChange={(v) => setForm({ ...form, niveau: v })}>
                <SelectTrigger><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom du groupe</Label>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder="ex : L1 MGO A" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogue étudiants */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" /> {detail?.nom} — étudiants
            </DialogTitle>
          </DialogHeader>
          {detailStudents.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Aucun étudiant affecté.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y">
              {detailStudents.map((s: any) => (
                <div key={s.user_id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-medium">{s.last_name} {s.first_name}</div>
                    <div className="text-xs text-muted-foreground">{s.student_number || "—"}</div>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/students/${s.user_id}`)}>
                    Voir
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
