import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useCycle } from "@/hooks/useCycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileSpreadsheet, Save, FileDown } from "lucide-react";
import { toast } from "sonner";
import { TRIMESTRES, TRIMESTRE_LABEL, matiereAverage, trimestreAverage } from "@/lib/collegeLycee";
import { generateReleveTrimestrePdf, uploadReleveTrimestrePdf } from "@/lib/releveTrimestrePdf";
import { fetchProfsByMatiere } from "@/lib/buildTrimestreBulletin";


const normalizeNiveau = (n: string) => (n || "").replace(/ème$/i, "e").replace(/eme$/i, "e").trim();

const computeTrimesterRanks = (grades: any[]) => {
  const byUser = new Map<string, { moyenne: number | null; coefficient: number }[]>();
  grades.forEach((g: any) => {
    const list = byUser.get(g.user_id) || [];
    list.push({
      moyenne: matiereAverage(g.note1, g.bareme1, g.note2, g.bareme2, g.note3, g.bareme3),
      coefficient: Number(g.coefficient) || 1,
    });
    byUser.set(g.user_id, list);
  });
  const sorted = Array.from(byUser.entries())
    .map(([user_id, lignes]) => ({ user_id, moyenne: trimestreAverage(lignes) }))
    .filter((row): row is { user_id: string; moyenne: number } => row.moyenne != null)
    .sort((a, b) => b.moyenne - a.moyenne);

  const ranked: { user_id: string; moyenne: number; rang: number }[] = [];
  sorted.forEach((row, index) => {
    ranked.push({
      ...row,
      rang: index > 0 && sorted[index - 1].moyenne === row.moyenne ? ranked[index - 1].rang : index + 1,
    });
  });
  return ranked;
};

type Row = {
  id: string | null;
  user_id: string;
  matiere: string;
  note1: number | null; bareme1: number;
  note2: number | null; bareme2: number;
  note3: number | null; bareme3: number;
  coefficient: number;
};

