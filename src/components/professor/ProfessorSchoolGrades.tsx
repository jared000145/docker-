import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ClipboardList, Save, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { useCycle } from "@/hooks/useCycle";
import { useProfessorClasses, useClassStudents } from "@/hooks/useProfessorClasses";
import { TRIMESTRES, TRIMESTRE_LABEL, matiereAverage } from "@/lib/collegeLycee";
import { toast } from "sonner";

const fmt = (v: number | null | undefined) => (v == null ? "—" : Number(v).toFixed(2));

const ProfessorSchoolGrades = () => {
  const { user } = useAuth();
  const { institution } = useInstitution();
  const { thirdNoteEnabled } = useCycle();
  const qc = useQueryClient();
  const activeYear = institution?.academic_year || "2025-2026";

  const { data: assignments = [], isLoading } = useProfessorClasses();
  const [assignId, setAssignId] = useState("");
  const [trimestre, setTrimestre] = useState("T1");
  const [edits, setEdits] = useState<Record<string, { n1: string; n2: string; n3: string }>>({});

  const assign: any = assignments.find((a) => a.id === assignId);
  const { data: students = [] } = useClassStudents(assign?.classe_id);

  const { data: existing = [] } = useQuery({
    queryKey: ["prof-trim-grades", assign?.classe_id, assign?.subject?.name, trimestre, activeYear],
    enabled: !!assign,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("grades_trimestre")
        .select("*")
        .eq("institution_id", institution!.id)
        .eq("classe_id", assign.classe_id)
        .eq("matiere", assign.subject?.name)
        .eq("trimestre", trimestre)
        .eq("academic_year", activeYear);
      if (error) throw error;
      return data || [];
    },
  });

  const gradeMap = useMemo(() => {
    const m: Record<string, any> = {};
    (existing as any[]).forEach((g) => { m[g.user_id] = g; });
    return m;
  }, [existing]);

  useEffect(() => { setEdits({}); }, [assignId, trimestre]);

  const val = (uid: string, k: "n1" | "n2" | "n3") => {
    const e = edits[uid]?.[k];
    if (e !== undefined) return e;
    const g = gradeMap[uid];
    const raw = k === "n1" ? g?.note1 : k === "n2" ? g?.note2 : g?.note3;
    return raw == null ? "" : String(raw);
  };

  const setVal = (uid: string, k: "n1" | "n2" | "n3", v: string) =>
    setEdits((p) => ({
      ...p,
      [uid]: { n1: val(uid, "n1"), n2: val(uid, "n2"), n3: val(uid, "n3"), ...p[uid], [k]: v },
    }));

  const parse = (v: string): number | null => {
    if (!v) return null;
    const n = parseFloat(String(v).replace(",", "."));
    if (isNaN(n)) return null;
    if (n < 0 || n > 20) throw new Error("Les notes doivent être comprises entre 0 et 20.");
    return n;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!assign) throw new Error("Sélectionnez une classe et une matière.");
      const payload = students
        .map((s: any) => {
          const n1 = parse(val(s.user_id, "n1"));
          const n2 = parse(val(s.user_id, "n2"));
          const n3 = thirdNoteEnabled ? parse(val(s.user_id, "n3")) : null;
          if (n1 == null && n2 == null && n3 == null) return null;
          return {
            user_id: s.user_id,
            classe_id: assign.classe_id,
            matiere: assign.subject?.name,
            trimestre,
            academic_year: activeYear,
            institution_id: institution!.id,
            coefficient: assign.coefficient ?? 1,
            note1: n1, bareme1: 20,
            note2: n2, bareme2: 20,
            note3: n3, bareme3: 20,
            professor_user_id: user!.id,
          };
        })
        .filter(Boolean);
      if (payload.length === 0) throw new Error("Saisissez au moins une note.");
      const { error } = await (supabase as any)
        .from("grades_trimestre")
        .upsert(payload, { onConflict: "user_id,classe_id,matiere,trimestre,academic_year" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notes enregistrées");
      setEdits({});
      qc.invalidateQueries({ queryKey: ["prof-trim-grades"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Chargement…</p>;

  if (assignments.length === 0) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-10 text-center text-muted-foreground text-sm">
          Aucune matière ne vous est affectée. Contactez l'administration.
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
          <ClipboardList className="w-6 h-6 text-primary" /> Saisie des notes
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Notes trimestrielles — année {activeYear}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={assignId} onValueChange={setAssignId}>
          <SelectTrigger className="sm:w-80"><SelectValue placeholder="Classe · Matière…" /></SelectTrigger>
          <SelectContent>
            {assignments.map((a: any) => (
              <SelectItem key={a.id} value={a.id}>{a.classe?.nom} — {a.subject?.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={trimestre} onValueChange={setTrimestre}>
          <SelectTrigger className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRIMESTRES.map((t) => <SelectItem key={t} value={t}>{TRIMESTRE_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        {assign && (
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="sm:ml-auto gap-2">
            <Save className="w-4 h-4" /> Enregistrer
          </Button>
        )}
      </div>

      {!assign ? (
        <Card className="glass-card border-border/50">
          <CardContent className="p-12 text-center text-muted-foreground text-sm">
            Sélectionnez une classe et une matière pour afficher la liste des élèves.
          </CardContent>
        </Card>
      ) : (
        <Card className="glass-card-elevated border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-secondary/30">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">{assign.classe?.nom} · {assign.subject?.name}</span>
              <Badge variant="outline" className="ml-auto text-[10px]">{students.length} élève(s)</Badge>
            </div>
            {students.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Aucun élève inscrit dans cette classe.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[620px]">
                  <thead className="bg-secondary/40 border-b">
                    <tr>
                      <th className="text-left p-3 font-semibold">Élève</th>
                      <th className="text-center p-3 font-semibold w-28">Devoir 1</th>
                      <th className="text-center p-3 font-semibold w-28">Devoir 2</th>
                      {thirdNoteEnabled && <th className="text-center p-3 font-semibold w-28">Composition</th>}
                      <th className="text-center p-3 font-semibold w-24">Moyenne</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((s: any) => {
                      const n1 = parseFloat(val(s.user_id, "n1").replace(",", "."));
                      const n2 = parseFloat(val(s.user_id, "n2").replace(",", "."));
                      const n3 = parseFloat(val(s.user_id, "n3").replace(",", "."));
                      const moy = matiereAverage(
                        isNaN(n1) ? null : n1, 20,
                        isNaN(n2) ? null : n2, 20,
                        thirdNoteEnabled && !isNaN(n3) ? n3 : null, 20,
                      );
                      return (
                        <tr key={s.user_id} className="border-b border-border/40 hover:bg-secondary/20">
                          <td className="p-3">
                            <p className="font-medium">{s.last_name} {s.first_name}</p>
                            <p className="text-[11px] text-muted-foreground">{s.student_number || "—"}</p>
                          </td>
                          <td className="p-2 text-center">
                            <Input inputMode="decimal" className="h-9 text-center" value={val(s.user_id, "n1")} onChange={(e) => setVal(s.user_id, "n1", e.target.value)} placeholder="—" />
                          </td>
                          <td className="p-2 text-center">
                            <Input inputMode="decimal" className="h-9 text-center" value={val(s.user_id, "n2")} onChange={(e) => setVal(s.user_id, "n2", e.target.value)} placeholder="—" />
                          </td>
                          {thirdNoteEnabled && (
                            <td className="p-2 text-center">
                              <Input inputMode="decimal" className="h-9 text-center" value={val(s.user_id, "n3")} onChange={(e) => setVal(s.user_id, "n3", e.target.value)} placeholder="—" />
                            </td>
                          )}
                          <td className={`p-3 text-center font-bold ${moy == null ? "" : moy >= 10 ? "text-success" : "text-destructive"}`}>
                            {fmt(moy)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};

export default ProfessorSchoolGrades;
