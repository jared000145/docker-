import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Plus, Pencil, Trash2, BookOpen, Layers, Search, Eye, AlertTriangle } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { motion } from "framer-motion";

const LEVELS = ["L1", "L2", "L3", "M1", "M2"];
const SEMESTERS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10"];

export default function AdminUEsPage() {
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nom: "", description: "", credits: 6, filiere_id: "", niveau: "L1", semester: "S1" });
  const [originalFiliereId, setOriginalFiliereId] = useState<string>("");
  const [originalSubjectNames, setOriginalSubjectNames] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [filterFiliere, setFilterFiliere] = useState<string>("all");
  const [filterNiveau, setFilterNiveau] = useState<string>("all");
  const [searchUE, setSearchUE] = useState<string>("");
  const [detailUE, setDetailUE] = useState<any | null>(null);

  const { data: filieres = [] } = useQuery({
    queryKey: ["filieres", institution?.id],
    queryFn: async () => {
      const { data } = await supabase.from("filieres").select("*").eq("institution_id", institution!.id).order("name");
      return data || [];
    },
    enabled: !!institution?.id,
  });

  // Auto-load subjects matching filière + niveau (no academic_year restriction so existing matières always show)
  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-for-ue", institution?.id, form.filiere_id, form.niveau],
    queryFn: async () => {
      if (!form.filiere_id) return [];
      const { data } = await supabase
        .from("subjects")
        .select("*")
        .eq("institution_id", institution!.id)
        .eq("filiere_id", form.filiere_id)
        .eq("level", form.niveau)
        .order("name");
      return data || [];
    },
    enabled: !!institution?.id && open && !!form.filiere_id,
  });

  // Already-linked subjects (excluding current UE in edit mode) — to disable them in checkbox list
  const { data: linkedSubjectIds = [] } = useQuery({
    queryKey: ["linked-subjects", institution?.id, editId],
    queryFn: async () => {
      const { data } = await supabase
        .from("ue_matieres")
        .select("subject_id, ue_id, ues!inner(institution_id)")
        .eq("ues.institution_id", institution!.id);
      return (data || [])
        .filter((r: any) => r.ue_id !== editId)
        .map((r: any) => r.subject_id);
    },
    enabled: !!institution?.id && open,
  });

  const { data: ues = [], isLoading } = useQuery({
    queryKey: ["ues", institution?.id, filterFiliere, filterNiveau],
    queryFn: async () => {
      let q = supabase.from("ues").select("*").eq("institution_id", institution!.id);
      if (filterFiliere !== "all") q = q.eq("filiere_id", filterFiliere);
      if (filterNiveau !== "all") q = q.eq("niveau", filterNiveau);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) console.error("UEs fetch error:", error);
      return data || [];
    },
    enabled: !!institution?.id,
  });

  const { data: ueMatieresMap = {} } = useQuery({
    queryKey: ["ue-matieres-map", ues.map(u => u.id).join(",")],
    queryFn: async () => {
      if (!ues.length) return {};
      const { data } = await supabase.from("ue_matieres").select("ue_id, subject_id, subjects(name)").in("ue_id", ues.map(u => u.id));
      const map: Record<string, any[]> = {};
      (data || []).forEach((r: any) => {
        if (!map[r.ue_id]) map[r.ue_id] = [];
        map[r.ue_id].push(r);
      });
      return map;
    },
    enabled: ues.length > 0,
  });

  const resetForm = () => {
    setForm({ nom: "", description: "", credits: 6, filiere_id: "", niveau: "L1", semester: "S1" });
    setSelectedSubjects([]);
    setOriginalFiliereId("");
    setOriginalSubjectNames([]);
    setEditId(null);
  };

  const openEdit = async (ue: any) => {
    setEditId(ue.id);
    setOriginalFiliereId(ue.filiere_id || "");
    setForm({
      nom: ue.nom,
      description: ue.description || "",
      credits: ue.credits,
      filiere_id: ue.filiere_id || "",
      niveau: ue.niveau,
      semester: ue.semester || "S1",
    });
    const { data } = await supabase.from("ue_matieres").select("subject_id, subjects(name)").eq("ue_id", ue.id);
    setSelectedSubjects((data || []).map((d: any) => d.subject_id));
    setOriginalSubjectNames((data || []).map((d: any) => d.subjects?.name).filter(Boolean));
    setOpen(true);
  };

  const normalize = (s: string) => (s || "").toLowerCase().trim().replace(/\s+/g, " ");
  const isReassign = !!editId && !!originalFiliereId && !!form.filiere_id && form.filiere_id !== originalFiliereId;

  // Preview of matched / unmatched subjects when reassigning
  const reassignMatches = isReassign
    ? (() => {
        const origSet = new Set(originalSubjectNames.map(normalize));
        const matched = subjects.filter((s: any) => origSet.has(normalize(s.name)));
        const matchedNames = new Set(matched.map((s: any) => normalize(s.name)));
        const unmatched = originalSubjectNames.filter(n => !matchedNames.has(normalize(n)));
        return { matched, unmatched };
      })()
    : { matched: [], unmatched: [] };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.nom || !form.filiere_id) throw new Error("Le nom et la filière sont requis");

      // ============ RÉASSIGNATION = DUPLICATION ============
      // Si on change la filière en édition, on NE modifie PAS l'UE originale.
      // On crée un doublon avec le même nom dans la nouvelle filière, en remplaçant
      // les matières par celles de la nouvelle filière qui ont le même nom.
      if (isReassign) {
        const matched = reassignMatches.matched;
        if (matched.length === 0) {
          throw new Error(
            `Impossible de réassigner : la filière sélectionnée ne contient aucune matière de même nom que l'UE d'origine (${originalSubjectNames.join(", ") || "aucune"}).`
          );
        }
        const dupCredits = matched.reduce((sum: number, s: any) => sum + (Number(s.credits) || 0), 0);
        const { data: newUe, error: dupErr } = await supabase.from("ues").insert({
          nom: form.nom,
          description: form.description || null,
          credits: dupCredits,
          filiere_id: form.filiere_id,
          niveau: form.niveau,
          semester: form.semester,
          academic_year: selectedYear,
          institution_id: institution!.id,
        } as any).select().single();
        if (dupErr) throw dupErr;
        const { error: linkErr } = await supabase
          .from("ue_matieres")
          .insert(matched.map((s: any) => ({ ue_id: newUe.id, subject_id: s.id })));
        if (linkErr) throw linkErr;
        return { duplicated: true, unmatched: reassignMatches.unmatched };
      }

      // ============ CRÉATION / MODIFICATION STANDARD ============
      const autoCredits = subjects
        .filter((s: any) => selectedSubjects.includes(s.id))
        .reduce((sum: number, s: any) => sum + (Number(s.credits) || 0), 0) || form.credits || 0;
      let ueId = editId;
      if (editId) {
        const { error } = await supabase.from("ues").update({
          nom: form.nom,
          description: form.description || null,
          credits: autoCredits,
          filiere_id: form.filiere_id,
          niveau: form.niveau,
          semester: form.semester,
        } as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("ues").insert({
          nom: form.nom,
          description: form.description || null,
          credits: autoCredits,
          filiere_id: form.filiere_id,
          niveau: form.niveau,
          semester: form.semester,
          academic_year: selectedYear,
          institution_id: institution!.id,
        } as any).select().single();
        if (error) throw error;
        ueId = data.id;
      }
      // reset matières
      await supabase.from("ue_matieres").delete().eq("ue_id", ueId!);
      if (selectedSubjects.length) {
        const { error: linkErr } = await supabase
          .from("ue_matieres")
          .insert(selectedSubjects.map(sid => ({ ue_id: ueId!, subject_id: sid })));
        if (linkErr) throw linkErr;
      }
      return { duplicated: false, unmatched: [] as string[] };
    },

    onSuccess: (res: any) => {
      if (res?.duplicated) {
        toast.success("UE dupliquée dans la nouvelle filière");
        if (res.unmatched?.length) {
          toast.warning(`Matières sans équivalent (non copiées) : ${res.unmatched.join(", ")}`);
        }
      } else {
        toast.success(editId ? "UE modifiée" : "UE créée");
      }
      qc.invalidateQueries({ queryKey: ["ues"] });
      qc.invalidateQueries({ queryKey: ["ue-matieres-map"] });
      qc.invalidateQueries({ queryKey: ["linked-subjects"] });
      setOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message || "Erreur lors de l'enregistrement"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("ue_matieres").delete().eq("ue_id", id);
      const { error } = await supabase.from("ues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("UE supprimée");
      qc.invalidateQueries({ queryKey: ["ues"] });
      qc.invalidateQueries({ queryKey: ["linked-subjects"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getFiliereName = (filiereId?: string | null) =>
    filieres.find((f: any) => f.id === filiereId)?.name || "—";

  const cycle = ((institution as any)?.cycle || "lmd") as "lmd" | "bts";
  const isBTS = cycle === "bts";

  return (
    <div className="space-y-6">
      {isBTS && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <strong>Cycle BTS</strong> — En BTS, la moyenne se calcule directement à partir des <em>matières × coefficient</em>.
          Les UE restent disponibles pour le regroupement pédagogique mais ne sont pas obligatoires pour le calcul.
        </div>
      )}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Layers className="w-8 h-8 text-primary" />
            {isBTS ? "Regroupements (UE optionnelles)" : "Unités d'Enseignement"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isBTS
              ? "BTS : la moyenne se base sur les matières et leurs coefficients. Le regroupement en UE reste optionnel."
              : "Créez une UE et associez-y les matières de la filière. Le code est généré automatiquement."}
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nouvelle UE</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>{editId ? "Modifier l'UE" : "Créer une UE"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom de l'UE *</Label>
                <Input
                  value={form.nom}
                  onChange={e => setForm({ ...form, nom: e.target.value })}
                  placeholder="Ex: Mathématiques fondamentales"
                />
              </div>
              <div>
                <Label>Description (optionnel)</Label>
                <Textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  placeholder="Brève description du contenu pédagogique de l'UE…"
                  rows={2}
                />
              </div>
              {isReassign && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <div><strong>Réassignation = duplication.</strong> L'UE d'origine est conservée. Un <strong>doublon</strong> portant le même nom sera créé dans la nouvelle filière.</div>
                    <div>Les matières seront remplacées par celles de la nouvelle filière qui portent <strong>le même nom</strong> (les crédits/coefficients de la nouvelle filière seront utilisés).</div>
                    {form.filiere_id && (
                      reassignMatches.matched.length === 0 ? (
                        <div className="text-destructive font-medium">
                          ❌ Aucune matière correspondante trouvée dans cette filière. Impossible de dupliquer.
                        </div>
                      ) : (
                        <div className="mt-1">
                          ✅ Correspondances ({reassignMatches.matched.length}) : {reassignMatches.matched.map((s: any) => s.name).join(", ")}
                          {reassignMatches.unmatched.length > 0 && (
                            <div className="text-amber-700 mt-1">
                              ⚠️ Sans équivalent ({reassignMatches.unmatched.length}) : {reassignMatches.unmatched.join(", ")}
                            </div>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>{editId ? "Changer de filière *" : "Filière *"}</Label>
                  <Select value={form.filiere_id} onValueChange={v => { setForm({ ...form, filiere_id: v }); setSelectedSubjects([]); }}>
                    <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Niveau *</Label>
                  <Select value={form.niveau} onValueChange={v => { setForm({ ...form, niveau: v }); setSelectedSubjects([]); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Semestre *</Label>
                  <Select value={form.semester} onValueChange={v => setForm({ ...form, semester: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEMESTERS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Crédits ECTS (auto)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={
                      subjects
                        .filter((s: any) => selectedSubjects.includes(s.id))
                        .reduce((sum: number, s: any) => sum + (Number(s.credits) || 0), 0)
                      || form.credits
                    }
                    readOnly
                    className="bg-muted/40"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Calculé automatiquement depuis les matières sélectionnées.</p>
                </div>
              </div>

              {isReassign ? (
                <div>
                  <Label>Matières du doublon (auto-correspondance par nom)</Label>
                  <div className="border rounded-lg p-3 max-h-72 overflow-auto space-y-2 mt-1 bg-muted/20">
                    {reassignMatches.matched.length === 0 ? (
                      <p className="text-sm text-destructive text-center py-4">
                        Aucune matière de même nom dans cette filière.
                      </p>
                    ) : reassignMatches.matched.map((s: any) => (
                      <div key={s.id} className="flex items-center gap-2 p-2 rounded bg-background">
                        <span className="flex-1 text-sm">{s.name}</span>
                        <Badge variant="outline" className="text-xs">Coef {s.coefficient}</Badge>
                        <Badge variant="secondary" className="text-xs">{s.credits} cr.</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <Label>
                    Matières de la filière {form.niveau} ({selectedSubjects.length} sélectionnée{selectedSubjects.length > 1 ? "s" : ""})
                  </Label>
                  <div className="border rounded-lg p-3 max-h-72 overflow-auto space-y-2 mt-1 bg-muted/20">
                    {!form.filiere_id ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Sélectionnez une filière pour voir les matières
                      </p>
                    ) : subjects.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Aucune matière trouvée pour {form.niveau}. Créez-en dans le module Matières.
                      </p>
                    ) : subjects.map((s: any) => {
                      const isLinkedElsewhere = linkedSubjectIds.includes(s.id);
                      const isChecked = selectedSubjects.includes(s.id);
                      return (
                        <label
                          key={s.id}
                          className={`flex items-center gap-2 p-2 rounded transition ${
                            isLinkedElsewhere && !isChecked
                              ? "opacity-50 cursor-not-allowed"
                              : "cursor-pointer hover:bg-background"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            disabled={isLinkedElsewhere && !isChecked}
                            onCheckedChange={(c) => {
                              if (c) setSelectedSubjects([...selectedSubjects, s.id]);
                              else setSelectedSubjects(selectedSubjects.filter(x => x !== s.id));
                            }}
                          />
                          <span className="flex-1 text-sm">{s.name}</span>
                          <Badge variant="outline" className="text-xs">Coef {s.coefficient}</Badge>
                          <Badge variant="secondary" className="text-xs">{s.credits} cr.</Badge>
                          {isLinkedElsewhere && !isChecked && (
                            <Badge variant="destructive" className="text-[10px]">Déjà dans une UE</Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    💡 Une matière ne peut appartenir qu'à une seule UE.
                  </p>
                </div>
              )}

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || (isReassign && reassignMatches.matched.length === 0)}
                className="w-full"
              >
                {saveMutation.isPending
                  ? "Enregistrement..."
                  : isReassign
                    ? "Dupliquer l'UE dans la nouvelle filière"
                    : editId ? "Mettre à jour l'UE" : "Créer l'UE"}
              </Button>

            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      <Card>
        <CardContent className="pt-6 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher une UE par nom ou code..."
              value={searchUE}
              onChange={e => setSearchUE(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterFiliere} onValueChange={setFilterFiliere}>
            <SelectTrigger className="md:w-[240px]"><SelectValue placeholder="Filière" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les filières</SelectItem>
              {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterNiveau} onValueChange={setFilterNiveau}>
            <SelectTrigger className="md:w-[180px]"><SelectValue placeholder="Niveau" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les niveaux</SelectItem>
              {LEVELS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {(() => {
        const filteredUes = ues.filter((ue: any) => {
          if (!searchUE) return true;
          const q = searchUE.toLowerCase();
          return (ue.nom || "").toLowerCase().includes(q) || (ue.code || "").toLowerCase().includes(q);
        });
        return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          [...Array(6)].map((_, i) => <Card key={i} className="animate-pulse h-48 bg-muted/30" />)
        ) : filteredUes.length === 0 ? (
          <Card className="col-span-full p-12 text-center">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">
              {ues.length === 0 ? "Aucune UE créée. Cliquez sur \"Nouvelle UE\" pour commencer !" : "Aucune UE ne correspond à votre recherche."}
            </p>
          </Card>
        ) : filteredUes.map((ue: any, i) => (
          <motion.div key={ue.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card className="hover:shadow-md transition">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="min-w-0">
                    <CardTitle className="text-base">{ue.nom}</CardTitle>
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">{ue.code}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setDetailUE(ue)} title="Voir détails">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(ue)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Supprimer cette UE ?")) deleteMutation.mutate(ue.id); }}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <Badge>{getFiliereName(ue.filiere_id)}</Badge>
                  <Badge variant="secondary">{ue.niveau}</Badge>
                  {ue.semester && <Badge variant="secondary">{ue.semester}</Badge>}
                  <Badge variant="outline">{ue.credits} crédits</Badge>
                  <Badge variant="outline" className="text-[10px]">{ue.academic_year}</Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  <strong>{(ueMatieresMap[ue.id] || []).length}</strong> matière(s) :
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(ueMatieresMap[ue.id] || []).slice(0, 3).map((m: any) => (
                      <Badge key={m.subject_id} variant="outline" className="text-[10px]">{m.subjects?.name}</Badge>
                    ))}
                    {(ueMatieresMap[ue.id] || []).length > 3 && (
                      <Badge variant="outline" className="text-[10px]">+{(ueMatieresMap[ue.id] || []).length - 3}</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
        );
      })()}

      {/* Detail sheet */}
      <Sheet open={!!detailUE} onOpenChange={(v) => !v && setDetailUE(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailUE && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-primary" />
                  {detailUE.nom}
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">{detailUE.code}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge>{getFiliereName(detailUE.filiere_id)}</Badge>
                  <Badge variant="secondary">{detailUE.niveau}</Badge>
                  {detailUE.semester && <Badge variant="secondary">{detailUE.semester}</Badge>}
                  <Badge variant="outline">{detailUE.credits} crédits ECTS</Badge>
                  <Badge variant="outline">{detailUE.academic_year}</Badge>
                </div>

                <div>
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Matières liées ({(ueMatieresMap[detailUE.id] || []).length})
                  </h3>
                  {(ueMatieresMap[detailUE.id] || []).length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">Aucune matière associée à cette UE.</p>
                  ) : (
                    <div className="space-y-2">
                      {(ueMatieresMap[detailUE.id] || []).map((m: any) => (
                        <div key={m.subject_id} className="flex items-center gap-2 p-3 rounded-lg border bg-muted/20">
                          <BookOpen className="w-4 h-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{m.subjects?.name || "Matière"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button variant="outline" className="w-full" onClick={() => { setDetailUE(null); openEdit(detailUE); }}>
                  <Pencil className="w-4 h-4 mr-2" /> Modifier cette UE
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