export default function AdminGradesTrimestrePage() {
  const { institution } = useInstitution();
  const { selectedYear: activeYear } = useAcademicYear();
  const { thirdNoteEnabled, hasCollege, hasLycee } = useCycle();
  const qc = useQueryClient();
  const [classeId, setClasseId] = useState<string>("");
  const [trimestre, setTrimestre] = useState<"T1" | "T2" | "T3">("T1");
  const [matiere, setMatiere] = useState<string>("");
  const [coefficient, setCoefficient] = useState<number>(1);

  const { data: classes = [] } = useQuery({
    queryKey: ["classes-list", institution?.id, activeYear],
    queryFn: async () => {
      const { data } = await (supabase as any).from("classes")
        .select("id,nom,niveau,serie,cycle")
        .eq("institution_id", institution!.id)
        .eq("academic_year", activeYear);
      return data || [];
    },
    enabled: !!institution?.id,
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ["subjects-list", institution?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("subjects")
        .select("id,name,coefficient,level")
        .eq("institution_id", institution!.id)
        .order("name");
      return data || [];
    },
    enabled: !!institution?.id,
  });

  const selectedClass = useMemo(() => (classes as any[]).find((c) => c.id === classeId), [classes, classeId]);

  const { data: subjectClassLinks = [] } = useQuery({
    queryKey: ["subject-class-links", classeId],
    queryFn: async () => {
      const { data } = await (supabase as any).from("subject_classes")
        .select("subject_id, coefficient")
        .eq("classe_id", classeId);
      return data || [];
    },
    enabled: !!classeId,
  });

  const classSubjects = useMemo(() => {
    if (!classeId) return [] as any[];
    const linkedIds = new Set((subjectClassLinks as any[]).map((l) => l.subject_id));
    if (linkedIds.size > 0) return (subjects as any[]).filter((s) => linkedIds.has(s.id));
    if (!selectedClass) return [] as any[];
    const byLevel = (subjects as any[]).filter((s) => normalizeNiveau(s.level) === normalizeNiveau(selectedClass.niveau));
    return byLevel.length > 0 ? byLevel : (subjects as any[]);
  }, [classeId, selectedClass, subjectClassLinks, subjects]);

  const coefficientBySubjectId = useMemo(
    () => new Map((subjectClassLinks as any[]).map((link) => [link.subject_id, Number(link.coefficient) || 1])),
    [subjectClassLinks],
  );

  // Distinct subject names for dropdown
  const subjectNames = useMemo(() => {
    const set = new Set<string>();
    (classSubjects as any[]).forEach((s) => s?.name && set.add(s.name));
    return Array.from(set).sort();
  }, [classSubjects]);

  const { data: students = [] } = useQuery({
    queryKey: ["classe-students", classeId, activeYear, institution?.id, selectedClass?.niveau, selectedClass?.serie],
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "user");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase.from("profiles")
        .select("user_id, first_name, last_name, student_number, avatar_url, classe_id, level, serie, academic_year")
        .eq("institution_id", institution!.id)
        .eq("academic_year", activeYear)
        .in("user_id", ids);
      return (data || [])
        .filter((s: any) =>
          s.classe_id === classeId ||
          (!s.classe_id && normalizeNiveau(s.level) === normalizeNiveau(selectedClass.niveau) && (!selectedClass.serie || String(s.serie || "").toUpperCase() === String(selectedClass.serie).toUpperCase()))
        )
        .sort((a: any, b: any) => (a.last_name || "").localeCompare(b.last_name || ""));
    },
    enabled: !!classeId && !!institution?.id && !!selectedClass,
  });

  const { data: grades = [], refetch } = useQuery({
    queryKey: ["grades-trimestre", classeId, trimestre, activeYear, matiere],
    queryFn: async () => {
      if (!classeId || !matiere) return [];
      const { data } = await (supabase as any).from("grades_trimestre")
        .select("*")
        .eq("classe_id", classeId)
        .eq("matiere", matiere)
        .eq("trimestre", trimestre)
        .eq("academic_year", activeYear);
      return data || [];
    },
    enabled: !!classeId && !!matiere,
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [signature, setSignature] = useState("");

  const currentSig = `${classeId}|${matiere}|${trimestre}|${students.length}|${grades.length}`;
  useEffect(() => {
    if (currentSig === signature) return;
    setSignature(currentSig);
    if (!classeId || !matiere) { setRows([]); return; }
    const byUser: Record<string, any> = {};
    (grades as any[]).forEach((g) => { byUser[g.user_id] = g; });
    const selectedSubject = (classSubjects as any[]).find((s: any) => s.name === matiere);
    const defaultCoef = coefficientBySubjectId.get(selectedSubject?.id) ?? (Number(selectedSubject?.coefficient) || 1);
    setCoefficient(defaultCoef);
    setRows((students as any[]).map((s) => {
      const g = byUser[s.user_id];
      return {
        id: g?.id || null,
        user_id: s.user_id,
        matiere,
        note1: g?.note1 ?? null,
        bareme1: g?.bareme1 ?? 20,
        note2: g?.note2 ?? null,
        bareme2: g?.bareme2 ?? 20,
        note3: g?.note3 ?? null,
        bareme3: g?.bareme3 ?? 20,
        coefficient: defaultCoef,
      };
    }));
  }, [currentSig, signature, classeId, matiere, students, grades, classSubjects, coefficientBySubjectId]);

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!classeId || !matiere) throw new Error("Sélectionner classe et matière");
      const payload = rows
        .filter((r) => r.note1 != null || r.note2 != null || r.note3 != null)
        .map((r) => ({
          institution_id: institution!.id,
          user_id: r.user_id,
          classe_id: classeId,
          matiere,
          trimestre,
          academic_year: activeYear,
          note1: r.note1,
          bareme1: Number(r.bareme1) || 20,
          note2: r.note2,
          bareme2: Number(r.bareme2) || 20,
          note3: r.note3,
          bareme3: Number(r.bareme3) || 20,
          coefficient: Number(r.coefficient) || coefficient || 1,
        }));
      if (payload.length === 0) throw new Error("Aucune note à enregistrer");
      const { error } = await (supabase as any).from("grades_trimestre").upsert(payload, {
        onConflict: "user_id,classe_id,matiere,trimestre,academic_year",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Notes enregistrées"); refetch(); qc.invalidateQueries({ queryKey: ["grades-trimestre"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const generatePdfFor = useMutation({
    mutationFn: async (userId: string) => {
      const student = (students as any[]).find((s) => s.user_id === userId);
      const classe = (classes as any[]).find((c) => c.id === classeId);
      if (!student || !classe) throw new Error("Sélection manquante");

      // Notes de l'élève pour le trimestre courant (toutes matières)
      const { data: allRows } = await (supabase as any).from("grades_trimestre")
        .select("*")
        .eq("user_id", userId)
        .eq("classe_id", classeId)
        .eq("trimestre", trimestre)
        .eq("academic_year", activeYear);
      if (!allRows || allRows.length === 0) throw new Error("Aucune note pour cet élève");

      // Notes de toute la classe pour ce trimestre (moyenne classe + rang)
      const { data: classAll } = await (supabase as any).from("grades_trimestre")
        .select("user_id,matiere,note1,bareme1,note2,bareme2,note3,bareme3,coefficient")
        .eq("classe_id", classeId)
        .eq("trimestre", trimestre)
        .eq("academic_year", activeYear);

      // Bilan (moyennes trim précédents + annuelle)
      const { data: prevReleves } = await (supabase as any).from("releves_trimestre")
        .select("trimestre,moyenne_trimestre,rang,moyenne_annuelle")
        .eq("user_id", userId).eq("classe_id", classeId).eq("academic_year", activeYear);
      const bilan: any = {};
      (prevReleves || []).forEach((r: any) => {
        const t = String(r.trimestre).toLowerCase();
        bilan[`${t}_eleve`] = r.moyenne_trimestre;
        bilan[`${t}_rang`] = r.rang;
        if (r.moyenne_annuelle != null) bilan.annuelle = r.moyenne_annuelle;
      });

      // Vie scolaire (absences trimestre)
      const { data: absences } = await (supabase as any).from("attendance")
        .select("status,duration_hours,date")
        .eq("user_id", userId)
        .eq("academic_year", activeYear);
      const abs = (absences || []).filter((a: any) => a.status === "absent");
      const retards = (absences || []).filter((a: any) => a.status === "late").length;
      const heures = abs.reduce((s: number, a: any) => s + (Number(a.duration_hours) || 0), 0);

      // Effectif + genres classe
      const totalStudents = (students as any[]).length;
      const masculin = (students as any[]).filter((s) => String(s.gender || "").toLowerCase().startsWith("m")).length;
      const feminin = (students as any[]).filter((s) => String(s.gender || "").toLowerCase().startsWith("f")).length;

      // Signature Directeur
      const profByMatiere = await fetchProfsByMatiere(classeId);

      const { data: dirSig } = await (supabase as any).from("director_signatures")

        .select("director_name,signature_url,stamp_url")
        .eq("institution_id", institution!.id)
        .maybeSingle();

      // Calc moyenne + upsert releve
      const moyLignes = allRows.map((r: any) => ({
        moyenne: matiereAverage(r.note1, r.bareme1, r.note2, r.bareme2, r.note3, r.bareme3),
        coefficient: Number(r.coefficient) || 1,
      }));
      const moyTrim = trimestreAverage(moyLignes);
      const ranked = computeTrimesterRanks(classAll || []);
      const studentRank = ranked.find((r) => r.user_id === userId)?.rang ?? null;
      const { data: releve, error: rErr } = await (supabase as any).from("releves_trimestre").upsert({
        institution_id: institution!.id,
        user_id: userId,
        classe_id: classeId,
        trimestre,
        academic_year: activeYear,
        moyenne_trimestre: moyTrim,
        rang: studentRank,
      }, { onConflict: "user_id,classe_id,trimestre,academic_year" }).select().single();
      if (rErr) throw rErr;

      const pdf = await generateReleveTrimestrePdf({
        institution: {
          name: institution!.name,
          logo_url: institution!.logo_url,
          telephone: (institution as any)?.phone,
          bp: (institution as any)?.bp,
        },
        student: {
          user_id: userId,
          first_name: student.first_name,
          last_name: student.last_name,
          student_number: student.student_number,
          avatar_url: student.avatar_url,
          date_of_birth: (student as any).date_of_birth,
          place_of_birth: (student as any).place_of_birth,
          gender: (student as any).gender,
          nationality: (student as any).nationality,
          statut: (student as any).statut,
        },
        classe: {
          nom: classe.nom, niveau: classe.niveau, serie: classe.serie, cycle: classe.cycle,
          effectif: totalStudents, masculin, feminin,
        },
        trimestre, academic_year: activeYear,
        lignes: (allRows as any[]).map((r: any) => ({ ...r, professor: profByMatiere[r.matiere] || null })),
        class_all_grades: classAll || [],
        bilan,
        vie_scolaire: { absences_heures: heures, retards, sanctions: null, observations: null },
        director: dirSig ? { name: dirSig.director_name, signature_url: dirSig.signature_url, stamp_url: dirSig.stamp_url, date_conseil: new Date().toISOString() } : { date_conseil: new Date().toISOString() },
        qr_token: releve.qr_token,
      });
      const path = await uploadReleveTrimestrePdf(userId, releve.id, pdf);
      await (supabase as any).from("releves_trimestre").update({ pdf_url: path }).eq("id", releve.id);
      const url = URL.createObjectURL(pdf);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Bulletin_${trimestre}_${student.last_name}_${student.first_name}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success("Bulletin généré"),
    onError: (e: any) => toast.error(e.message),
  });


  if (!hasCollege && !hasLycee) {
    return <Card><CardContent className="py-10 text-center text-muted-foreground">Aucun cycle Collège ou Lycée activé.</CardContent></Card>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="w-8 h-8 text-primary" />
          Notes trimestrielles
        </h1>
        <p className="text-muted-foreground">Choisissez classe, trimestre puis matière : tous les élèves de la classe s'affichent avec leurs deux notes.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Filtres</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm mb-1 block">Classe</label>
            <Select value={classeId} onValueChange={(v) => { setClasseId(v); setMatiere(""); }}>
              <SelectTrigger><SelectValue placeholder="Choisir…" /></SelectTrigger>
              <SelectContent>
                {(classes as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.nom} ({c.niveau}{c.serie ? ` ${c.serie}` : ""})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm mb-1 block">Trimestre</label>
            <Select value={trimestre} onValueChange={(v: any) => setTrimestre(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIMESTRES.map((t) => <SelectItem key={t} value={t}>{TRIMESTRE_LABEL[t]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm mb-1 block">Matière</label>
            <Select value={matiere} onValueChange={setMatiere} disabled={!classeId}>
              <SelectTrigger><SelectValue placeholder={classeId ? "Choisir une matière…" : "Sélectionner une classe d'abord"} /></SelectTrigger>
              <SelectContent>
                {subjectNames.length === 0 && <div className="px-2 py-1.5 text-sm text-muted-foreground">Aucune matière liée à cette classe — affectez-la dans "Matières".</div>}
                {subjectNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {classeId && matiere && (
        <Card>
          <CardHeader className="flex flex-row justify-between items-center flex-wrap gap-2">
            <CardTitle>{matiere} — {TRIMESTRE_LABEL[trimestre]} — {students.length} élève(s)</CardTitle>
            <div className="flex items-center gap-2">
              <label className="text-sm">Coefficient matière :</label>
              <Input type="number" step="0.5" min="0" className="w-20"
                value={coefficient}
                onChange={(e) => {
                  const v = Number(e.target.value) || 1;
                  setCoefficient(v);
                  setRows((prev) => prev.map((r) => ({ ...r, coefficient: v })));
                }} />
              <Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="w-4 h-4 mr-1" />Enregistrer</Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {students.length === 0 ? (
              <div className="text-center text-muted-foreground py-6">Aucun élève dans cette classe.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Élève</TableHead>
                    <TableHead>Note 1</TableHead>
                    <TableHead>/</TableHead>
                    <TableHead>Note 2</TableHead>
                    <TableHead>/</TableHead>
                    {thirdNoteEnabled && <><TableHead>Note 3</TableHead><TableHead>/</TableHead></>}
                    <TableHead>Moy./20</TableHead>
                    <TableHead className="text-right">PDF</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => {
                    const student = (students as any[]).find((s) => s.user_id === r.user_id);
                    const moy = matiereAverage(r.note1, r.bareme1, r.note2, r.bareme2, r.note3, r.bareme3);
                    return (
                      <TableRow key={r.user_id}>
                        <TableCell className="font-medium">
                          <div>{student?.last_name?.toUpperCase()} {student?.first_name}</div>
                          {student?.student_number && <div className="text-xs text-muted-foreground">{student.student_number}</div>}
                        </TableCell>
                        <TableCell><Input type="number" step="0.25" min="0" max="20" value={r.note1 ?? ""} onChange={(e) => updateRow(i, { note1: e.target.value === "" ? null : Number(e.target.value) })} className="w-20" /></TableCell>
                        <TableCell><Select value={String(r.bareme1)} onValueChange={(v) => updateRow(i, { bareme1: Number(v) })}><SelectTrigger className="w-16"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem></SelectContent></Select></TableCell>
                        <TableCell><Input type="number" step="0.25" min="0" max="20" value={r.note2 ?? ""} onChange={(e) => updateRow(i, { note2: e.target.value === "" ? null : Number(e.target.value) })} className="w-20" /></TableCell>
                        <TableCell><Select value={String(r.bareme2)} onValueChange={(v) => updateRow(i, { bareme2: Number(v) })}><SelectTrigger className="w-16"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem></SelectContent></Select></TableCell>
                        {thirdNoteEnabled && <>
                          <TableCell><Input type="number" step="0.25" min="0" max="20" value={r.note3 ?? ""} onChange={(e) => updateRow(i, { note3: e.target.value === "" ? null : Number(e.target.value) })} className="w-20" /></TableCell>
                          <TableCell><Select value={String(r.bareme3)} onValueChange={(v) => updateRow(i, { bareme3: Number(v) })}><SelectTrigger className="w-16"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10">10</SelectItem><SelectItem value="20">20</SelectItem></SelectContent></Select></TableCell>
                        </>}
                        <TableCell className="font-bold">{moy != null ? moy.toFixed(2) : "—"}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => generatePdfFor.mutate(r.user_id)} disabled={generatePdfFor.isPending}>
                            <FileDown className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
