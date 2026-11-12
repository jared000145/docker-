import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useCycle } from "@/hooks/useCycle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Settings2, Save, CheckCircle2, ShieldAlert, GraduationCap, Users2, Calculator, CalendarDays } from "lucide-react";
import { AcademicYearSelector } from '@/components/AcademicYearSelector';
import { toast } from "sonner";
import { motion } from "framer-motion";

function ExamBlancCandidatesList({ institutionId, academicYear }: { institutionId: string; academicYear: string }) {
  const { data: rows = [] } = useQuery({
    queryKey: ["exam-blanc-list", institutionId, academicYear],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("exam_blanc_candidats")
        .select("type, numero_candidat, user_id, profiles:profiles!inner(first_name, last_name, level, student_number)")
        .eq("institution_id", institutionId)
        .eq("academic_year", academicYear)
        .order("type").order("numero_candidat");
      return data || [];
    },
    enabled: !!institutionId,
  });
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users2 className="w-5 h-5 text-primary" />Candidats aux examens blancs</CardTitle>
        <CardDescription>{rows.length} candidat(s) — année {academicYear}.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2 pr-3">N° Candidat</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Nom</th><th className="py-2 pr-3">Classe</th></tr>
            </thead>
            <tbody>
              {rows.map((r: any) => (
                <tr key={r.type + r.numero_candidat} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-mono font-semibold text-accent">{r.numero_candidat}</td>
                  <td className="py-2 pr-3"><span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs">{r.type}</span></td>
                  <td className="py-2 pr-3">{r.profiles?.last_name} {r.profiles?.first_name}</td>
                  <td className="py-2 pr-3">{r.profiles?.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminAcademicSettingsPage() {
  const { institution } = useInstitution();
  const { selectedYear } = useAcademicYear();
  const { hasUniversite, hasCollege, hasLycee } = useCycle();
  const showUni = hasUniversite;
  const showScolaire = hasCollege || hasLycee;
  const qc = useQueryClient();

  // Universitaire (existant)
  const [mode, setMode] = useState<"STRICT" | "MOYENNE">("MOYENNE");
  const [noteMin, setNoteMin] = useState<number>(10);
  const [quotaAbsence, setQuotaAbsence] = useState<number>(10);
  const [modeCalcul, setModeCalcul] = useState<"MOYENNE_UE_PONDEREE" | "MOYENNE_UE_SIMPLE" | "MOYENNE_MATIERES_SIMPLE" | "MOYENNE_MATIERES_PONDEREE">("MOYENNE_UE_PONDEREE");

  // Scolaire (Collège / Lycée)
  const [quotaAnnuel, setQuotaAnnuel] = useState<number>(48);
  const [passThreshold, setPassThreshold] = useState<number>(10);
  const [examBlancEnabled, setExamBlancEnabled] = useState<boolean>(false);
  const [examBlancBEPC, setExamBlancBEPC] = useState<boolean>(false);
  const [examBlancBAC, setExamBlancBAC] = useState<boolean>(false);

  const { data: params, isLoading } = useQuery({
    queryKey: ["params-etablissement", institution?.id],
    queryFn: async () => {
      const { data } = await supabase.from("parametres_etablissement").select("*").eq("institution_id", institution!.id).maybeSingle();
      return data;
    },
    enabled: !!institution?.id,
  });

  useEffect(() => {
    if (params) {
      setMode((params.mode_validation_ue as "STRICT" | "MOYENNE") || "MOYENNE");
      setNoteMin(Number(params.note_min_validation) || 10);
      setQuotaAbsence(Number((params as any).quota_absence_hours) || 10);
      setModeCalcul(((params as any).mode_calcul_moyenne_semestre as any) || "MOYENNE_UE_PONDEREE");
    }
  }, [params]);

  useEffect(() => {
    if (institution) {
      const inst: any = institution;
      setQuotaAnnuel(Number(inst.quota_absence_hours_annuel) || 48);
      setPassThreshold(Number(inst.pass_threshold) || 10);
      setExamBlancEnabled(!!inst.exam_blanc_enabled);
      const types: string[] = Array.isArray(inst.exam_blanc_types) ? inst.exam_blanc_types : [];
      setExamBlancBEPC(types.includes("BEPC"));
      setExamBlancBAC(types.includes("BAC"));
    }
  }, [institution]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        mode_validation_ue: mode,
        note_min_validation: noteMin,
        quota_absence_hours: quotaAbsence,
        mode_calcul_moyenne_semestre: modeCalcul,
      };
      if (params?.id) {
        const { error } = await supabase.from("parametres_etablissement").update(payload).eq("id", params.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("parametres_etablissement").insert({
          institution_id: institution!.id, ...payload,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      qc.invalidateQueries({ queryKey: ["params-etablissement"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveScolaire = useMutation({
    mutationFn: async () => {
      const types: string[] = [];
      if (examBlancBEPC) types.push("BEPC");
      if (examBlancBAC) types.push("BAC");
      const wasEnabled = !!(institution as any)?.exam_blanc_enabled;
      const { error } = await (supabase as any).from("institutions").update({
        quota_absence_hours_annuel: quotaAnnuel,
        pass_threshold: passThreshold,
        exam_blanc_enabled: examBlancEnabled,
        exam_blanc_types: types,
      }).eq("id", institution!.id);
      if (error) throw error;
      // Génération auto des numéros de candidats si on active
      if (examBlancEnabled && types.length > 0 && (!wasEnabled || true)) {
        const { data, error: rpcErr } = await (supabase as any).rpc("generate_exam_blanc_candidats", {
          _institution_id: institution!.id,
          _academic_year: selectedYear,
        });
        if (rpcErr) throw rpcErr;
        return data as number;
      }
      return 0;
    },
    onSuccess: (n) => {
      toast.success(`Paramètres Collège/Lycée enregistrés${n ? ` — ${n} candidat(s) inscrit(s)` : ""}`);
      qc.invalidateQueries({ queryKey: ["institution"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="academic-settings space-y-6">
      <motion.div className="flex flex-wrap items-center justify-between gap-4" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Settings2 className="w-8 h-8 text-primary" />
          Paramètres académiques
        </h1>
        <p className="text-muted-foreground mt-1">
          {showUni && showScolaire ? "Règles universitaires et scolaires." :
           showScolaire ? "Règles scolaires (Collège / Lycée)." :
           "Règles universitaires (LMD)."}
        </p></div><AcademicYearSelector />
      </motion.div>

      <nav className="academic-section-nav" aria-label="Sections des paramètres académiques">
        {showUni&&<><a href="#academic-validation"><CheckCircle2/>Validation</a><a href="#academic-calcul"><Calculator/>Moyennes et crédits</a><a href="#academic-absences"><CalendarDays/>Absences</a></>}
        {showScolaire&&<><a href="#academic-scolaire"><Users2/>Règles scolaires</a><a href="#academic-examens"><GraduationCap/>Examens blancs</a></>}
      </nav>

      {showUni && (
        <>
      <Card id="academic-validation">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-primary" />Mode de validation des UE</CardTitle>
          <CardDescription>Définissez comment une UE est considérée comme validée</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? <div className="h-32 bg-muted/30 animate-pulse rounded" /> : (
            <>
              <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)} className="space-y-3">
                <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${mode === "STRICT" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                  <RadioGroupItem value="STRICT" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-semibold flex items-center gap-2">
                      Mode STRICT
                      {mode === "STRICT" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      L'UE est validée uniquement si <strong>toutes</strong> les matières ont une note ≥ seuil ({noteMin}/20)
                    </p>
                  </div>
                </label>
                <label className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${mode === "MOYENNE" ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                  <RadioGroupItem value="MOYENNE" className="mt-1" />
                  <div className="flex-1">
                    <div className="font-semibold flex items-center gap-2">
                      Mode MOYENNE
                      {mode === "MOYENNE" && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      L'UE est validée si la <strong>moyenne pondérée</strong> des matières (notes × coefficients) ≥ seuil ({noteMin}/20)
                    </p>
                  </div>
                </label>
              </RadioGroup>

              <div className="border-t pt-4">
                <Label htmlFor="noteMin">Note minimale de validation</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input id="noteMin" type="number" min={0} max={20} step={0.5} value={noteMin} onChange={e => setNoteMin(Number(e.target.value))} className="w-32" />
                  <span className="text-muted-foreground">/ 20</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card id="academic-calcul">
        <CardHeader>
          <CardTitle>Méthode de calcul de la moyenne du semestre</CardTitle>
          <CardDescription>Choisissez comment la moyenne générale du semestre est calculée</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={modeCalcul} onValueChange={(v: any) => setModeCalcul(v)} className="space-y-3">
            {[
              { v: "MOYENNE_UE_PONDEREE", t: "Moyenne pondérée des UE (par crédits)", d: "Moyenne semestre = Σ(moy UE × crédits UE) ÷ Σ(crédits UE). Recommandé en système LMD." },
              { v: "MOYENNE_UE_SIMPLE", t: "Moyenne simple des UE", d: "Moyenne semestre = Σ(moyennes des UE) ÷ nombre total d'UE du semestre." },
              { v: "MOYENNE_MATIERES_SIMPLE", t: "Moyenne simple des matières", d: "Moyenne semestre = Σ(moyennes des matières) ÷ nombre total de matières." },
              { v: "MOYENNE_MATIERES_PONDEREE", t: "Moyenne pondérée des matières (par coefficient)", d: "Moyenne semestre = Σ(moy matière × coefficient) ÷ Σ(coefficients)." },
            ].map((opt) => (
              <label key={opt.v} className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${modeCalcul === opt.v ? "border-primary bg-primary/5" : "border-border hover:bg-muted/30"}`}>
                <RadioGroupItem value={opt.v} className="mt-1" />
                <div className="flex-1">
                  <div className="font-semibold flex items-center gap-2">
                    {opt.t}
                    {modeCalcul === opt.v && <CheckCircle2 className="w-4 h-4 text-primary" />}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{opt.d}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card id="academic-absences">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-warning" />
            Quota d'heures d'absence (universitaire, par matière)
          </CardTitle>
          <CardDescription>
            Nombre maximum d'heures d'absence autorisées par matière. Au-delà, l'étudiant ne peut pas passer l'examen.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="quota">Quota maximal (heures par matière)</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="quota"
                type="number"
                min={0}
                step={0.5}
                value={quotaAbsence}
                onChange={(e) => setQuotaAbsence(Number(e.target.value))}
                className="w-32"
              />
              <span className="text-muted-foreground">heures</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Mettez <strong>0</strong> pour désactiver totalement la limite.
            </p>
          </div>

          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="w-full md:w-auto">
            <Save className="w-4 h-4 mr-2" />
            {saveMutation.isPending ? "Enregistrement..." : "Enregistrer les règles universitaires"}
          </Button>
        </CardContent>
      </Card>
        </>
      )}

      {showScolaire && (
        <>
          <Card id="academic-scolaire">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users2 className="w-5 h-5 text-primary" />Règles scolaires (Collège / Lycée)</CardTitle>
              <CardDescription>Quota d'heures d'absence annuel et seuil d'admission de fin d'année.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label htmlFor="quotaAnnuel">Quota annuel d'heures d'absence</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input id="quotaAnnuel" type="number" min={0} value={quotaAnnuel}
                    onChange={(e) => setQuotaAnnuel(Number(e.target.value))} className="w-32" />
                  <span className="text-muted-foreground">heures / an</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Au-delà de ce seuil, l'élève est automatiquement exclu (statut : exclu — quota dépassé).
                </p>
              </div>

              <div className="border-t pt-4">
                <Label htmlFor="passThreshold">Moyenne minimale de passage en classe supérieure</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Input id="passThreshold" type="number" min={0} max={20} step={0.25}
                    value={passThreshold} onChange={(e) => setPassThreshold(Number(e.target.value))} className="w-32" />
                  <span className="text-muted-foreground">/ 20</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Utilisée à la clôture T3 pour décider Admis / Redoublant.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card id="academic-examens">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-primary" />Mode examen blanc</CardTitle>
              <CardDescription>Génère automatiquement un numéro de candidat pour les élèves en classe d'examen.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="font-semibold">Activer le mode examen blanc</div>
                  <p className="text-sm text-muted-foreground">Les élèves reçoivent une notification et un numéro de candidat.</p>
                </div>
                <Switch checked={examBlancEnabled} onCheckedChange={setExamBlancEnabled} />
              </div>

              {examBlancEnabled && (
                <div className="grid gap-3 pl-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox checked={examBlancBEPC} onCheckedChange={(v) => setExamBlancBEPC(!!v)} />
                    <div>
                      <div className="font-medium">BEPC blanc</div>
                      <p className="text-xs text-muted-foreground">Cible : élèves de 3ème.</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <Checkbox checked={examBlancBAC} onCheckedChange={(v) => setExamBlancBAC(!!v)} />
                    <div>
                      <div className="font-medium">BAC blanc</div>
                      <p className="text-xs text-muted-foreground">Cible : élèves de Terminale.</p>
                    </div>
                  </label>
                </div>
              )}

              <Button onClick={() => saveScolaire.mutate()} disabled={saveScolaire.isPending} className="w-full md:w-auto">
                <Save className="w-4 h-4 mr-2" />
                {saveScolaire.isPending ? "Enregistrement…" : "Enregistrer les règles Collège / Lycée"}
              </Button>
            </CardContent>
          </Card>

          {examBlancEnabled && <ExamBlancCandidatesList institutionId={institution!.id} academicYear={selectedYear} />}
        </>
      )}
    </div>
  );
}
