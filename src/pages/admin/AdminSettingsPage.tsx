import {PhoneInput} from '@/components/ui/phone-input';
import { downloadInstitutionTemplate } from "@/lib/institutionData";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Settings, Save, Building2, Palette, Upload, AlertTriangle, CheckCircle, Download, CreditCard, Sparkles, GraduationCap, Lock, Users, BookOpen, Trophy, XCircle, Clock, Database, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { toast } from "sonner";
import HistoricalDataImport from "@/components/admin/HistoricalDataImport";
import { generateClassBulletinsPdf } from "@/lib/bulletinPdf";
import { CampusManagerDialog } from "@/components/superadmin/CampusManagerDialog";
import { Switch } from "@/components/ui/switch";
import { MapPin } from "lucide-react";
import { useCycle } from "@/hooks/useCycle";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

const formatCFA = (n: number) => n.toLocaleString("fr-FR") + " FCFA";

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

// Defined at module scope so React doesn't remount it on every parent render
// (the previous in-component definition caused inputs to lose focus on each keystroke).
const PaymentFieldInput = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <div className="relative">
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        step={1000}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => {
          const raw = e.target.value;
          const n = raw === "" ? 0 : Number(raw);
          onChange(Number.isFinite(n) ? n : 0);
        }}
        className="pr-16"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">FCFA</span>
    </div>
  </div>
);

