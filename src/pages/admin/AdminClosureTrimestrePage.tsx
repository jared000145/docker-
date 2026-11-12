import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { useAcademicYear } from "@/hooks/useAcademicYear";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Lock, Unlock, ShieldAlert, CheckCircle2, CalendarClock, Eye, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { matiereAverage, trimestreAverage } from "@/lib/collegeLycee";
import { buildTrimestreBulletinBlob, fetchClassStudents } from "@/lib/buildTrimestreBulletin";

const TRIMESTRES = [
  { key: "T1", label: "Trimestre 1", description: "Clôture des notes T1" },
  { key: "T2", label: "Trimestre 2", description: "Clôture des notes T2" },
  { key: "T3", label: "Trimestre 3", description: "Clôture finale — calcule les décisions annuelles (Admis/Redoublant/Exclu)" },
] as const;

export default function AdminClosureTrimestrePage() {
  const { institution } = useInstitution();
  const { currentYear } = useAcademicYear();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [confirmText, setConfirmText] = useState("");
  const [processing, setProcessing] = useState<string | null>(null);
  const [previewTrimestre, setPreviewTrimestre] = useState<"T1" | "T2" | "T3" | null>(null);
  const [previewClasses, setPreviewClasses] = useState<any[]>([]);
  const [previewClasseId, setPreviewClasseId] = useState("");
  const [previewStudents, setPreviewStudents] = useState<any[]>([]);
  const [previewStudentId, setPreviewStudentId] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  /** Ouvre l'aperçu des bulletins du trimestre (avant envoi au Directeur). */
  const openPreview = async (t: "T1" | "T2" | "T3") => {
    if (!institution?.id) return;
    setPreviewTrimestre(t);
    setPreviewUrl(null);
    setPreviewStudentId("");
    setPreviewStudents([]);
    setPreviewLoading(true);
    try {
      const { data: classes } = await (supabase as any)
        .from("classes").select("id,nom,niveau,serie,cycle")
        .eq("institution_id", institution.id)
        .eq("academic_year", currentYear)
        .order("nom");
      setPreviewClasses(classes || []);
      setPreviewClasseId(classes?.[0]?.id || "");
    } catch (e: any) {
      toast.error(e.message);
    }
    setPreviewLoading(false);
  };

  const loadPreviewStudents = async (classeId: string) => {
    setPreviewClasseId(classeId);
    setPreviewStudentId("");
    setPreviewUrl(null);
    const classe = previewClasses.find((c) => c.id === classeId);
    if (!classe || !institution?.id) return;
    setPreviewLoading(true);
    try {
      const list = await fetchClassStudents(institution.id, currentYear, classe);
      setPreviewStudents(list);
    } catch (e: any) {
      toast.error(e.message);
    }
    setPreviewLoading(false);
  };

  const generatePreview = async (userId: string) => {
    setPreviewStudentId(userId);
    const classe = previewClasses.find((c) => c.id === previewClasseId);
    const student = previewStudents.find((s) => s.user_id === userId);
    if (!classe || !student || !previewTrimestre || !institution) return;
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const blob = await buildTrimestreBulletinBlob({
        institution,
        student,
        classe,
        trimestre: previewTrimestre,
        academicYear: currentYear,
        classStudents: previewStudents,
      });
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e: any) {
      toast.error(e.message || "Impossible de générer l'aperçu");
    }
    setPreviewLoading(false);
  };


  const { data: closures = [] } = useQuery({
    queryKey: ["trimestre-closures", institution?.id, currentYear],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("trimestre_closures")
        .select("*")
        .eq("institution_id", institution!.id)
        .eq("academic_year", currentYear);
      if (error) throw error;
      return data || [];
    },
    enabled: !!institution?.id,
  });

  const isClosed = (t: string) => closures.some((c: any) => c.trimestre === t);
  const closureRow = (t: string) => closures.find((c: any) => c.trimestre === t);

  /** Génère un dossier de bulletins par classe et l'envoie au Directeur pour vérification/signature. */
  const sendBulletinsToDirector = async (t: string): Promise<number> => {
    if (!institution?.id) return 0;
    const { data: classes } = await (supabase as any)
      .from("classes")
      .select("id,nom,niveau,serie")
      .eq("institution_id", institution.id)
      .eq("academic_year", currentYear);
    if (!classes?.length) return 0;

    const { data: grades } = await (supabase as any)
      .from("grades_trimestre")
      .select("user_id,classe_id,matiere,note1,bareme1,note2,bareme2,note3,bareme3,coefficient")
      .eq("institution_id", institution.id)
      .eq("academic_year", currentYear)
      .eq("trimestre", t);

    const docs: any[] = [];
    for (const c of classes as any[]) {
      const rows = (grades || []).filter((g: any) => g.classe_id === c.id);
      if (rows.length === 0) continue;
      const byStudent = new Map<string, { moyenne: number | null; coefficient: number }[]>();
      rows.forEach((g: any) => {
        const list = byStudent.get(g.user_id) || [];
        list.push({
          moyenne: matiereAverage(g.note1, g.bareme1, g.note2, g.bareme2, g.note3, g.bareme3),
          coefficient: Number(g.coefficient) || 1,
        });
        byStudent.set(g.user_id, list);
      });
      const eleves = Array.from(byStudent.entries())
        .map(([user_id, lignes]) => ({ user_id, moyenne: trimestreAverage(lignes) }))
        .sort((a, b) => (b.moyenne ?? -1) - (a.moyenne ?? -1))
        .map((e, i) => ({ ...e, rang: i + 1 }));

      docs.push({
        institution_id: institution.id,
        document_type: "bulletin",
        academic_year: currentYear,
        title: `Bulletins ${t} — ${c.nom} (${c.niveau}${c.serie ? " " + c.serie : ""}) — ${eleves.length} élève(s)`,
        status: "pending",
        payload: {
          kind: "class_bulletins_trimestre",
          trimestre: t,
          academicYear: currentYear,
          classe: { id: c.id, nom: c.nom, niveau: c.niveau, serie: c.serie },
          effectif: eleves.length,
          eleves,
        },
      });
    }
    if (docs.length === 0) return 0;
    const { error } = await (supabase as any).from("document_validations").insert(docs);
    if (error) throw error;
    return docs.length;
  };

  const closeTrimestre = async (t: string) => {
    if (!institution?.id || !user?.id) return;
    setProcessing(t);
    try {
      const {data:sent,error}=await (supabase as any).rpc('submit_trimester_results',{_institution:institution.id,_year:currentYear,_trimester:t});if(error)throw error;
      toast.success(`${t} transmis pour validation. Les notes et le planning historique sont conserv?s.`);
      if (sent > 0) toast.success(`${sent} dossier(s) de bulletins envoyé(s) au Directeur pour vérification et signature.`);
      else toast.info("Aucune note trouvée : aucun bulletin envoyé au Directeur.");
      qc.invalidateQueries({ queryKey: ["trimestre-closures"] });

    } catch (e: any) {
      toast.error("Erreur : " + (e.message || e));
    } finally {
      setProcessing(null);
      setConfirmText("");
    }
  };

  const reopen = async (t: string) => {
    if (!institution?.id) return;
    const { error } = await (supabase as any)
      .from("trimestre_closures").delete()
      .eq("institution_id", institution.id)
      .eq("academic_year", currentYear)
      .eq("trimestre", t);
    if (error) return toast.error(error.message);
    toast.success(`${t} rouvert`);
    qc.invalidateQueries({ queryKey: ["trimestre-closures"] });
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <CalendarClock className="w-7 h-7 text-primary" /> Clôture trimestrielle
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Année {currentYear} — Collège / Lycée
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TRIMESTRES.map((t) => {
          const closed = isClosed(t.key);
          const row = closureRow(t.key);
          const canCloseT3 = t.key !== "T3" || (isClosed("T1") && isClosed("T2"));
          return (
            <Card key={t.key} className={closed ? "border-success/40 bg-success/5" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{t.label}</span>
                  {closed ? (
                    <Badge className="bg-success/10 text-success border-success/30 gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Clôturé
                    </Badge>
                  ) : (
                    <Badge variant="outline">Ouvert</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">{t.description}</p>
                {closed && row?.closed_at && (
                  <p className="text-xs text-muted-foreground">
                    Clôturé le {new Date(row.closed_at).toLocaleDateString("fr-FR")}
                  </p>
                )}

                <Button variant="outline" className="w-full gap-2" onClick={() => openPreview(t.key as any)}>
                  <Eye className="w-4 h-4" /> Prévisualiser les bulletins
                </Button>

                {!closed ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="w-full gap-2"
                        variant={t.key === "T3" ? "destructive" : "default"}
                        disabled={!canCloseT3 || processing === t.key}
                      >
                        <Lock className="w-4 h-4" />
                        {t.key === "T3" ? "Clôture finale" : `Clôturer ${t.key}`}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t.key === "T3" ? "Clôture finale de l'année" : `Clôturer ${t.label}`}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-3">
                            <p>
                              {t.key === "T3"
                                ? `Cette action verrouille définitivement les notes de ${t.label}, calcule la moyenne annuelle pondérée (T1+T2+T3) et applique les décisions annuelles selon le seuil d'admission et le quota d'absences.`
                                : `Les notes de ${t.label} passeront en lecture seule pour tous les enseignants.`}
                            </p>
                            {t.key === "T3" && (
                              <>
                                <p className="text-sm">
                                  Tapez <strong>CLOTURER {currentYear}</strong> pour confirmer.
                                </p>
                                <Input
                                  value={confirmText}
                                  onChange={(e) => setConfirmText(e.target.value)}
                                  placeholder={`CLOTURER ${currentYear}`}
                                />
                              </>
                            )}
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setConfirmText("")}>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          disabled={
                            (t.key === "T3" && confirmText !== `CLOTURER ${currentYear}`) ||
                            processing === t.key
                          }
                          onClick={() => closeTrimestre(t.key)}
                        >
                          {processing === t.key ? "Traitement…" : "Confirmer"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button variant="outline" className="w-full gap-2" onClick={() => reopen(t.key)}>
                    <Unlock className="w-4 h-4" /> Rouvrir
                  </Button>
                )}

                {t.key === "T3" && !canCloseT3 && !closed && (
                  <p className="text-xs text-warning flex items-start gap-1">
                    <ShieldAlert className="w-3 h-3 mt-0.5 shrink-0" />
                    Clôturez T1 et T2 avant de finaliser l'année.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!previewTrimestre} onOpenChange={(o) => { if (!o) { setPreviewTrimestre(null); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" /> Aperçu des bulletins {previewTrimestre} — {currentYear}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm mb-1 block">Classe</label>
              <Select value={previewClasseId} onValueChange={loadPreviewStudents}>
                <SelectTrigger><SelectValue placeholder="Choisir une classe…" /></SelectTrigger>
                <SelectContent>
                  {previewClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nom} ({c.niveau}{c.serie ? ` ${c.serie}` : ""})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm mb-1 block">Élève</label>
              <Select value={previewStudentId} onValueChange={generatePreview} disabled={previewStudents.length === 0}>
                <SelectTrigger><SelectValue placeholder={previewStudents.length ? "Choisir un élève…" : "Sélectionnez une classe"} /></SelectTrigger>
                <SelectContent>
                  {previewStudents.map((s) => (
                    <SelectItem key={s.user_id} value={s.user_id}>{s.last_name} {s.first_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {previewLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Génération de l'aperçu…
            </div>
          )}

          {previewUrl ? (
            <iframe src={previewUrl} title="Aperçu bulletin" className="w-full h-[60vh] rounded-lg border border-border" />
          ) : (
            !previewLoading && (
              <p className="text-sm text-muted-foreground text-center py-10">
                Choisissez une classe puis un élève pour visualiser le bulletin réel avant l'envoi au Directeur.
              </p>
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

