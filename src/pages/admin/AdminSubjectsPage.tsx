import {useCampus} from "@/hooks/useCampus";
import { motion } from "framer-motion";
import { BookOpen, Plus, Trash2, Pencil, GraduationCap, FileText } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import { useInstitution } from "@/hooks/useInstitution";
import { useCycle } from "@/hooks/useCycle";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { COLLEGE_NIVEAUX as CN, LYCEE_NIVEAUX as LN } from "@/lib/collegeLycee";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const COLLEGE_NIVEAUX = [...CN];
const LYCEE_NIVEAUX = [...LN];

const defaultForm = {
  name: "", code: "", professor: "", credits: "3", coefficient: "1",
  semester: "S1", academic_year: "2024-2025", description: "",
  filiere_id: "", level: "L1",
  volume_horaire_cm: "20", volume_horaire_td: "10", volume_horaire_tp: "10",
  quota_absence_hours: "0",
  syllabus: "",
  evaluation_mode: "prof_full",
  duree_cours_minutes: "60",
  // Scolaire (Collège / Lycée)
  scolaire_niveau: "",        // ex: "6ème", "2nde"
  scolaire_serie: "ALL",      // pour Lycée : "ALL" ou une série précise
};

export const EVAL_MODE_LABELS: Record<string, string> = {
  intra_only: "Prof — intra seulement (admin gère l'examen final)",
  prof_full: "Prof — intra + examen final",
  admin_exam: "Admin gère l'examen final (prof fait cours uniquement)",
};
export const EVAL_MODE_BADGE: Record<string, string> = {
  intra_only: "Intra (prof)",
  prof_full: "Intra + Examen (prof)",
  admin_exam: "Examen admin",
};