const AdminSettingsPage = () => {
  const { user } = useAuth();
  const { institution: instData, getLevels } = useInstitution();
  const { hasUniversite, hasCollege, hasLycee } = useCycle();
  const showUni = hasUniversite || !(hasCollege || hasLycee);
  const showScolaire = hasCollege || hasLycee;
  const LEVELS = getLevels();
  const qc = useQueryClient();
  const [campusOpen, setCampusOpen] = useState(false);
  const [section, setSection] = useState("institution");

  const { data: profile } = useQuery({
    queryKey: ["admin-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("institution_id").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: institution, isLoading } = useQuery({
    queryKey: ["admin-institution", profile?.institution_id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("institutions").select("*").eq("id", profile!.institution_id).maybeSingle();
      return data as Record<string, any> | null;
    },
    enabled: !!profile?.institution_id,
  });

  const [form, setForm] = useState({
    name: "", slogan: "", description: "", address: "", email: "", phone: "",
    primary_color: "#2563EB", secondary_color: "#1E3A8A", accent_color: "#60A5FA",
    domain: "", institution_type: "university", academic_year: "2025-2026", code: "",
    cycle: "lmd", is_multi_campus: false,
  });

  const [academicSettings, setAcademicSettings] = useState({
    credits_min_passage: 45,
    credits_max_passage: 60,
    credits_total_annee: 60,
  });

  const [paymentConfig, setPaymentConfig] = useState(defaultPaymentConfig);
  const [newSchoolFee, setNewSchoolFee] = useState({
    label: "", amount: 0, cycle_scope: hasCollege ? "college" : "lycee", niveau: "", serie: "",
    fee_kind: "scolarite_annuelle", orientation_scope: "non_oriente",
  });

  const { data: schoolFees = [] } = useQuery({
    queryKey: ["settings-school-fees", profile?.institution_id],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("fee_types")
        .select("*")
        .eq("institution_id", profile!.institution_id)
        .in("cycle_scope", ["all", "college", "lycee"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.institution_id && showScolaire,
  });

  useEffect(() => {
    if (institution) {
      setForm({
        name: institution.name || "", slogan: institution.slogan || "", description: institution.description || "",
        address: institution.address || "", email: institution.email || "", phone: institution.phone || "",
        primary_color: institution.primary_color || "#2563EB", secondary_color: institution.secondary_color || "#1E3A8A",
        accent_color: institution.accent_color || "#60A5FA", domain: institution.domain || "",
        institution_type: institution.institution_type || "university", academic_year: institution.academic_year || "2025-2026",
        code: institution.code || "",
        cycle: ((institution as any).cycle || "lmd"),
        is_multi_campus: !!(institution as any).is_multi_campus,
      });
      setAcademicSettings({
        credits_min_passage: institution.credits_min_passage ?? 45,
        credits_max_passage: institution.credits_max_passage ?? 60,
        credits_total_annee: institution.credits_total_annee ?? 60,
      });
      if (institution.payment_config) {
        setPaymentConfig({
          ...defaultPaymentConfig,
          ...institution.payment_config,
          licence: { ...defaultPaymentConfig.licence, ...(institution.payment_config.licence || {}) },
          master: { ...defaultPaymentConfig.master, ...(institution.payment_config.master || {}) },
        });
      }
    }
  }, [institution]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nom requis.");
      const years = form.academic_year.match(/^(20\d{2})-(20\d{2})$/);
      if (!years || Number(years[2]) !== Number(years[1]) + 1) throw new Error("Année académique invalide, exemple : 2026-2027.");
      if (academicSettings.credits_total_annee <= 0 || academicSettings.credits_min_passage < 0 || academicSettings.credits_min_passage > academicSettings.credits_max_passage || academicSettings.credits_max_passage > academicSettings.credits_total_annee) throw new Error("Les seuils doivent respecter minimum ≤ maximum ≤ crédits annuels.");
      const { error } = await (supabase as any).from("institutions").update({
        name: form.name, slogan: form.slogan || null, description: form.description || null,
        address: form.address || null, email: form.email || null, phone: form.phone || null,
        primary_color: form.primary_color, secondary_color: form.secondary_color, accent_color: form.accent_color,
        domain: form.domain || null, institution_type: form.institution_type, academic_year: form.academic_year,
        code: form.code || null,
        credits_min_passage: academicSettings.credits_min_passage,
        credits_max_passage: academicSettings.credits_max_passage,
        credits_total_annee: academicSettings.credits_total_annee,
        cycle: form.cycle,
        is_multi_campus: form.is_multi_campus,
      }).eq("id", profile!.institution_id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-institution"] });
      qc.invalidateQueries({ queryKey: ["user-institution"] });
      toast.success("Paramètres sauvegardés !");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const set = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const updatePaymentField = (cycle: "licence" | "master", statut: "boursier" | "non_boursier", field: string, value: number) => {
    setPaymentConfig(prev => ({
      ...prev,
      [cycle]: { ...prev[cycle], [statut]: { ...prev[cycle][statut], [field]: value } },
    }));
  };

  const addSchoolFee = async () => {
    if (!profile?.institution_id || !newSchoolFee.label.trim()) return toast.error("Libellé requis");
    const { error } = await (supabase as any).from("fee_types").insert({
      institution_id: profile.institution_id,
      label: newSchoolFee.label.trim(),
      amount: Number(newSchoolFee.amount) || 0,
      validity_years: 1,
      unlocks_new_year: false,
      is_active: true,
      cycle_scope: newSchoolFee.cycle_scope,
      niveau: newSchoolFee.niveau || null,
      serie: newSchoolFee.serie || null,
      fee_kind: newSchoolFee.fee_kind,
      orientation_scope: newSchoolFee.orientation_scope,
      monthly_count: 0,
    });
    if (error) return toast.error(error.message);
    setNewSchoolFee({ label: "", amount: 0, cycle_scope: hasCollege ? "college" : "lycee", niveau: "", serie: "", fee_kind: "scolarite_annuelle", orientation_scope: "non_oriente" });
    qc.invalidateQueries({ queryKey: ["settings-school-fees"] });
    toast.success("Frais scolaire créé");
  };

  const updateSchoolFee = async (id: string, patch: Record<string, any>) => {
    const { error } = await (supabase as any).from("fee_types").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["settings-school-fees"] });
  };

  const deleteSchoolFee = async (id: string) => {
    const { error } = await (supabase as any).from("fee_types").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["settings-school-fees"] });
    toast.success("Frais supprimé");
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.institution_id || !user?.id) return;
    const ext = file.name.split('.').pop() || "png";
    const path = `${user.id}/institution-logo-${profile.institution_id}.${ext.toLowerCase()}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (upErr) { toast.error("Erreur upload: " + upErr.message); return; }
    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const { error: dbErr } = await (supabase as any).from("institutions").update({ logo_url: urlData.publicUrl }).eq("id", profile.institution_id);
    if (dbErr) { toast.error("Erreur: " + dbErr.message); return; }
    qc.invalidateQueries({ queryKey: ["admin-institution"] });
    qc.invalidateQueries({ queryKey: ["user-institution"] });
    toast.success("Logo mis à jour !");
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Chargement...</div>;
  if (!institution) return <div className="p-8 text-center"><p className="text-muted-foreground">Aucun établissement associé.</p></div>;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="settings-workspace space-y-6">
      <motion.div variants={item} className="settings-heading">
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
          <Settings className="w-7 h-7 text-primary" /> Paramètres de l’établissement
        </h1>
        <p className="text-muted-foreground mt-1">Identité, organisation et règles de fonctionnement, réunies dans un espace clair.</p>
      </motion.div>

      <div className="settings-context"><div><Building2 className="h-5 w-5 text-primary" /><strong>{institution.name}</strong><span>{institution.academic_year}</span></div><Button onClick={() => saveMutation.mutate()} disabled={!form.name.trim() || saveMutation.isPending}><Save className="mr-2 h-4 w-4" />{saveMutation.isPending ? "Enregistrement…" : "Enregistrer les modifications"}</Button></div>
      <nav className="settings-sections" aria-label="Rubriques des paramètres">{[
        ["institution", "Établissement", Building2], ["academic", "Organisation académique", GraduationCap],
        ["finance", "Frais de scolarité", CreditCard], ["data", "Données & clôture", Database],
      ].map(([key, label, Icon]: any) => <button key={key} type="button" aria-current={section === key ? "page" : undefined} onClick={() => setSection(key)}><Icon className="h-4 w-4" />{label}</button>)}</nav>
      <section hidden={section !== "institution"} aria-label="Identité et apparence">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Informations */}
        <motion.div variants={item}>
          <Card className="border-border/50 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><Building2 className="w-5 h-5 text-accent" /> Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Select value={form.institution_type} onValueChange={(v) => set("institution_type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="university">Université</SelectItem>
                      <SelectItem value="highschool">Lycée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Année académique</Label>
                  <Input value={form.academic_year} onChange={(e) => set("academic_year", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Nom *</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Code (ex: AFRAM)</Label><Input value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="AFRAM" maxLength={10} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Slogan</Label><Input value={form.slogan} onChange={(e) => set("slogan", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={3} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Téléphone</Label><PhoneInput value={form.phone} onChange={phone=>set("phone",phone)}/></div>
              </div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Adresse</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Domaine</Label><Input value={form.domain} onChange={(e) => set("domain", e.target.value)} /></div>

              {/* Cycle & Multi-campus */}
              <div className="pt-3 mt-2 border-t border-border/60 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Cycle</Label>
                    <Select value={form.cycle} onValueChange={(v) => set("cycle", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lmd">Cycle LMD (Licence/Master/Doctorat)</SelectItem>
                        <SelectItem value="bts">Cycle BTS (Coefficients)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Multi-campus</Label>
                    <div className="h-10 flex items-center gap-3 px-3 rounded-md border border-input bg-background">
                      <Switch checked={form.is_multi_campus} onCheckedChange={(v) => set("is_multi_campus", v)} />
                      <span className="text-sm text-muted-foreground">{form.is_multi_campus ? "Plusieurs sites" : "Site unique"}</span>
                    </div>
                  </div>
                </div>
                {form.is_multi_campus && (
                  <Button type="button" variant="outline" className="w-full" onClick={() => setCampusOpen(true)}>
                    <MapPin className="w-4 h-4 mr-2" /> Gérer les campus / sites
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <CampusManagerDialog institution={institution} open={campusOpen} onOpenChange={setCampusOpen} />

        <motion.div variants={item} className="space-y-6">
          {/* Branding */}
          <Card className="border-border/50 shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><Palette className="w-5 h-5 text-accent" /> Identité visuelle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Logo</Label>
                <div className="flex items-center gap-3">
                  {institution.logo_url ? <img src={institution.logo_url} alt={`Logo ${institution.name}`} className="w-16 h-16 rounded-xl object-cover shadow-md" /> : <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center"><Building2 className="w-8 h-8 text-muted-foreground" /></div>}
                  <label className="cursor-pointer">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm transition-colors"><Upload className="w-4 h-4" /> Changer</div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
                {[["primary_color", "Principale"], ["secondary_color", "Secondaire"], ["accent_color", "Accent"]].map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{label}</Label>
                    <div className="flex gap-2 items-center">
                      <input type="color" value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} className="w-10 h-10 rounded cursor-pointer border-0" />
                      <Input value={(form as any)[key]} onChange={(e) => set(key, e.target.value)} className="flex-1 text-xs" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <motion.div className="h-8 flex-1 rounded-md shadow-inner" style={{ background: form.primary_color }} whileHover={{ scale: 1.05 }} />
                <motion.div className="h-8 flex-1 rounded-md shadow-inner" style={{ background: form.secondary_color }} whileHover={{ scale: 1.05 }} />
                <motion.div className="h-8 flex-1 rounded-md shadow-inner" style={{ background: form.accent_color }} whileHover={{ scale: 1.05 }} />
              </div>
            </CardContent>
          </Card>

        </motion.div>
      </div>
      </section>
      <section hidden={section !== "academic"} className="space-y-5" aria-label="Organisation académique">
        <Card><CardContent className="p-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold">Règles de notation et de validation</h2><p className="text-sm text-muted-foreground">Moyennes, coefficients, crédits et absences.</p></div><Button asChild variant="outline"><Link to="/admin/academic-settings">Configurer les règles</Link></Button></CardContent></Card>
      {/* Academic Settings - LMD Credits */}
      {showUni && <motion.div variants={item}>
        <Card className="border-accent/30 shadow-lg hover:shadow-xl transition-shadow duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-accent" /> Paramètres académiques (Système LMD)
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Configurez les seuils de crédits pour le passage en classe supérieure
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <Label className="text-sm font-medium text-foreground">Crédits minimum</Label>
                </div>
                <p className="text-xs text-muted-foreground">En dessous = Redoublement</p>
                <Input
                  type="number" min={0} max={120}
                  value={academicSettings.credits_min_passage}
                  onChange={(e) => setAcademicSettings(prev => ({ ...prev, credits_min_passage: Number(e.target.value) }))}
                  className="text-center text-lg font-bold"
                />
              </div>

              <div className="p-4 rounded-xl bg-warning/5 border border-warning/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-warning" />
                  <Label className="text-sm font-medium text-foreground">Passage conditionnel</Label>
                </div>
                <p className="text-xs text-muted-foreground">Entre min et max = UE à rattraper</p>
                <div className="text-center text-lg font-bold text-warning py-2">
                  {academicSettings.credits_min_passage} — {academicSettings.credits_max_passage}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-success/5 border border-success/20 space-y-2">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-success" />
                  <Label className="text-sm font-medium text-foreground">Crédits maximum</Label>
                </div>
                <p className="text-xs text-muted-foreground">Atteint = Admis totalement</p>
                <Input
                  type="number" min={0} max={120}
                  value={academicSettings.credits_max_passage}
                  onChange={(e) => setAcademicSettings(prev => ({ ...prev, credits_max_passage: Number(e.target.value) }))}
                  className="text-center text-lg font-bold"
                />
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-secondary/30 border border-border/50">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-foreground">Crédits totaux de l'année</Label>
                  <p className="text-xs text-muted-foreground">Nombre total de crédits ECTS par année</p>
                </div>
                <Input
                  type="number" min={0} max={120}
                  value={academicSettings.credits_total_annee}
                  onChange={(e) => setAcademicSettings(prev => ({ ...prev, credits_total_annee: Number(e.target.value) }))}
                  className="w-24 text-center text-lg font-bold"
                />
              </div>
            </div>

            {/* Visual summary */}
            <div className="mt-4 flex items-center gap-2">
              <div className="flex-1">
                <Progress value={(academicSettings.credits_min_passage / academicSettings.credits_total_annee) * 100} className="h-3" />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {academicSettings.credits_min_passage}/{academicSettings.credits_total_annee}
              </span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span className="text-destructive">0 — Redouble</span>
              <span className="text-warning">{academicSettings.credits_min_passage} — Conditionnel</span>
              <span className="text-success">{academicSettings.credits_max_passage} — Admis</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>}

      </section>
      <section hidden={section !== "finance"} aria-label="Frais de scolarité">
      {/* Configuration des frais scolaires */}
      {showScolaire ? <motion.div variants={item}>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-accent" /> Frais scolaires Collège / Lycée
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Ces frais alimentent automatiquement la dette lors de l'inscription d'un élève selon son niveau, sa série et son orientation État.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {(schoolFees as any[]).length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Aucun frais scolaire configuré.</p>}
              {(schoolFees as any[]).map((f: any) => (
                <div key={f.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 p-3 rounded-lg border bg-secondary/20 items-center">
                  <Input className="md:col-span-3" defaultValue={f.label} onBlur={(e) => e.target.value !== f.label && updateSchoolFee(f.id, { label: e.target.value })} />
                  <Input className="md:col-span-2" type="number" defaultValue={f.amount} onBlur={(e) => Number(e.target.value) !== Number(f.amount) && updateSchoolFee(f.id, { amount: Number(e.target.value) })} />
                  <Select defaultValue={f.cycle_scope || "college"} onValueChange={(v) => updateSchoolFee(f.id, { cycle_scope: v })}>
                    <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="college">Collège</SelectItem>
                      <SelectItem value="lycee">Lycée</SelectItem>
                      <SelectItem value="all">Collège + Lycée</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue={f.fee_kind || "scolarite_annuelle"} onValueChange={(v) => updateSchoolFee(f.id, { fee_kind: v })}>
                    <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="inscription">Inscription</SelectItem>
                      <SelectItem value="scolarite_annuelle">Scolarité annuelle</SelectItem>
                      <SelectItem value="scolarite_orientee">Scolarité orienté État</SelectItem>
                      <SelectItem value="tenue">Tenue scolaire</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue={f.orientation_scope || "both"} onValueChange={(v) => updateSchoolFee(f.id, { orientation_scope: v })}>
                    <SelectTrigger className="md:col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">Tous</SelectItem>
                      <SelectItem value="oriente">Orientés</SelectItem>
                      <SelectItem value="non_oriente">Non orientés</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => deleteSchoolFee(f.id)} className="md:col-span-1 ml-auto">
                    <XCircle className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="p-3 rounded-lg border-2 border-dashed space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
                <div className="md:col-span-3"><Label className="text-xs">Libellé</Label><Input value={newSchoolFee.label} onChange={(e) => setNewSchoolFee({ ...newSchoolFee, label: e.target.value })} placeholder="Ex: Frais scolarité 6e" /></div>
                <div className="md:col-span-2"><Label className="text-xs">Montant</Label><Input type="number" value={newSchoolFee.amount} onChange={(e) => setNewSchoolFee({ ...newSchoolFee, amount: Number(e.target.value) })} /></div>
                <div className="md:col-span-2"><Label className="text-xs">Cycle</Label><Select value={newSchoolFee.cycle_scope} onValueChange={(v) => setNewSchoolFee({ ...newSchoolFee, cycle_scope: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="college">Collège</SelectItem><SelectItem value="lycee">Lycée</SelectItem><SelectItem value="all">Collège + Lycée</SelectItem></SelectContent></Select></div>
                <div className="md:col-span-2"><Label className="text-xs">Type</Label><Select value={newSchoolFee.fee_kind} onValueChange={(v) => setNewSchoolFee({ ...newSchoolFee, fee_kind: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="inscription">Inscription</SelectItem><SelectItem value="scolarite_annuelle">Scolarité annuelle</SelectItem><SelectItem value="scolarite_orientee">Scolarité orienté État</SelectItem><SelectItem value="tenue">Tenue scolaire</SelectItem><SelectItem value="autre">Autre</SelectItem></SelectContent></Select></div>
                <div className="md:col-span-2"><Label className="text-xs">Orientation</Label><Select value={newSchoolFee.orientation_scope} onValueChange={(v) => setNewSchoolFee({ ...newSchoolFee, orientation_scope: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="both">Tous</SelectItem><SelectItem value="oriente">Orientés</SelectItem><SelectItem value="non_oriente">Non orientés</SelectItem></SelectContent></Select></div>
                <Button onClick={addSchoolFee} className="md:col-span-1"><Plus className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input value={newSchoolFee.niveau} onChange={(e) => setNewSchoolFee({ ...newSchoolFee, niveau: e.target.value })} placeholder="Niveau optionnel : 6e, 3e, 2nde…" />
                <Input value={newSchoolFee.serie} onChange={(e) => setNewSchoolFee({ ...newSchoolFee, serie: e.target.value })} placeholder="Série lycée optionnelle : A1, C, D…" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div> : <motion.div variants={item}>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-accent" /> Configuration des frais de scolarité
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              Cette section a été déplacée vers le module <strong>Finances</strong>.
            </p>
            <Button variant="outline" onClick={() => (window.location.href = "/admin/finances")}>
              Aller à Finances
            </Button>
          </CardContent>
        </Card>
      </motion.div>}

      </section>
      <section hidden={section !== "data"} className="space-y-5" aria-label="Données et clôture">
      {/* Rectorplus separated imports */}
      <motion.div variants={item}>
        <HistoricalDataImport institutionId={profile?.institution_id || ""} onImportComplete={() => qc.invalidateQueries()} />
      </motion.div>

      <Card><CardContent className="p-5 flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-semibold">Clôture et validation des résultats</h2><p className="text-sm text-muted-foreground">Préparer les résultats et suivre leur validation depuis le module dédié.</p></div><Button asChild variant="outline"><Link to={showUni ? "/admin/closure" : "/admin/closure-trimestre"}>Ouvrir les clôtures</Link></Button></CardContent></Card>
      </section>

    </motion.div>
  );
};
export default AdminSettingsPage;
