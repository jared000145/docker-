import AcademicValidationStatus from "@/components/admin/AcademicValidationStatus";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Lock, AlertTriangle, Unlock, ShieldAlert, Eye, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { generateClassBulletinsPdf } from "@/lib/bulletinPdf";

const decisionLabel = (decision?: string) => {
  switch ((decision || "").toLowerCase()) {
    case "admis": return "Admis";
    case "admis_conditionnel": return "Passage conditionnel";
    case "redoublant": return "Redoublant";
    case "incomplet": return "Notes incomplètes";
    default: return decision || "—";
  }
};

const decisionBadgeClass = (decision?: string) => {
  switch ((decision || "").toLowerCase()) {
    case "admis": return "bg-success/10 text-success border-success/30";
    case "admis_conditionnel": return "bg-warning/10 text-warning border-warning/30";
    case "redoublant": return "bg-destructive/10 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export default function AdminClosurePage() {
  const { institution, getLevels } = useInstitution();
  const LEVELS = getLevels();
  const { currentYear } = useAcademicYear();
  const qc = useQueryClient();

  const [selectedFilieres, setSelectedFilieres] = useState<string[]>([]);
  const [selectedLevels, setSelectedLevels] = useState<string[]>([]);
  const [preview, setPreview] = useState<any>(null);
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [processing, setProcessing] = useState(false);

  const { data: filieres = [] } = useQuery({
    queryKey: ["filieres-closure", institution?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("filieres").select("id, name")
        .eq("institution_id", institution!.id).order("name");
      return data || [];
    },
    enabled: !!institution?.id,
  });

  const { data: closures = [] } = useQuery({
    queryKey: ["filiere-closures", institution?.id, currentYear],
    queryFn: async () => {
      const { data } = await supabase
        .from("filiere_closures").select("*")
        .eq("institution_id", institution!.id).eq("academic_year", currentYear);
      return data || [];
    },
    enabled: !!institution?.id,
  });

  const { data: academicParams } = useQuery({
    queryKey: ["params-closure", institution?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("parametres_etablissement")
        .select("mode_validation_ue, note_min_validation, mode_calcul_moyenne_semestre")
        .eq("institution_id", institution!.id).maybeSingle();
      return data;
    },
    enabled: !!institution?.id,
  });

  const closedIds = new Set(closures.map((c: any) => c.filiere_id));
  const filiereMap = useMemo(
    () => new Map(filieres.map((f: any) => [f.id, f.name])),
    [filieres]
  );

  const toggleFiliere = (id: string) =>
    setSelectedFilieres((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleLevel = (lv: string) =>
    setSelectedLevels((s) => (s.includes(lv) ? s.filter((x) => x !== lv) : [...s, lv]));

  const filteredResults = useMemo(() => {
    const all = preview?.results || [];
    return all.filter((r: any) => {
      const okF = selectedFilieres.length === 0 || selectedFilieres.includes(r.filiere_id);
      const lv = r.old_level || r.level;
      const okL = selectedLevels.length === 0 || selectedLevels.includes(lv);
      return okF && okL;
    });
  }, [preview, selectedFilieres, selectedLevels]);

  const summary = useMemo(() => {
    const s = { total: filteredResults.length, admis: 0, conditionnel: 0, redoublant: 0 };
    for (const r of filteredResults) {
      const d = (r.decision || "").toLowerCase();
      if (d.includes("admis") && !d.includes("cond")) s.admis++;
      else if (d.includes("cond")) s.conditionnel++;
      else if (d === "redoublant") s.redoublant++;
    }
    return s;
  }, [filteredResults]);

  const runPreview = async () => {
    if (!institution?.id) return;
    if (selectedFilieres.length === 0 && selectedLevels.length === 0) {
      return toast.info("Sélectionnez au moins une filière ou un niveau");
    }
    setPreviewing(true);
    try {
      const { data, error } = await (supabase as any).rpc("academic_results", { _institution: institution.id, _year: currentYear });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setPreview(data);
      toast.success("Aperçu généré");
    } catch (e: any) {
      toast.error("Erreur aperçu : " + (e.message || e));
    } finally {
      setPreviewing(false);
    }
  };

  const partialClose = async () => {
    if (!institution?.id || selectedFilieres.length === 0) return;
    const rows = selectedFilieres
      .filter((id) => !closedIds.has(id))
      .map((id) => ({ institution_id: institution.id, filiere_id: id, academic_year: currentYear }));
    if (rows.length === 0) return toast.info("Filières déjà clôturées");
    const { error } = await supabase.from("filiere_closures").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} filière(s) clôturée(s)`);
    qc.invalidateQueries({ queryKey: ["filiere-closures"] });
  };

  const reopen = async (id: string) => {
    const { error } = await supabase
      .from("filiere_closures").delete()
      .eq("filiere_id", id).eq("academic_year", currentYear);
    if (error) return toast.error(error.message);
    toast.success("Filière rouverte");
    qc.invalidateQueries({ queryKey: ["filiere-closures"] });
  };

  const downloadReleves = async () => {
    if (!filteredResults.length) return toast.error("Aucun étudiant à inclure");
    if (!institution?.id) return;
    setDownloading(true);
    try {
      const { error } = await (supabase as any).rpc("submit_academic_results", {_institution:institution.id,_year:currentYear,_filieres:selectedFilieres.length?selectedFilieres:null,_levels:selectedLevels.length?selectedLevels:null});
      if (error) throw error;
      toast.success("Envoyé au Responsable Pédagogique et au Responsable du Cycle pour validation. Le téléchargement sera disponible après double validation.");
    } catch (e: any) {
      toast.error("Erreur : " + (e.message || e));
    } finally {
      setDownloading(false);
    }
  };

  const finalClose = async () => {
    if (!institution?.id) return;
    setProcessing(true);
    try {
      const { error } = await (supabase as any).rpc("submit_academic_results", {_institution:institution.id,_year:currentYear,_filieres:selectedFilieres.length?selectedFilieres:null,_levels:selectedLevels.length?selectedLevels:null});
      if (error) throw error;
      toast.success("Résultats transmis pour validation et notes verrouillées");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error("Erreur : " + (e.message || e));
    } finally {
      setProcessing(false);
      setConfirmText("");
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Lock className="w-7 h-7 text-destructive" /> Clôture de l'exercice
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Année académique en cours : <strong>{currentYear}</strong>
        </p>
      </motion.div>

      <Tabs defaultValue="partial">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="partial">Clôture partielle</TabsTrigger>
          <TabsTrigger value="final">Transmission pour validation</TabsTrigger>
        </TabsList>

        {/* ─── Clôture partielle ─── */}
        <TabsContent value="partial" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filières</CardTitle>
              <p className="text-xs text-muted-foreground">
                Une filière clôturée passe en lecture seule pour les notes et bulletins.
              </p>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2">
              {filieres.length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune filière.</p>
              )}
              {filieres.map((f: any) => {
                const isClosed = closedIds.has(f.id);
                return (
                  <div key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3 min-w-0">
                      <Checkbox
                        disabled={isClosed}
                        checked={selectedFilieres.includes(f.id) || isClosed}
                        onCheckedChange={() => toggleFiliere(f.id)}
                      />
                      <span className="font-medium truncate">{f.name}</span>
                      {isClosed && (
                        <Badge variant="destructive" className="gap-1 shrink-0">
                          <Lock className="w-3 h-3" /> Clôturée
                        </Badge>
                      )}
                    </div>
                    {isClosed && (
                      <Button variant="ghost" size="sm" className="gap-1" onClick={() => reopen(f.id)}>
                        <Unlock className="w-4 h-4" /> Rouvrir
                      </Button>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Niveaux concernés</CardTitle>
              <p className="text-xs text-muted-foreground">
                Optionnel — restreint l'aperçu et l'export des relevés.
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {LEVELS.map((lv) => {
                const active = selectedLevels.includes(lv);
                return (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => toggleLevel(lv)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card hover:bg-muted border-border"
                    }`}
                  >
                    {lv}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-5 h-5" /> Aperçu avant exécution
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={runPreview} disabled={previewing} className="gap-2">
                  <Eye className="w-4 h-4" />
                  {previewing ? "Calcul…" : "Générer l'aperçu"}
                </Button>
                <Button
                  variant="outline"
                  onClick={downloadReleves}
                  disabled={!preview || downloading || filteredResults.length === 0}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  {downloading ? "Envoi…" : `Envoyer pour vérification & approbation (${filteredResults.length})`}
                </Button>
              </div>

              {preview && (
                <>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-background border">
                      <p className="text-muted-foreground">Étudiants</p>
                      <p className="font-bold text-base">{summary.total}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-success/10 border border-success/30">
                      <p className="text-muted-foreground">Admis</p>
                      <p className="font-bold text-base text-success">{summary.admis}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-warning/10 border border-warning/30">
                      <p className="text-muted-foreground">Conditionnel</p>
                      <p className="font-bold text-base text-warning">{summary.conditionnel}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/30">
                      <p className="text-muted-foreground">Redoublants</p>
                      <p className="font-bold text-base text-destructive">{summary.redoublant}</p>
                    </div>
                  </div>

                  <div className="max-h-72 overflow-auto rounded-lg border divide-y">
                    {filteredResults.slice(0, 200).map((r: any) => (
                      <div key={r.user_id} className="flex items-center justify-between gap-2 p-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {r.last_name} {r.first_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {filiereMap.get(r.filiere_id) || r.filiere_name || "—"} ·{" "}
                            {r.old_level || r.level || "—"} · Moy. pondérée{" "}
                            {(() => {
                              const v = r.general_average ?? r.annual_average ?? r.average;
                              return v != null ? Number(v).toFixed(2) + "/20" : "—";
                            })()}
                          </p>
                        </div>
                        <Badge variant="outline" className={`shrink-0 ${decisionBadgeClass(r.decision)}`}>
                          {decisionLabel(r.decision)}
                        </Badge>
                      </div>
                    ))}
                    {filteredResults.length === 0 && (
                      <p className="p-3 text-sm text-muted-foreground text-center">
                        Aucun étudiant pour ces critères.
                      </p>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                disabled={selectedFilieres.length === 0}
                className="w-full gap-2"
                variant="destructive"
                size="lg"
              >
                <Lock className="w-4 h-4" />
                Clôturer {selectedFilieres.length} filière(s)
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la clôture partielle</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>
                      Les filières suivantes passeront en lecture seule pour {currentYear} :
                    </p>
                    <ul className="list-disc ml-5 text-sm">
                      {selectedFilieres.map((id) => (
                        <li key={id}>{filiereMap.get(id) || id}</li>
                      ))}
                    </ul>
                    {selectedLevels.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Niveaux ciblés : {selectedLevels.join(", ")}
                      </p>
                    )}
                    {preview && (
                      <p className="text-xs">
                        <FileText className="inline w-3 h-3 mr-1" />
                        Aperçu : {summary.total} étudiants · {summary.admis} admis ·{" "}
                        {summary.redoublant} redoublants
                      </p>
                    )}
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={partialClose}>Confirmer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        {/* ─── Transmission pour validation ─── */}
        <TabsContent value="final" className="space-y-4">
          <Card className="border-destructive/40 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <ShieldAlert className="w-5 h-5" /> Clôture définitive de l'année {currentYear}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <ul className="list-disc ml-5 space-y-1 text-muted-foreground">
                <li>Archive l'année en cours pour tout l'établissement</li>
                <li>Verrouille toutes les notes et bulletins</li>
                <li>Calcule les crédits et fait passer les admis (L1 → L2…)</li>
                <li>Initialise la nouvelle année académique comme active</li>
              </ul>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full gap-2 h-12 text-base">
                    <AlertTriangle className="w-5 h-5" /> Clôturer définitivement
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-destructive">Action irréversible</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-3">
                        <span className="block">
                          Tapez <strong>CLOTURER {currentYear}</strong> pour confirmer.
                        </span>
                        <Input
                          value={confirmText}
                          onChange={(e) => setConfirmText(e.target.value)}
                          placeholder={`CLOTURER ${currentYear}`}
                        />
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setConfirmText("")}>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={confirmText !== `CLOTURER ${currentYear}` || processing}
                      onClick={finalClose}
                    >
                      {processing ? "Traitement…" : "Confirmer"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <AcademicValidationStatus institution={institution} year={currentYear} />
    </div>
  );
}
