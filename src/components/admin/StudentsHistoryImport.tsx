import {saveWorkbook} from "@/lib/nativeExports";
import { useState, useRef } from "react";
import { Upload, Download, FileSpreadsheet, AlertCircle, CheckCircle2, Loader2, X, History, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface HistoryRow {
  nom: string;
  prenom: string;
  filiere: string;
  niveau: string;
  annee_scolaire: string;
  statut: string;
  date_naissance?: string;
  notes?: string;
  paiements?: string;
  rattrapages?: string;
  error?: string;
}

interface Props {
  institutionId: string;
  onImportComplete: () => void;
}

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["nom", "prenom", "filiere", "niveau", "annee_scolaire", "statut", "date_naissance", "notes", "paiements", "rattrapages"],
    [
      "Koné", "Ama", "Informatique", "L1", "2022-2023", "non-boursier", "2003-04-12",
      "Mathématiques:14/12:S1;Physique:10/15:S1;Algorithmique:13/16:S2",
      "Frais administratifs:210000:paid;Frais scolarité:990000:paid;Uniforme:200000:paid",
      "",
    ],
    [
      "Koné", "Ama", "Informatique", "L2", "2023-2024", "non-boursier", "2003-04-12",
      "Bases de données:12/14:S1;Web:15/16:S1;Réseaux:9/11:S2",
      "Frais administratifs:210000:paid;Frais scolarité:990000:paid",
      "Réseaux:11:passed",
    ],
    [
      "Koné", "Ama", "Informatique", "L3", "2024-2025", "non-boursier", "2003-04-12",
      "Génie Logiciel:13/15:S1;IA:16/17:S1",
      "Frais administratifs:210000:paid;Frais scolarité:500000:pending",
      "",
    ],
  ]);
  ws["!cols"] = [
    { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
    { wch: 60 }, { wch: 60 }, { wch: 30 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Historique");
  saveWorkbook(wb, "modele_import_historique_etudiants.xlsx");
}

export default function StudentsHistoryImport({ institutionId, onImportComplete }: Props) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    success: number; errors: number; students: number; years: number;
    grades: number; payments: number; rattrapages: number;
    autoRattrapages: number; creditsValidated: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function parseFile(file: File) {
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        const parsed: HistoryRow[] = json.map((r) => {
          const nom = String(r.nom || r.Nom || r.NOM || "").trim();
          const prenom = String(r.prenom || r.Prenom || r.prénom || r.Prénom || "").trim();
          const filiere = String(r.filiere || r.filière || r.Filière || "").trim();
          const niveau = String(r.niveau || r.Niveau || "").trim();
          const annee_scolaire = String(r.annee_scolaire || r.année_scolaire || r["année scolaire"] || r.annee || "").trim();
          const statut = String(r.statut || r.Statut || "non-boursier").trim().toLowerCase();
          const date_naissance = String(r.date_naissance || r.Date_naissance || r["date de naissance"] || r.naissance || "").trim();
          const notes = String(r.notes || r.Notes || "").trim();
          const paiements = String(r.paiements || r.Paiements || "").trim();
          const rattrapages = String(r.rattrapages || r.Rattrapages || "").trim();

          const errs: string[] = [];
          if (!nom) errs.push("Nom manquant");
          if (!prenom) errs.push("Prénom manquant");
          if (!niveau) errs.push("Niveau manquant");
          if (!annee_scolaire) errs.push("Année manquante");
          if (annee_scolaire && !/^\d{4}-\d{4}$/.test(annee_scolaire)) errs.push("Année invalide (ex: 2024-2025)");

          return {
            nom, prenom, filiere, niveau, annee_scolaire, statut, date_naissance,
            notes, paiements, rattrapages,
            error: errs.length ? errs.join(", ") : undefined,
          };
        });

        setRows(parsed);
        if (!parsed.length) toast.error("Le fichier est vide");
      } catch {
        toast.error("Impossible de lire le fichier Excel");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const validRows = rows.filter((r) => !r.error);
  const errorRows = rows.filter((r) => !!r.error);

  const distinctStudents = new Set(validRows.map(r => `${r.nom.toLowerCase()}|${r.prenom.toLowerCase()}`)).size;

  async function handleImport() {
    if (!validRows.length) return;
    setImporting(true);
    setProgress(0);

    let success = 0, errors = 0;
    const studentsSet = new Set<string>();
    let yearsCreated = 0, gradesCreated = 0, paymentsCreated = 0, rattrapagesCreated = 0;
    let autoRattrapagesCreated = 0, totalCreditsValidated = 0;

    const order = ["L1", "L2", "L3", "M1", "M2", "6ème", "5ème", "4ème", "3ème", "2nde", "1ère", "Terminale"];
    const sorted = [...validRows].sort((a, b) => {
      const k1 = `${a.nom}|${a.prenom}`, k2 = `${b.nom}|${b.prenom}`;
      if (k1 !== k2) return k1.localeCompare(k2);
      return order.indexOf(a.niveau) - order.indexOf(b.niveau);
    });

    for (let i = 0; i < sorted.length; i++) {
      const row = sorted[i];
      try {
        const res = await supabase.functions.invoke("import-student-history", {
          body: { row, institution_id: institutionId },
        });
        if (res.error || res.data?.error) {
          errors++;
        } else {
          success++;
          studentsSet.add(res.data.matricule);
          yearsCreated += res.data.created_years || 0;
          gradesCreated += res.data.grades || 0;
          paymentsCreated += res.data.payments || 0;
          rattrapagesCreated += res.data.rattrapages || 0;
          autoRattrapagesCreated += res.data.auto_rattrapages || 0;
          totalCreditsValidated += res.data.credits_acquired || 0;
        }
      } catch {
        errors++;
      }
      setProgress(Math.round(((i + 1) / sorted.length) * 100));
    }

    setResult({
      success, errors, students: studentsSet.size,
      years: yearsCreated, grades: gradesCreated,
      payments: paymentsCreated, rattrapages: rattrapagesCreated,
      autoRattrapages: autoRattrapagesCreated,
      creditsValidated: totalCreditsValidated,
    });
    setImporting(false);
    if (success > 0) onImportComplete();
  }

  function reset() {
    setRows([]);
    setResult(null);
    setProgress(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <Card className="glass-card-elevated border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="w-5 h-5 text-accent" />
          Import historique complet (étudiants + années + données)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
          Importez vos étudiants depuis un ancien système avec leur historique multi-années.
          Une ligne = une année par étudiant. Les années manquantes (ex: L1, L2 pour un L3) seront créées automatiquement.
          Les filières et matières inconnues seront créées à la volée.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-accent/30 bg-accent/5">
          <Sparkles className="h-4 w-4 text-accent" />
          <AlertTitle className="text-sm">Format des cellules multi-valeurs</AlertTitle>
          <AlertDescription className="text-xs space-y-1 mt-1">
            <div><b>notes</b> : <code className="bg-muted px-1 rounded">Maths:14/12:S1;Physique:10/15:S1</code> (matière:CC/exam:semestre)</div>
            <div><b>paiements</b> : <code className="bg-muted px-1 rounded">Frais scolarité:990000:paid;Uniforme:200000:pending</code></div>
            <div><b>rattrapages</b> : <code className="bg-muted px-1 rounded">Maths:12:passed</code> (matière:note:statut)</div>
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
            <Download className="w-4 h-4" /> Télécharger le modèle
          </Button>
          <Button
            size="sm"
            className="gap-2 gradient-gold text-accent-foreground"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            <Upload className="w-4 h-4" /> Charger un fichier Excel
          </Button>
          <input
            ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
          />
          {rows.length > 0 && !importing && (
            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={reset}>
              <X className="w-4 h-4" /> Réinitialiser
            </Button>
          )}
        </div>

        {result && (
          <Alert
            variant={result.errors > 0 ? "destructive" : "default"}
            className={result.errors === 0 ? "border-success/50 bg-success/10" : ""}
          >
            {result.errors === 0
              ? <CheckCircle2 className="h-4 w-4 text-success" />
              : <AlertCircle className="h-4 w-4" />}
            <AlertTitle>
              {result.errors === 0 ? "Import historique réussi !" : "Import terminé avec erreurs"}
            </AlertTitle>
            <AlertDescription className="space-y-1 text-xs mt-1">
              <div>✓ <b>{result.students}</b> étudiant(s) créé(s)/mis à jour</div>
              <div>✓ <b>{result.years}</b> année(s) académique(s) reconstruite(s)</div>
              <div>✓ <b>{result.grades}</b> note(s), <b>{result.payments}</b> paiement(s)</div>
              <div>🎓 <b>{result.creditsValidated}</b> crédit(s) ECTS validé(s) automatiquement</div>
              {result.autoRattrapages > 0 && (
                <div className="text-accent">⚠ <b>{result.autoRattrapages}</b> rattrapage(s) auto-créé(s) (matières non validées, moyenne &lt; 10)</div>
              )}
              {result.rattrapages > 0 && <div>📝 <b>{result.rattrapages}</b> rattrapage(s) historique(s) importé(s)</div>}
              {result.errors > 0 && <div className="text-destructive">✗ {result.errors} ligne(s) en erreur</div>}
            </AlertDescription>
          </Alert>
        )}

        {importing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              Import en cours... {progress}%
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {rows.length > 0 && !result && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="secondary">{rows.length} ligne(s)</Badge>
              <Badge variant="secondary" className="bg-success/15 text-success border-success/30">
                {validRows.length} valide(s)
              </Badge>
              <Badge variant="secondary" className="bg-accent/15 text-accent border-accent/30">
                ≈ {distinctStudents} étudiant(s) distinct(s)
              </Badge>
              {errorRows.length > 0 && <Badge variant="destructive">{errorRows.length} erreur(s)</Badge>}
            </div>

            <div className="max-h-72 overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-secondary/80 backdrop-blur-sm">
                  <tr>
                    <th className="text-left p-2 font-semibold">#</th>
                    <th className="text-left p-2 font-semibold">Étudiant</th>
                    <th className="text-left p-2 font-semibold">Filière</th>
                    <th className="text-left p-2 font-semibold">Niveau</th>
                    <th className="text-left p-2 font-semibold">Année</th>
                    <th className="text-left p-2 font-semibold">Données</th>
                    <th className="text-left p-2 font-semibold">État</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i} className={`border-t border-border/50 ${r.error ? "bg-destructive/5" : "hover:bg-secondary/30"}`}>
                      <td className="p-2 text-muted-foreground">{i + 1}</td>
                      <td className="p-2 font-medium">{r.nom} {r.prenom}</td>
                      <td className="p-2 text-muted-foreground">{r.filiere || "—"}</td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.niveau}</Badge></td>
                      <td className="p-2 font-mono text-[10px]">{r.annee_scolaire}</td>
                      <td className="p-2 text-muted-foreground">
                        <div className="flex gap-1 flex-wrap">
                          {r.notes && <span className="bg-primary/15 text-primary px-1.5 rounded">notes</span>}
                          {r.paiements && <span className="bg-success/15 text-success px-1.5 rounded">paiements</span>}
                          {r.rattrapages && <span className="bg-accent/15 text-accent px-1.5 rounded">rattrapages</span>}
                        </div>
                      </td>
                      <td className="p-2">
                        {r.error
                          ? <span className="text-destructive">{r.error}</span>
                          : <CheckCircle2 className="w-4 h-4 text-success" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 100 && (
                <div className="p-2 text-center text-xs text-muted-foreground bg-secondary/30">
                  ... et {rows.length - 100} ligne(s) supplémentaire(s)
                </div>
              )}
            </div>

            {validRows.length > 0 && (
              <Button
                onClick={handleImport}
                disabled={importing}
                className="w-full gradient-gold text-accent-foreground gap-2"
              >
                {importing
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Import en cours...</>
                  : <><Upload className="w-4 h-4" /> Importer {validRows.length} ligne(s) ({distinctStudents} étudiants)</>}
              </Button>
            )}
          </div>
        )}

        {rows.length === 0 && !result && (
          <div className="text-center py-6 text-muted-foreground">
            <FileSpreadsheet className="w-10 h-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Téléchargez le modèle ou chargez votre fichier Excel multi-années</p>
            <p className="text-xs font-mono mt-1">
              nom · prenom · filiere · niveau · annee_scolaire · statut · notes · paiements · rattrapages
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
