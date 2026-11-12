import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useInstitution } from "@/hooks/useInstitution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Trash2, Save, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useCycle } from "@/hooks/useCycle";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const formatCFA = (n: number) => new Intl.NumberFormat("fr-FR").format(n || 0) + " FCFA";

const defaultPaymentConfig = {
  licence: {
    boursier: { frais_administratifs: 250000, uniforme: 200000 },
    non_boursier: { frais_administratifs: 210000, frais_scolarite: 990000, uniforme: 200000 },
  },
  master: {
    boursier: { frais_administratifs: 350000, uniforme: 200000 },
    non_boursier: { frais_administratifs: 250000, frais_scolarite: 1900000, uniforme: 200000 },
  },
};

export default function AdminFinancePage() {
  const { institution } = useInstitution();
  const { hasUniversite, hasCollege, hasLycee } = useCycle();
  const scolaireOnly = (hasCollege || hasLycee) && !hasUniversite;
  const qc = useQueryClient();
  const [paymentConfig, setPaymentConfig] = useState<any>(defaultPaymentConfig);
  const [savingConfig, setSavingConfig] = useState(false);

  // Initial fee_type form
  const [newFee, setNewFee] = useState<any>({
    label: "",
    amount: 0,
    validity_years: 1,
    unlocks_new_year: false,
    cycle_scope: "all",
    niveau: "",
    serie: "",
    fee_kind: "autre",
    orientation_scope: "both",
    monthly_count: 0,
  });

  const normalizeNiveau = (n: string) => (n || "").replace(/ème$/i, "e").replace(/eme$/i, "e").trim();
  const cycleOfLevel = (level?: string) => {
    const n = normalizeNiveau(level || "");
    if (["6e", "5e", "4e", "3e"].includes(n)) return "college";
    if (["2nde", "1ère", "Terminale"].includes(level || "")) return "lycee";
    return "universite";
  };
  const feeAppliesToStudent = (fee: any, student: any) => {
    const studentCycle = cycleOfLevel(student.level);
    if (fee.cycle_scope && fee.cycle_scope !== "all" && fee.cycle_scope !== studentCycle) return false;
    if (fee.niveau && normalizeNiveau(fee.niveau) !== normalizeNiveau(student.level)) return false;
    if (fee.serie && studentCycle === "lycee" && String(fee.serie).toUpperCase() !== String(student.serie || "").toUpperCase()) return false;
    if (fee.orientation_scope === "oriente" && !student.oriente_etat) return false;
    if (fee.orientation_scope === "non_oriente" && student.oriente_etat) return false;
    if (student.oriente_etat && !["inscription", "tenue", "scolarite_orientee", "autre"].includes(fee.fee_kind || "autre")) return false;
    if (!student.oriente_etat && fee.fee_kind === "scolarite_orientee") return false;
    return true;
  };


  useEffect(() => {
    if (institution?.payment_config) {
      setPaymentConfig({
        licence: { ...defaultPaymentConfig.licence, ...(institution.payment_config.licence || {}) },
        master: { ...defaultPaymentConfig.master, ...(institution.payment_config.master || {}) },
      });
    }
  }, [institution?.id]);

  const { data: fees = [] } = useQuery({
    queryKey: ["fee-types", institution?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fee_types")
        .select("*")
        .eq("institution_id", institution!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!institution?.id,
  });

  const updatePaymentField = (cycle: string, statut: string, key: string, value: number) => {
    setPaymentConfig((p: any) => ({
      ...p,
      [cycle]: { ...p[cycle], [statut]: { ...p[cycle][statut], [key]: value } },
    }));
  };

  const savePaymentConfig = async () => {
    if (!institution?.id) return;
    setSavingConfig(true);
    const { error } = await supabase
      .from("institutions")
      .update({ payment_config: paymentConfig })
      .eq("id", institution.id);
    setSavingConfig(false);
    if (error) return toast.error("Erreur : " + error.message);
    toast.success("Configuration enregistrée");
    qc.invalidateQueries({ queryKey: ["institution"] });
  };

  const addFee = async () => {
    if (!institution?.id || !newFee.label.trim()) {
      return toast.error("Libellé requis");
    }
    const label = newFee.label.trim();
    const amount = Number(newFee.amount) || 0;

    // 1) Insérer le type de frais
    const { error } = await supabase.from("fee_types").insert({
      institution_id: institution.id,
      label,
      amount,
      validity_years: newFee.validity_years,
      unlocks_new_year: newFee.unlocks_new_year,
      cycle_scope: newFee.cycle_scope || "all",
      niveau: newFee.niveau || null,
      serie: newFee.serie || null,
      fee_kind: newFee.fee_kind || "autre",
      orientation_scope: newFee.orientation_scope || "both",
      monthly_count: Number(newFee.monthly_count) || 0,
    } as any);
    if (error) return toast.error("Erreur : " + error.message);


    // 2) Université uniquement : propager dans la config Licence/Master historique
    if (!scolaireOnly) {
      const key = label
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      const nextConfig = JSON.parse(JSON.stringify(paymentConfig));
      for (const cycle of ["licence", "master"] as const) {
        for (const statut of ["boursier", "non_boursier"] as const) {
          nextConfig[cycle] = nextConfig[cycle] || {};
          nextConfig[cycle][statut] = nextConfig[cycle][statut] || {};
          if (nextConfig[cycle][statut][key] == null) {
            nextConfig[cycle][statut][key] = amount;
          }
        }
      }
      setPaymentConfig(nextConfig);
      await supabase.from("institutions").update({ payment_config: nextConfig }).eq("id", institution.id);
    }

    // 3) Créer une dette (paiement pending) pour tous les étudiants actifs de l'établissement
    const { data: roleRows } = await supabase
      .from("user_roles").select("user_id").eq("role", "user");
    const studentIds = (roleRows || []).map((r: any) => r.user_id);
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from("profiles")
        .select("user_id, academic_year, level, serie, oriente_etat")
        .eq("institution_id", institution.id)
        .in("user_id", studentIds);
      const createdFee = { ...newFee, label, amount };
      const studentsToCharge = (students || []).filter((s: any) => feeAppliesToStudent(createdFee, s));
      const inserts = studentsToCharge.map((s: any) => ({
        user_id: s.user_id,
        institution_id: institution.id,
        amount,
        description: label,
        status: "pending",
        academic_year: s.academic_year || institution.academic_year || null,
      }));
      if (inserts.length > 0) {
        const { error: payErr } = await supabase.from("payments").insert(inserts);
        if (payErr) console.warn("payments insert:", payErr.message);
      }
      toast.success(`Type de frais créé · dette ajoutée à ${inserts.length} ${scolaireOnly ? "élève(s)" : "étudiant(s)"}`);
    } else {
      toast.success("Type de frais créé");
    }

    setNewFee({ label: "", amount: 0, validity_years: 1, unlocks_new_year: false, cycle_scope: "all", niveau: "", serie: "", fee_kind: "autre", orientation_scope: "both", monthly_count: 0 });
    qc.invalidateQueries({ queryKey: ["fee-types"] });
    qc.invalidateQueries({ queryKey: ["institution"] });
  };

  const updateFee = async (id: string, patch: any) => {
    const { error } = await supabase.from("fee_types").update(patch).eq("id", id);
    if (error) return toast.error("Erreur : " + error.message);
    qc.invalidateQueries({ queryKey: ["fee-types"] });
  };

  const deleteFee = async (id: string) => {
    const { error } = await supabase.from("fee_types").delete().eq("id", id);
    if (error) return toast.error("Erreur : " + error.message);
    toast.success("Type de frais supprimé");
    qc.invalidateQueries({ queryKey: ["fee-types"] });
  };

  const [syncing, setSyncing] = useState(false);
  const slugify = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
     .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const syncFeesToStudentsAndConfig = async () => {
    if (!institution?.id) return;
    setSyncing(true);
    try {
      const activeFees = (fees as any[]).filter((f) => f.is_active);
      if (activeFees.length === 0) {
        toast.info("Aucun type de frais à synchroniser");
        return;
      }

      // 1) Université uniquement : propage dans payment_config (Licence + Master × boursier/non_boursier)
      if (!scolaireOnly) {
        const nextConfig = JSON.parse(JSON.stringify(paymentConfig));
        for (const f of activeFees) {
          const key = slugify(f.label);
          for (const cycle of ["licence", "master"] as const) {
            for (const statut of ["boursier", "non_boursier"] as const) {
              nextConfig[cycle] = nextConfig[cycle] || {};
              nextConfig[cycle][statut] = nextConfig[cycle][statut] || {};
              if (nextConfig[cycle][statut][key] == null) {
                nextConfig[cycle][statut][key] = Number(f.amount) || 0;
              }
            }
          }
        }
        setPaymentConfig(nextConfig);
        await supabase.from("institutions").update({ payment_config: nextConfig }).eq("id", institution.id);
      }

      // 2) Crée la dette pour chaque étudiant qui ne l'a pas encore
      const { data: roleRows } = await supabase
        .from("user_roles").select("user_id").eq("role", "user");
      const studentIds = (roleRows || []).map((r: any) => r.user_id);
      if (studentIds.length === 0) {
        toast.success("Configuration synchronisée");
        return;
      }
      const { data: students } = await supabase
        .from("profiles").select("user_id, academic_year, level, serie, oriente_etat")
        .eq("institution_id", institution.id).in("user_id", studentIds);
      const studentList = students || [];
      if (studentList.length === 0) {
        toast.success("Configuration synchronisée");
        return;
      }

      const { data: existingPayments } = await supabase
        .from("payments").select("user_id, description")
        .eq("institution_id", institution.id)
        .in("user_id", studentList.map((s: any) => s.user_id));
      const existsSet = new Set(
        (existingPayments || []).map((p: any) => `${p.user_id}__${p.description}`)
      );

      const inserts: any[] = [];
      for (const f of activeFees) {
        for (const s of studentList) {
          if (!feeAppliesToStudent(f, s)) continue;
          const key = `${s.user_id}__${f.label}`;
          if (existsSet.has(key)) continue;
          inserts.push({
            user_id: s.user_id,
            institution_id: institution.id,
            amount: Number(f.amount) || 0,
            description: f.label,
            status: "pending",
            academic_year: s.academic_year || institution.academic_year || null,
          });
        }
      }

      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from("payments").insert(inserts);
        if (insErr) throw insErr;
      }
      qc.invalidateQueries({ queryKey: ["institution"] });
      toast.success(
        `Synchronisation OK · ${inserts.length} dette(s) créée(s) sur ${studentList.length} étudiant(s)`
      );
    } catch (e: any) {
      toast.error("Erreur sync : " + (e.message || e));
    } finally {
      setSyncing(false);
    }
  };

  if (!institution) return <div className="p-6">Chargement…</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Wallet className="w-7 h-7 text-accent" /> Finances
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configuration des frais de scolarité et types de frais paramétrables.
        </p>
      </motion.div>

      {/* Types de frais (paramétrables) */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ShieldCheck className="w-5 h-5 text-primary" /> Types de frais
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1 max-w-prose">
                Définissez les frais de l'établissement. Activez « Débloque la nouvelle année »
                pour qu'un paiement de ce type accorde l'accès à la nouvelle année académique.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={syncFeesToStudentsAndConfig}
              disabled={syncing || fees.length === 0}
              className="gap-1 shrink-0"
            >
              <Save className="w-4 h-4" />
              {syncing ? "Synchronisation…" : "Synchroniser étudiants & config"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Liste */}
          <div className="space-y-2">
            {fees.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">
                Aucun type de frais. Créez-en un ci-dessous.
              </p>
            )}
            {fees.map((f: any) => (
              <div key={f.id} className="p-3 rounded-lg border bg-card space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                  <Input
                    className="md:col-span-4"
                    defaultValue={f.label}
                    onBlur={(e) => e.target.value !== f.label && updateFee(f.id, { label: e.target.value })}
                  />
                  <Input
                    type="number"
                    className="md:col-span-2"
                    defaultValue={f.amount}
                    onBlur={(e) => Number(e.target.value) !== f.amount && updateFee(f.id, { amount: Number(e.target.value) })}
                  />
                  <Select
                    defaultValue={String(f.validity_years)}
                    onValueChange={(v) => updateFee(f.id, { validity_years: Number(v) })}
                  >
                    <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 an</SelectItem>
                      <SelectItem value="2">2 ans</SelectItem>
                      <SelectItem value="3">3 ans</SelectItem>
                      <SelectItem value="0">Cycle complet</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="md:col-span-3 flex items-center gap-2">
                    <Switch
                      checked={f.unlocks_new_year}
                      onCheckedChange={(v) => updateFee(f.id, { unlocks_new_year: v })}
                    />
                    <Label className="text-xs">Débloque la nouvelle année</Label>
                  </div>
                  <Button variant="ghost" size="icon" className="md:col-span-1 ml-auto" onClick={() => deleteFee(f.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2 border-t">
                  <Select defaultValue={f.cycle_scope || "all"} onValueChange={(v) => updateFee(f.id, { cycle_scope: v })}>
                    <SelectTrigger><SelectValue placeholder="Cycle" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous cycles</SelectItem>
                      <SelectItem value="college">Collège</SelectItem>
                      <SelectItem value="lycee">Lycée</SelectItem>
                      <SelectItem value="universite">Université</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue={f.fee_kind || "autre"} onValueChange={(v) => updateFee(f.id, { fee_kind: v })}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inscription">Inscription</SelectItem>
                      <SelectItem value="scolarite_annuelle">Scolarité annuelle</SelectItem>
                      <SelectItem value="scolarite_orientee">Scolarité orienté</SelectItem>
                      <SelectItem value="mensualite">Mensualité</SelectItem>
                      <SelectItem value="tenue">Tenue</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Niveau (ex: 6e)"
                    defaultValue={f.niveau || ""}
                    onBlur={(e) => e.target.value !== (f.niveau || "") && updateFee(f.id, { niveau: e.target.value || null })}
                  />
                  <Input
                    placeholder="Série (lycée)"
                    defaultValue={f.serie || ""}
                    onBlur={(e) => e.target.value !== (f.serie || "") && updateFee(f.id, { serie: e.target.value || null })}
                  />
                  <Select defaultValue={f.orientation_scope || "both"} onValueChange={(v) => updateFee(f.id, { orientation_scope: v })}>
                    <SelectTrigger><SelectValue placeholder="Orientation" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Tous</SelectItem>
                      <SelectItem value="oriente">Orientés</SelectItem>
                      <SelectItem value="non_oriente">Non orientés</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    placeholder="Nb mens."
                    defaultValue={f.monthly_count || 0}
                    onBlur={(e) => Number(e.target.value) !== (f.monthly_count || 0) && updateFee(f.id, { monthly_count: Number(e.target.value) })}
                  />
                </div>
              </div>
            ))}

          </div>

          {/* Création */}
          <div className="p-3 rounded-lg border-2 border-dashed space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-4">
                <Label className="text-xs">Libellé</Label>
                <Input value={newFee.label} onChange={(e) => setNewFee({ ...newFee, label: e.target.value })} placeholder="Ex: Frais d'inscription 6e" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Montant (FCFA)</Label>
                <Input type="number" value={newFee.amount} onChange={(e) => setNewFee({ ...newFee, amount: Number(e.target.value) })} />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Validité</Label>
                <Select value={String(newFee.validity_years)} onValueChange={(v) => setNewFee({ ...newFee, validity_years: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 an</SelectItem>
                    <SelectItem value="2">2 ans</SelectItem>
                    <SelectItem value="3">3 ans</SelectItem>
                    <SelectItem value="0">Cycle complet</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 flex items-center gap-2">
                <Switch checked={newFee.unlocks_new_year} onCheckedChange={(v) => setNewFee({ ...newFee, unlocks_new_year: v })} />
                <Label className="text-xs">Débloque nouvelle année</Label>
              </div>
              <Button onClick={addFee} className="md:col-span-1 gap-1"><Plus className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 pt-2 border-t">
              <div>
                <Label className="text-xs">Cycle</Label>
                <Select value={newFee.cycle_scope} onValueChange={(v) => setNewFee({ ...newFee, cycle_scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous cycles</SelectItem>
                    <SelectItem value="college">Collège</SelectItem>
                    <SelectItem value="lycee">Lycée</SelectItem>
                    <SelectItem value="universite">Université</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Type de frais</Label>
                <Select value={newFee.fee_kind} onValueChange={(v) => setNewFee({ ...newFee, fee_kind: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inscription">Inscription</SelectItem>
                    <SelectItem value="scolarite_annuelle">Scolarité annuelle</SelectItem>
                    <SelectItem value="scolarite_orientee">Scolarité orienté État</SelectItem>
                    <SelectItem value="mensualite">Mensualité</SelectItem>
                    <SelectItem value="tenue">Tenue scolaire</SelectItem>
                    <SelectItem value="autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Niveau</Label>
                <Input value={newFee.niveau} onChange={(e) => setNewFee({ ...newFee, niveau: e.target.value })} placeholder="6e, 2nde, Tle…" />
              </div>
              <div>
                <Label className="text-xs">Série (lycée)</Label>
                <Input value={newFee.serie} onChange={(e) => setNewFee({ ...newFee, serie: e.target.value })} placeholder="A1, B, C, D, S" />
              </div>
              <div>
                <Label className="text-xs">Orientation</Label>
                <Select value={newFee.orientation_scope} onValueChange={(v) => setNewFee({ ...newFee, orientation_scope: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Tous élèves</SelectItem>
                    <SelectItem value="oriente">Orientés uniquement</SelectItem>
                    <SelectItem value="non_oriente">Non orientés uniquement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Nb mensualités</Label>
                <Input type="number" value={newFee.monthly_count} onChange={(e) => setNewFee({ ...newFee, monthly_count: Number(e.target.value) })} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Astuce : laissez Niveau/Série vide pour appliquer le frais à tout le cycle.
              Les élèves orientés par l'État ne paient que Inscription + Tenue + Scolarité orienté (si définie).
            </p>
          </div>

        </CardContent>
      </Card>

      {/* Configuration des frais de scolarité universitaire */}
      {hasUniversite && <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="w-5 h-5 text-accent" /> Configuration des frais de scolarité
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Montants automatiquement appliqués comme dette lors de la création d'un étudiant.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {(["licence", "master"] as const).map((cycle) => (
            <div key={cycle} className="space-y-3">
              <h3 className="font-semibold uppercase text-sm">{cycle}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(["non_boursier", "boursier"] as const).map((statut) => (
                  <div key={statut} className="p-3 rounded-lg border bg-secondary/20 space-y-2">
                    <p className="text-xs font-medium flex items-center justify-between">
                      <span>{statut === "boursier" ? "Boursier" : "Non boursier"}</span>
                      <Badge variant="outline">
                        Total : {formatCFA((Object.values(paymentConfig[cycle][statut] || {}) as number[]).reduce((a, b) => a + Number(b || 0), 0))}
                      </Badge>
                    </p>
                    {Object.entries(paymentConfig[cycle][statut] || {}).map(([k, v]) => (
                      <div key={k} className="grid grid-cols-2 gap-2 items-center">
                        <Label className="text-xs capitalize">{k.replace(/_/g, " ")}</Label>
                        <Input
                          type="number"
                          value={v as any}
                          onChange={(e) => updatePaymentField(cycle, statut, k, Number(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <Button onClick={savePaymentConfig} disabled={savingConfig} className="gap-2">
            <Save className="w-4 h-4" /> {savingConfig ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </CardContent>
      </Card>}
    </div>
  );
}
