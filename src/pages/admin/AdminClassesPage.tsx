import {useCampus} from "@/hooks/useCampus";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useCycle } from "@/hooks/useCycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { School, Plus, Trash2, Users, BookOpen, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { COLLEGE_NIVEAUX, LYCEE_NIVEAUX, LYCEE_SERIES } from "@/lib/collegeLycee";

export default function AdminClassesPage() {
  const { institution } = useInstitution();
  const {campusId} = useCampus();
  const { selectedYear: activeYear } = useAcademicYear();
  const { hasCollege, hasLycee } = useCycle();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [newSubject, setNewSubject] = useState({ subject_id: "", professor_name: "", coefficient: "1" });
  const [form, setForm] = useState({ cycle: "college" as "college" | "lycee", niveau: "", serie: "", nom: "" });

  const startEdit = (c: any) => {
    setEditing(c);
    setForm({ cycle: (c.cycle === "lycee" ? "lycee" : "college"), niveau: c.niveau || "", serie: c.serie || "", nom: c.nom || "" });
    setOpen(true);
  };

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes", institution?.id, activeYear, campusId],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("classes")
        .select("*")
        .eq("institution_id", institution!.id)
        .eq("academic_year", activeYear)
        .order("cycle").order("niveau").order("nom");
      if (error) throw error;
      return (data || []).filter((row: any) => !campusId || row.campus_id === campusId);
    },
    enabled: !!institution?.id && !!activeYear,
  });

  // Liaisons matières ↔ classes (pour afficher les matières de chaque classe)
  const { data: links = [] } = useQuery({
    queryKey: ["subject-classes", institution?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subject_classes")
        .select("classe_id, professor_name, coefficient, subject:subjects(id,name,code,coefficient)")
        .eq("institution_id", institution!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!institution?.id,
  });

  const subjectsByClass = (classeId: string) =>
    links.filter((l: any) => l.classe_id === classeId);

  // Effectifs par classe
  const { data: countsByClass = {} } = useQuery<Record<string, number>>({
    queryKey: ["classes-student-counts", institution?.id, activeYear],
    enabled: !!institution?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("classe_id")
        .eq("institution_id", institution!.id)
        .not("classe_id", "is", null);
      const m: Record<string, number> = {};
      (data || []).forEach((p: any) => { m[p.classe_id] = (m[p.classe_id] || 0) + 1; });
      return m;
    },
  });

  // Élèves de la classe ouverte
  const { data: detailStudents = [] } = useQuery({
    queryKey: ["class-detail-students", detail?.id],
    enabled: !!detail?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number, sexe")
        .eq("classe_id", detail.id)
        .order("last_name");
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.niveau || !form.nom) throw new Error("Niveau et nom sont requis");
      const payload: any = {
        institution_id: institution!.id, campus_id: campusId,
        academic_year: activeYear,
        cycle: form.cycle,
        niveau: form.niveau,
        serie: form.serie || null,
        nom: form.nom,
      };
      if (editing?.id) {
        const { error } = await (supabase as any).from("classes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("classes").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Classe modifiée" : "Classe créée");
      setOpen(false);
      setEditing(null);
      setForm({ cycle: "college", niveau: "", serie: "", nom: "" });
      qc.invalidateQueries({ queryKey: ["classes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Classe supprimée"); qc.invalidateQueries({ queryKey: ["classes"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  // Matières disponibles de l'établissement
  const { data: allSubjects = [] } = useQuery({
    queryKey: ["school-subjects-for-classes", institution?.id],
    enabled: !!institution?.id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("subjects")
        .select("id, name, code, coefficient")
        .eq("institution_id", institution!.id)
        .order("name");
      return data || [];
    },
  });

  const addLink = useMutation({
    mutationFn: async () => {
      if (!newSubject.subject_id) throw new Error("Choisissez une matière");
      const { error } = await (supabase as any).from("subject_classes").insert({
        institution_id: institution!.id,
        classe_id: detail.id,
        subject_id: newSubject.subject_id,
        professor_name: newSubject.professor_name || null,
        coefficient: Number(newSubject.coefficient) || 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Matière ajoutée à la classe");
      setNewSubject({ subject_id: "", professor_name: "", coefficient: "1" });
      qc.invalidateQueries({ queryKey: ["subject-classes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeLink = useMutation({
    mutationFn: async (subjectId: string) => {
      const { error } = await (supabase as any).from("subject_classes")
        .delete().eq("classe_id", detail.id).eq("subject_id", subjectId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Matière retirée"); qc.invalidateQueries({ queryKey: ["subject-classes"] }); },
    onError: (e: any) => toast.error(e.message),
  });


  const niveaux = form.cycle === "college" ? COLLEGE_NIVEAUX : LYCEE_NIVEAUX;
  const seriesAvail = form.cycle === "lycee" ? (LYCEE_SERIES[form.niveau] || []) : [];

  // Auto-suggestion du nom : « 6e A », « 6e B »… selon les classes existantes du même niveau/série
  const suggestClassName = (niveau: string, serie: string, cycle: "college" | "lycee") => {
    if (!niveau) return "";
    const existing = classes.filter((c: any) =>
      c.niveau === niveau && (cycle === "lycee" ? c.serie === (serie || null) : true)
    );
    const letters = "ABCDEFGHIJ".split("");
    const used = new Set(existing.map((c: any) => {
      const m = String(c.nom || "").match(/\b([A-J])\b\s*$/i);
      return m ? m[1].toUpperCase() : null;
    }).filter(Boolean));
    const next = letters.find((l) => !used.has(l)) || "A";
    const base = cycle === "lycee" && serie ? `${niveau} ${serie}` : niveau;
    return `${base} ${next}`;
  };

  const pickNiveau = (v: string) => {
    const nom = suggestClassName(v, form.serie, form.cycle);
    setForm({ ...form, niveau: v, serie: "", nom });
  };
  const pickSerie = (v: string) => {
    const nom = suggestClassName(form.niveau, v, form.cycle);
    setForm({ ...form, serie: v, nom });
  };

  if (!hasCollege && !hasLycee) {
    return (
      <Card><CardContent className="py-10 text-center">
        <p className="text-muted-foreground">Aucun cycle Collège ou Lycée activé. <br/>Rendez-vous dans <b>Cycles</b> pour les activer.</p>
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <School className="w-8 h-8 text-primary" />
            Classes ({activeYear})
          </h1>
          <p className="text-muted-foreground">Créez et organisez vos classes de collège et lycée.</p>
        </div>

        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ cycle: "college", niveau: "", serie: "", nom: "" }); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="w-4 h-4 mr-2" />Nouvelle classe</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Modifier la classe" : "Créer une classe"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Cycle</Label>
                <Select value={form.cycle} onValueChange={(v: any) => setForm({ ...form, cycle: v, niveau: "", serie: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {hasCollege && <SelectItem value="college">Collège</SelectItem>}
                    {hasLycee && <SelectItem value="lycee">Lycée</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Niveau</Label>
                <Select value={form.niveau} onValueChange={pickNiveau}>
                  <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
                  <SelectContent>
                    {niveaux.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.cycle === "lycee" && seriesAvail.length > 0 && (
                <div>
                  <Label>Série</Label>
                  <Select value={form.serie} onValueChange={pickSerie}>
                    <SelectTrigger><SelectValue placeholder="Choisir la série" /></SelectTrigger>
                    <SelectContent>
                      {seriesAvail.map((s) => <SelectItem key={s} value={s}>Série {s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Nom de la classe</Label>
                <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex : 3e A, Terminale C, 1ère B" />
              </div>
              <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full">
                {editing ? "Enregistrer" : "Créer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? <div className="col-span-full text-center text-muted-foreground">Chargement…</div> :
         classes.length === 0 ? <div className="col-span-full text-center text-muted-foreground py-12">Aucune classe créée</div> :
         classes.map((c: any) => (
          <Card key={c.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setDetail(c)}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">{c.nom}</CardTitle>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline">{c.cycle === "college" ? "Collège" : "Lycée"}</Badge>
                  <Badge>{c.niveau}</Badge>
                  {c.serie && <Badge variant="secondary">Série {c.serie}</Badge>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); startEdit(c); }}>
                  <Pencil className="w-4 h-4 text-primary" />
                </Button>
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); if (confirm(`Supprimer la classe ${c.nom} ?`)) del.mutate(c.id); }}>
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>

            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                <span><Users className="w-3 h-3 inline mr-1" />{countsByClass[c.id] ?? 0} élève(s)</span>
                <span><BookOpen className="w-3 h-3 inline mr-1" />{subjectsByClass(c.id).length} matière(s)</span>
                <span>Année {c.academic_year}</span>
              </div>
              <p className="text-[11px] text-primary font-medium">Cliquer pour voir la fiche complète →</p>
            </CardContent>

          </Card>
        ))}
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <School className="w-5 h-5 text-primary" /> {detail?.nom}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <Tabs defaultValue="eleves">
              <TabsList className="w-full">
                <TabsTrigger value="eleves" className="flex-1">Élèves ({detailStudents.length})</TabsTrigger>
                <TabsTrigger value="matieres" className="flex-1">Matières ({subjectsByClass(detail.id).length})</TabsTrigger>
              </TabsList>
              <TabsContent value="eleves" className="mt-3">
                {detailStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Aucun élève rattaché à cette classe.</p>
                ) : (
                  <ul className="divide-y divide-border/50 rounded-lg border">
                    {detailStudents.map((s: any) => (
                      <li key={s.user_id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.last_name} {s.first_name}</p>
                          <p className="text-[11px] text-muted-foreground">{s.student_number || "—"}</p>
                        </div>
                        {s.sexe && <Badge variant="outline" className="text-[10px] shrink-0">{s.sexe}</Badge>}
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
              <TabsContent value="matieres" className="mt-3 space-y-4">
                {subjectsByClass(detail.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground py-6 text-center">Aucune matière affectée.</p>
                ) : (
                  <ul className="divide-y divide-border/50 rounded-lg border">
                    {subjectsByClass(detail.id).map((l: any) => (
                      <li key={l.subject?.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{l.subject?.name || "—"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{l.professor_name || "Professeur non affecté"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="text-[10px]">coef {l.coefficient ?? 1}</Badge>
                          <Button variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => removeLink.mutate(l.subject?.id)}>
                            <X className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                  <p className="text-xs font-semibold flex items-center gap-1.5"><Plus className="w-3.5 h-3.5 text-primary" />Ajouter une matière</p>
                  <Select value={newSubject.subject_id} onValueChange={(v) => setNewSubject({ ...newSubject, subject_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Choisir une matière…" /></SelectTrigger>
                    <SelectContent>
                      {allSubjects
                        .filter((s: any) => !subjectsByClass(detail.id).some((l: any) => l.subject?.id === s.id))
                        .map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Professeur (optionnel)" value={newSubject.professor_name}
                      onChange={(e) => setNewSubject({ ...newSubject, professor_name: e.target.value })} />
                    <Input type="number" min="1" placeholder="Coefficient" value={newSubject.coefficient}
                      onChange={(e) => setNewSubject({ ...newSubject, coefficient: e.target.value })} />
                  </div>
                  <Button size="sm" className="w-full" disabled={addLink.isPending} onClick={() => addLink.mutate()}>
                    Ajouter à la classe
                  </Button>
                </div>
              </TabsContent>

            </Tabs>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

