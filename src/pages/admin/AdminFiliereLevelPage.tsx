import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Users, BookOpen, Plus, Trash2, School, GraduationCap, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

export default function AdminFiliereLevelPage() {
  const { filiereId = "", level: rawLevel = "" } = useParams();
  const level = decodeURIComponent(rawLevel);
  const navigate = useNavigate();
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const qc = useQueryClient();
  const instId = institution?.id;

  const [selectedClasse, setSelectedClasse] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [nom, setNom] = useState("");

  const { data: filiere } = useQuery({
    queryKey: ["filiere", filiereId],
    queryFn: async () => {
      const { data } = await supabase.from("filieres").select("*").eq("id", filiereId).maybeSingle();
      return data;
    },
    enabled: !!filiereId,
  });

  // Sous-classes (groupes) de cette filière + niveau
  const { data: classes = [] } = useQuery({
    queryKey: ["filiere-classes", filiereId, level, instId, selectedYear],
    enabled: !!instId && !!filiereId && !!level,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("classes")
        .select("*")
        .eq("institution_id", instId)
        .eq("filiere_id", filiereId)
        .eq("niveau", level)
        .order("nom");
      return data || [];
    },
  });

  // Étudiants de la filière + niveau
  const { data: students = [] } = useQuery({
    queryKey: ["filiere-students", filiereId, level, instId],
    enabled: !!instId && !!filiereId && !!level,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, student_number, avatar_url, classe_id, sexe")
        .eq("institution_id", instId!)
        .eq("filiere_id", filiereId)
        .eq("level", level)
        .order("last_name");
      return data || [];
    },
  });

  const filteredStudents = useMemo(() => {
    if (selectedClasse === "all") return students;
    if (selectedClasse === "none") return students.filter((s: any) => !s.classe_id);
    return students.filter((s: any) => s.classe_id === selectedClasse);
  }, [students, selectedClasse]);

  // Matières (UE) de la filière + niveau
  const { data: subjects = [] } = useQuery({
    queryKey: ["filiere-subjects", filiereId, level, instId],
    enabled: !!instId && !!filiereId && !!level,
    queryFn: async () => {
      const { data } = await supabase
        .from("subjects")
        .select("id, name, code, coefficient, credits, semester, professor")
        .eq("institution_id", instId!)
        .eq("filiere_id", filiereId)
        .eq("level", level)
        .order("semester").order("name");
      return data || [];
    },
  });

  const countByClass = useMemo(() => {
    const m: Record<string, number> = { none: 0 };
    students.forEach((s: any) => {
      const k = s.classe_id || "none";
      m[k] = (m[k] || 0) + 1;
    });
    return m;
  }, [students]);

  const createClasse = useMutation({
    mutationFn: async () => {
      if (!nom.trim()) throw new Error("Nom requis");
      const { error } = await (supabase as any).from("classes").insert({
        institution_id: instId,
        academic_year: selectedYear,
        cycle: "universite",
        niveau: level,
        nom: nom.trim(),
        filiere_id: filiereId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Groupe créé");
      setNom(""); setOpen(false);
      qc.invalidateQueries({ queryKey: ["filiere-classes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteClasse = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Groupe supprimé");
      if (selectedClasse !== "all") setSelectedClasse("all");
      qc.invalidateQueries({ queryKey: ["filiere-classes"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignStudent = useMutation({
    mutationFn: async ({ userId, classeId }: { userId: string; classeId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ classe_id: classeId }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Étudiant affecté");
      qc.invalidateQueries({ queryKey: ["filiere-students"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const suggestName = () => {
    const letters = "ABCDEFGHIJ".split("");
    const used = new Set(
      classes.map((c: any) => {
        const m = String(c.nom || "").match(/\b([A-J])\b\s*$/i);
        return m ? m[1].toUpperCase() : null;
      }).filter(Boolean)
    );
    const next = letters.find((l) => !used.has(l)) || "A";
    return `${level} ${filiere?.name || ""} ${next}`.trim();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/filieres")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl lg:text-3xl font-heading font-bold flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-accent" />
              {filiere?.name || "Filière"} <span className="text-muted-foreground">—</span> <Badge className="text-base px-3 py-1">{level}</Badge>
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {students.length} étudiant(s) · {classes.length} groupe(s) · {subjects.length} matière(s)
            </p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setNom(suggestName()); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 gradient-gold text-accent-foreground"><Plus className="w-4 h-4" />Nouveau groupe</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Créer un groupe pour {filiere?.name} — {level}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nom du groupe</Label>
                <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder={`ex : ${level} ${filiere?.name || ""} A`} />
              </div>
              <Button className="w-full" onClick={() => createClasse.mutate()} disabled={createClasse.isPending}>
                Créer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sélecteur de sous-classe */}
      <Card className="glass-card-elevated border-border/50">
        <CardContent className="p-3 flex items-center gap-2 flex-wrap">
          <LayoutGrid className="w-4 h-4 text-muted-foreground mr-1" />
          <Button
            size="sm"
            variant={selectedClasse === "all" ? "default" : "outline"}
            onClick={() => setSelectedClasse("all")}
          >
            Toutes ({students.length})
          </Button>
          {classes.map((c: any) => (
            <div key={c.id} className="flex items-center gap-1 group">
              <Button
                size="sm"
                variant={selectedClasse === c.id ? "default" : "outline"}
                onClick={() => setSelectedClasse(c.id)}
              >
                {c.nom} ({countByClass[c.id] || 0})
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => { if (confirm(`Supprimer le groupe ${c.nom} ?`)) deleteClasse.mutate(c.id); }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
          {(countByClass.none ?? 0) > 0 && (
            <Button size="sm" variant={selectedClasse === "none" ? "default" : "outline"} onClick={() => setSelectedClasse("none")}>
              Non affectés ({countByClass.none})
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="students">
        <TabsList className="w-full max-w-md">
          <TabsTrigger value="students" className="flex-1 gap-2"><Users className="w-4 h-4" />Étudiants ({filteredStudents.length})</TabsTrigger>
          <TabsTrigger value="subjects" className="flex-1 gap-2"><BookOpen className="w-4 h-4" />Matières ({subjects.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="students" className="mt-4">
          <Card className="glass-card-elevated border-border/50">
            <CardContent className="p-0">
              {filteredStudents.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Aucun étudiant dans cette sélection.
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {filteredStudents.map((s: any) => {
                    const cls = classes.find((c: any) => c.id === s.classe_id);
                    return (
                      <li key={s.user_id} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/30 transition-colors">
                        <button
                          className="flex items-center gap-3 min-w-0 flex-1 text-left"
                          onClick={() => navigate(`/admin/students/${s.user_id}`)}
                        >
                          {s.avatar_url ? (
                            <img src={s.avatar_url} alt={`Photo de ${s.first_name} ${s.last_name}`} className="w-9 h-9 rounded-full object-cover" />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-accent/15 text-accent flex items-center justify-center text-xs font-semibold">
                              {(s.first_name?.[0] || "") + (s.last_name?.[0] || "")}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{s.last_name} {s.first_name}</p>
                            <p className="text-[11px] text-muted-foreground">{s.student_number || "—"}{cls ? ` · ${cls.nom}` : ""}</p>
                          </div>
                        </button>
                        <select
                          className="text-xs bg-background border border-border rounded px-2 py-1"
                          value={s.classe_id || ""}
                          onChange={(e) => assignStudent.mutate({ userId: s.user_id, classeId: e.target.value || null })}
                        >
                          <option value="">— Non affecté —</option>
                          {classes.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.nom}</option>
                          ))}
                        </select>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subjects" className="mt-4">
          <Card className="glass-card-elevated border-border/50">
            <CardContent className="p-0">
              {subjects.length === 0 ? (
                <div className="p-10 text-center text-muted-foreground">
                  <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  Aucune matière rattachée à {filiere?.name} — {level}.
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {subjects.map((m: any) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{m.name} {m.code ? <span className="text-muted-foreground">({m.code})</span> : null}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {m.professor || "Professeur non affecté"} · {m.semester || "—"}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <Badge variant="outline" className="text-[10px]">coef {m.coefficient ?? 1}</Badge>
                        <Badge variant="secondary" className="text-[10px]">{m.credits ?? 0} ECTS</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