const AdminSubjectsPage = () => {
  const { getLevels } = useInstitution();
  const { hasUniversite, hasCollege, hasLycee } = useCycle();
  const scolaireOnly = (hasCollege || hasLycee) && !hasUniversite;
  const { profile } = useAuth();
  const instId = profile?.institution_id;
  const {campusId} = useCampus();
  const LEVELS = getLevels();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterFiliere, setFilterFiliere] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [form, setForm] = useState(defaultForm);
  const [classAssign, setClassAssign] = useState<Record<string, { on: boolean; prof: string }>>({});


  const { data: filieres = [] } = useQuery({
    queryKey: ["admin-filieres", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("filieres").select("*").order("name");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.or(`campus_id.is.null,campus_id.eq.${campusId}`);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  // Fetch professors created for this institution
  const { data: professors = [] } = useQuery({
    queryKey: ["admin-professors-list", instId, campusId],
    queryFn: async () => {
      const { data: profRoles } = await supabase.from("user_roles").select("user_id").eq("role", "professor");
      if (!profRoles?.length) return [];
      const profIds = profRoles.map((r: any) => r.user_id);
      let q = supabase.from("profiles").select("user_id, first_name, last_name");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.eq("campus_id", campusId);
      q = q.in("user_id", profIds);
      const { data } = await q.order("last_name");
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["admin-subjects", instId, campusId],
    queryFn: async () => {
      let q = supabase.from("subjects").select("*, filieres(name)").order("name");
      if (instId) q = q.eq("institution_id", instId);
      if (campusId) q = q.or(`campus_id.is.null,campus_id.eq.${campusId}`);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["admin-classes-for-subjects", instId, campusId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("classes").select("*")
        .eq("institution_id", instId!)
        .order("niveau");
      return data || [];
    },
    enabled: !!instId && scolaireOnly,
  });

  // Séries disponibles pour un niveau lycée donné
  const seriesForNiveau = (niv: string) => {
    const set = new Set<string>();
    classes.forEach((c: any) => {
      if (c.niveau === niv && c.serie) set.add(c.serie);
    });
    return Array.from(set).sort();
  };

  const isLyceeNiveau = (niv: string) => (LYCEE_NIVEAUX as string[]).includes(niv);

  // Classes candidates selon niveau / série
  const candidateClasses = (() => {
    if (!scolaireOnly || !form.scolaire_niveau) return [] as any[];
    return classes.filter((c: any) => {
      if (c.niveau !== form.scolaire_niveau) return false;
      if (isLyceeNiveau(c.niveau) && form.scolaire_serie && form.scolaire_serie !== "ALL") {
        return c.serie === form.scolaire_serie;
      }
      return true;
    });
  })();

  // Affectation par classe : { [classeId]: { on, prof } }
  useEffect(() => {
    if (!scolaireOnly) return;
    setClassAssign((prev) => {
      const next: Record<string, { on: boolean; prof: string }> = {};
      candidateClasses.forEach((c: any) => {
        next[c.id] = prev[c.id] || { on: true, prof: form.professor || "" };
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scolaireOnly, form.scolaire_niveau, form.scolaire_serie, classes.length]);

  const targetClasses = candidateClasses.filter((c: any) => classAssign[c.id]?.on === true);


  // Realtime
  useRealtimeSubscription("subjects", [["admin-subjects"]]);

  const filtered = subjects.filter((s: any) => {
    if (filterFiliere !== "all" && s.filiere_id !== filterFiliere) return false;
    if (filterLevel !== "all" && s.level !== filterLevel) return false;
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // En mode scolaire, on utilise le niveau scolaire choisi comme level
      const effectiveLevel = scolaireOnly && form.scolaire_niveau ? form.scolaire_niveau : form.level;
      const payload: Record<string, any> = {
        ...(editId ? {} : {campus_id:campusId}), name: form.name, code: form.code || null, professor: form.professor || null,
        professor_user_id: professors.find((p: any) => `${p.first_name} ${p.last_name}` === form.professor)?.user_id || null,
        credits: parseInt(form.credits), coefficient: parseInt(form.coefficient),
        semester: form.semester, academic_year: form.academic_year,
        description: form.description || null,
        filiere_id: scolaireOnly ? null : (form.filiere_id || null),
        level: effectiveLevel,
        volume_horaire_cm: parseInt(form.volume_horaire_cm) || 0,
        volume_horaire_td: parseInt(form.volume_horaire_td) || 0,
        volume_horaire_tp: parseInt(form.volume_horaire_tp) || 0,
        quota_absence_hours: parseFloat(form.quota_absence_hours) || 0,
        syllabus: form.syllabus || null,
        evaluation_mode: form.evaluation_mode || "prof_full",
        duree_cours_minutes: parseInt(form.duree_cours_minutes) || 60,
      };
      if (!editId && instId) payload.institution_id = instId;

      let subjectId = editId;
      if (editId) {
        const { error } = await supabase.from("subjects").update(payload as any).eq("id", editId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("subjects").insert(payload as any).select("id").single();
        if (error) throw error;
        subjectId = (data as any)?.id ?? null;
      }

      // Synchronise les liaisons matière ↔ classes en mode scolaire
      if (scolaireOnly && subjectId) {
        await (supabase as any).from("subject_classes").delete().eq("subject_id", subjectId);
        if (targetClasses.length > 0) {
          const rows = targetClasses.map((c: any) => ({
            institution_id: instId,
            subject_id: subjectId,
            classe_id: c.id,
            coefficient: parseFloat(form.coefficient) || 1,
            professor_name: (classAssign[c.id]?.prof || form.professor || null) || null,
          }));
          const { error: linkErr } = await (supabase as any).from("subject_classes").insert(rows);
          if (linkErr) throw linkErr;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-subjects", campusId] });
      qc.invalidateQueries({ queryKey: ["admin-classes-for-subjects", campusId] });
      const n = targetClasses.length;
      toast.success(
        scolaireOnly && n > 0
          ? `Matière ${editId ? "modifiée" : "ajoutée"} et affectée à ${n} classe(s)`
          : editId ? "Matière modifiée" : "Matière ajoutée"
      );
      setOpen(false);
      setEditId(null);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-subjects", campusId] });
      toast.success("Matière supprimée");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => { setForm(defaultForm); setClassAssign({}); };

  const openEdit = async (s: any) => {
    setEditId(s.id);
    setForm({
      name: s.name, code: s.code || "", professor: s.professor || "",
      credits: String(s.credits), coefficient: String(s.coefficient),
      semester: s.semester, academic_year: s.academic_year,
      description: s.description || "", filiere_id: s.filiere_id || "", level: s.level || "L1",
      volume_horaire_cm: String(s.volume_horaire_cm || 0),
      volume_horaire_td: String(s.volume_horaire_td || 0),
      volume_horaire_tp: String(s.volume_horaire_tp || 0),
      quota_absence_hours: String(s.quota_absence_hours || 0),
      syllabus: s.syllabus || "",
      evaluation_mode: s.evaluation_mode || "prof_full",
      duree_cours_minutes: String(s.duree_cours_minutes || 60),
      scolaire_niveau: s.level || "",
      scolaire_serie: "ALL",
    });
    setOpen(true);
    if (scolaireOnly) {
      const { data: links } = await (supabase as any)
        .from("subject_classes").select("classe_id, professor_name").eq("subject_id", s.id);
      const map: Record<string, { on: boolean; prof: string }> = {};
      (links || []).forEach((l: any) => { map[l.classe_id] = { on: true, prof: l.professor_name || s.professor || "" }; });
      setClassAssign(map);
    }
  };


  const filiereMap = new Map(filieres.map((f: any) => [f.id, f.name]));
  const totalVH = (s: any) => (s.volume_horaire_cm || 0) + (s.volume_horaire_td || 0) + (s.volume_horaire_tp || 0);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">Matières</h1>
          <p className="text-muted-foreground mt-1">{subjects.length} matière(s) au total</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditId(null); resetForm(); }} className="gradient-gold text-accent-foreground gap-2"><Plus className="w-4 h-4" /> Ajouter</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-accent" />
                {editId ? "Modifier la matière" : "Nouvelle matière"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              {/* Section 1: Info de base */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informations générales</Label>
                <div className="grid gap-3">
                  <Input placeholder="Nom de la matière *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Code (ex: INF301)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                    <div className="space-y-1">
                      <Select value={form.professor} onValueChange={(v) => setForm({ ...form, professor: v })}>
                        <SelectTrigger><SelectValue placeholder="Professeur responsable" /></SelectTrigger>
                        <SelectContent>
                          {professors.map((p: any) => (
                            <SelectItem key={p.user_id} value={`${p.first_name} ${p.last_name}`}>
                              {p.first_name} {p.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Ou saisir un nom manuellement" value={form.professor} onChange={(e) => setForm({ ...form, professor: e.target.value })} className="text-xs h-8" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Classification */}
              {scolaireOnly ? (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Affectation aux classes
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Niveau *</Label>
                      <Select
                        value={form.scolaire_niveau}
                        onValueChange={(v) => setForm({ ...form, scolaire_niveau: v, scolaire_serie: "ALL" })}
                      >
                        <SelectTrigger><SelectValue placeholder="Choisir un niveau" /></SelectTrigger>
                        <SelectContent>
                          <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Collège</div>
                          {COLLEGE_NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                          <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Lycée</div>
                          {LYCEE_NIVEAUX.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Coefficient *</Label>
                      <Input type="number" min="1" max="10" step="1" value={form.coefficient}
                        onChange={(e) => setForm({ ...form, coefficient: e.target.value })} />
                    </div>
                  </div>

                  {form.scolaire_niveau && isLyceeNiveau(form.scolaire_niveau) && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Série (Lycée)</Label>
                      <Select
                        value={form.scolaire_serie}
                        onValueChange={(v) => setForm({ ...form, scolaire_serie: v })}
                      >
                        <SelectTrigger><SelectValue placeholder="Toutes les séries" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">Toutes les séries de {form.scolaire_niveau}</SelectItem>
                          {seriesForNiveau(form.scolaire_niveau).map((s) => (
                            <SelectItem key={s} value={s}>{form.scolaire_niveau} {s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        Ex : sélectionnez « C » pour n'affecter la matière qu'aux {form.scolaire_niveau} C.
                      </p>
                    </div>
                  )}

                  {form.scolaire_niveau && (
                    <div className="rounded-md border bg-muted/30 p-2 space-y-2">
                      {candidateClasses.length === 0 ? (
                        <span className="text-xs text-warning">Aucune classe correspondante pour ce niveau/série.</span>
                      ) : (
                        <>
                          <p className="text-[11px] text-muted-foreground">
                            Cochez les classes concernées et choisissez le professeur qui y dispense la matière.
                          </p>
                          {candidateClasses.map((c: any) => {
                            const a = classAssign[c.id] || { on: false, prof: "" };
                            return (
                              <div key={c.id} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-current"
                                  checked={a.on}
                                  onChange={(e) =>
                                    setClassAssign({ ...classAssign, [c.id]: { ...a, on: e.target.checked } })
                                  }
                                />
                                <span className="text-xs font-medium w-28 truncate">
                                  {c.niveau}{c.serie ? ` ${c.serie}` : ""} — {c.nom}
                                </span>
                                <Select
                                  value={a.prof || ""}
                                  onValueChange={(v) => setClassAssign({ ...classAssign, [c.id]: { on: true, prof: v } })}
                                  disabled={!a.on}
                                >
                                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Professeur de cette classe" /></SelectTrigger>
                                  <SelectContent>
                                    {professors.map((p: any) => (
                                      <SelectItem key={p.user_id} value={`${p.first_name} ${p.last_name}`}>
                                        {p.first_name} {p.last_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                          <p className="text-[11px] font-medium">
                            {targetClasses.length} classe(s) sélectionnée(s)
                          </p>
                        </>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Classification</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={form.filiere_id} onValueChange={(v) => setForm({ ...form, filiere_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Filière *" /></SelectTrigger>
                      <SelectContent>
                        {filieres.map((f: any) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={form.level} onValueChange={(v) => setForm({ ...form, level: v })}>
                      <SelectTrigger><SelectValue placeholder="Niveau" /></SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-3 grid-cols-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Crédits ECTS</Label>
                      <Input type="number" value={form.credits} onChange={(e) => setForm({ ...form, credits: e.target.value })} min="1" max="30" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Coefficient</Label>
                      <Input type="number" value={form.coefficient} onChange={(e) => setForm({ ...form, coefficient: e.target.value })} min="1" max="10" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Semestre</Label>
                      <Select value={form.semester} onValueChange={(v) => setForm({ ...form, semester: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="S1">S1</SelectItem>
                          <SelectItem value="S2">S2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* Section 3: Volume horaire (universitaire) OU durée de cours (scolaire) */}
              {scolaireOnly ? (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Durée d'une séance (minutes)</Label>
                  <Input type="number" value={form.duree_cours_minutes} onChange={(e) => setForm({ ...form, duree_cours_minutes: e.target.value })} min="15" step="5" />
                  <p className="text-xs text-muted-foreground">Utilisée pour convertir les absences en heures et vérifier le quota annuel.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Volume horaire (heures)</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">CM (Cours)</Label>
                      <Input type="number" value={form.volume_horaire_cm} onChange={(e) => setForm({ ...form, volume_horaire_cm: e.target.value })} min="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">TD</Label>
                      <Input type="number" value={form.volume_horaire_td} onChange={(e) => setForm({ ...form, volume_horaire_td: e.target.value })} min="0" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">TP</Label>
                      <Input type="number" value={form.volume_horaire_tp} onChange={(e) => setForm({ ...form, volume_horaire_tp: e.target.value })} min="0" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: {(parseInt(form.volume_horaire_cm) || 0) + (parseInt(form.volume_horaire_td) || 0) + (parseInt(form.volume_horaire_tp) || 0)}h
                  </p>
                </div>
              )}

              {/* Section 3b: Quota d'absence (universitaire seul) */}
              {!scolaireOnly && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quota d'absence (heures)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="Ex: 6 (0 = pas de limite)"
                    value={form.quota_absence_hours}
                    onChange={(e) => setForm({ ...form, quota_absence_hours: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Au-delà de ce nombre d'heures d'absence, l'étudiant sera exclu de l'examen de cette matière. Laisser à 0 pour aucune limite.
                  </p>
                </div>
              )}

              {/* Section 3c: Mode d'évaluation (universitaire seul) */}
              {!scolaireOnly && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mode d'évaluation</Label>
                  <Select value={form.evaluation_mode} onValueChange={(v) => setForm({ ...form, evaluation_mode: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="prof_full">{EVAL_MODE_LABELS.prof_full}</SelectItem>
                      <SelectItem value="intra_only">{EVAL_MODE_LABELS.intra_only}</SelectItem>
                      <SelectItem value="admin_exam">{EVAL_MODE_LABELS.admin_exam}</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Détermine qui est responsable de la note d'examen final pour cette matière.
                  </p>
                </div>
              )}

              {/* Section 4: Description & programme */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contenu</Label>
                <Input placeholder="Description courte" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                <Textarea
                  placeholder="Syllabus / Programme détaillé (objectifs, chapitres, compétences visées...)"
                  value={form.syllabus}
                  onChange={(e) => setForm({ ...form, syllabus: e.target.value })}
                  rows={4}
                />
              </div>

              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending} className="w-full gradient-gold text-accent-foreground">
                {saveMutation.isPending ? "Enregistrement..." : editId ? "Modifier la matière" : "Ajouter la matière"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Filters */}
      <motion.div variants={item} className="flex gap-3">
        <Select value={filterFiliere} onValueChange={setFilterFiliere}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Toutes les filières" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les filières</SelectItem>
            {filieres.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-32"><SelectValue placeholder="Niveau" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      <motion.div variants={item}>
        <Card className="glass-card-elevated border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-4 text-sm font-semibold text-foreground">Nom</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Code</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Filière</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Niveau</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Professeur</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Cr/Coef</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">VH</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Sem.</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">PV</th>
                    <th className="text-center p-4 text-sm font-semibold text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">Aucune matière</td></tr>
                  ) : filtered.map((s: any) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-secondary/20 transition-colors">
                      <td className="p-4 text-sm font-medium text-foreground">
                        <div className="flex flex-col gap-1">
                          <span>{s.name}</span>
                          <span className="text-[10px] inline-block w-fit px-2 py-0.5 rounded-full bg-secondary/70 text-muted-foreground">
                            {EVAL_MODE_BADGE[s.evaluation_mode || "prof_full"]}
                          </span>
                          {s.description && <p className="text-xs text-muted-foreground truncate max-w-[220px]">{s.description}</p>}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-center text-muted-foreground">{s.code || "—"}</td>
                      <td className="p-4 text-sm text-center text-muted-foreground">{filiereMap.get(s.filiere_id) || "—"}</td>
                      <td className="p-4 text-sm text-center"><span className="bg-accent/15 text-accent text-xs px-2 py-1 rounded-full">{s.level}</span></td>
                      <td className="p-4 text-sm text-center text-muted-foreground">{s.professor || "—"}</td>
                      <td className="p-4 text-sm text-center">{s.credits}/{s.coefficient}</td>
                      <td className="p-4 text-sm text-center">
                        <span className="text-xs text-muted-foreground">{totalVH(s)}h</span>
                      </td>
                      <td className="p-4 text-sm text-center"><span className="bg-info/15 text-info text-xs px-2 py-1 rounded-full">{s.semester}</span></td>
                      <td className="p-4 text-center">
                        {s.pv_url ? (
                          <Button variant="ghost" size="sm" className="text-primary gap-1"
                            onClick={async () => {
                              const { data, error } = await supabase.storage.from("pv-professeurs").createSignedUrl(s.pv_url, 60);
                              if (error) return toast.error("Erreur téléchargement");
                              window.open(data.signedUrl, "_blank");
                            }}>
                            <FileText className="w-4 h-4" /> Voir
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center flex gap-1 justify-center">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(s)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default AdminSubjectsPage;
