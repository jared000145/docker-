import {PhoneInput} from '@/components/ui/phone-input';
import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Plus, Trash2, Globe2, Upload, ImageIcon, Pencil, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CampusManagerDialog } from "@/components/superadmin/CampusManagerDialog";
import { toast } from "sonner";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

// Profils = combinaisons cohérentes (institution_type + cycle + enabled_cycles)
const PROFILES = [
  { id: "univ_lmd",    label: "🎓 Université — LMD (UE, crédits, semestres)", institution_type: "university", cycle: "lmd", enabled_cycles: ["universite"] },
  { id: "univ_bts",    label: "📘 Université — BTS (matières, coefficients)",  institution_type: "university", cycle: "bts", enabled_cycles: ["universite"] },
  { id: "lycee",       label: "🏫 Lycée (2nde, 1ère, Terminale — séries)",      institution_type: "highschool", cycle: "lmd", enabled_cycles: ["lycee"] },
  { id: "college",     label: "🏫 Collège (6e, 5e, 4e, 3e)",                    institution_type: "highschool", cycle: "lmd", enabled_cycles: ["college"] },
  { id: "coll_lycee",  label: "🏫 Collège + Lycée",                              institution_type: "highschool", cycle: "lmd", enabled_cycles: ["college", "lycee"] },
] as const;

const detectProfile = (row: any): string => {
  const ec: string[] = Array.isArray(row?.enabled_cycles) ? row.enabled_cycles : [];
  const has = (k: string) => ec.includes(k);
  if (has("college") && has("lycee")) return "coll_lycee";
  if (has("lycee") && !has("college")) return "lycee";
  if (has("college") && !has("lycee")) return "college";
  if (row?.cycle === "bts") return "univ_bts";
  return "univ_lmd";
};

const emptyForm = {
  name: "", slogan: "", description: "", address: "", email: "", phone: "",
  primary_color: "#2563EB", secondary_color: "#1E3A8A", accent_color: "#60A5FA",
  domain: "", academic_year: "2025-2026", is_multi_campus: false,
  profile: "univ_lmd" as string,
};

const SuperAdminInstitutionsPage = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editInst, setEditInst] = useState<any>(null);
  const [institutionToDelete, setInstitutionToDelete] = useState<any>(null);
  const [campusInst, setCampusInst] = useState<any>(null);
  const [form, setForm] = useState(emptyForm);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [loginTitles, setLoginTitles] = useState<Record<string, string>>({});
  const [styleDrafts, setStyleDrafts] = useState<Record<string, any>>({});

  const setStyleDraft = (instId: string, patch: Record<string, any>) =>
    setStyleDrafts((m) => ({ ...m, [instId]: { ...(m[instId] || {}), ...patch } }));

  const saveLoginStyle = async (instId: string, inst: any) => {
    const d = styleDrafts[instId] || {};
    const payload = {
      login_subtitle: (d.login_subtitle ?? inst.login_subtitle ?? "").trim() || null,
      login_layout: d.login_layout ?? inst.login_layout ?? "split",
      login_overlay: Number(d.login_overlay ?? inst.login_overlay ?? 55),
      login_button_color: d.login_button_color ?? inst.login_button_color ?? null,
      primary_color: d.primary_color ?? inst.primary_color ?? null,
      secondary_color: d.secondary_color ?? inst.secondary_color ?? null,
      accent_color: d.accent_color ?? inst.accent_color ?? null,
    };
    const { error } = await (supabase as any).from("institutions").update(payload).eq("id", instId);
    if (error) return toast.error(error.message);
    toast.success("Style de la page de connexion appliqué");
    qc.invalidateQueries({ queryKey: ["sa-institutions"] });
  };


  const saveLoginTitle = async (instId: string) => {
    const value = (loginTitles[instId] ?? "").trim();
    const { error } = await (supabase as any)
      .from("institutions")
      .update({ login_title: value || null })
      .eq("id", instId);
    if (error) return toast.error(error.message);
    toast.success("Nom de la page de connexion mis à jour");
    qc.invalidateQueries({ queryKey: ["sa-institutions"] });
  };

  const { data: institutions = [] } = useQuery({
    queryKey: ["sa-institutions"],
    queryFn: async () => {
      const { data } = await supabase.from("institutions" as any).select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Comptes administrateurs (1 par établissement) pour afficher l'email actuel
  const { data: adminAccounts = [] } = useQuery({
    queryKey: ["sa-institution-admins"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const ids = (roles || []).map((r: any) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, email, first_name, last_name, institution_id").in("user_id", ids);
      return data || [];
    },
  });
  const adminByInst = new Map((adminAccounts as any[]).filter((a) => a.institution_id).map((a) => [a.institution_id, a]));

  const [credDrafts, setCredDrafts] = useState<Record<string, { email?: string; password?: string }>>({});
  const [savingCred, setSavingCred] = useState<string | null>(null);
  const setCred = (id: string, patch: any) => setCredDrafts((m) => ({ ...m, [id]: { ...(m[id] || {}), ...patch } }));

  const saveCredentials = async (inst: any) => {
    const existing = adminByInst.get(inst.id);
    const d = credDrafts[inst.id] || {};
    const email = (d.email ?? existing?.email ?? inst.email ?? "").trim();
    const password = (d.password || "").trim();
    if (!email) return toast.error("Email requis");
    if (!existing && !password) return toast.error("Mot de passe requis pour créer le compte");
    setSavingCred(inst.id);
    const { data, error } = await supabase.functions.invoke("set-institution-admin", {
      body: {
        institution_id: inst.id,
        email,
        password: password || undefined,
        first_name: existing?.first_name || "Admin",
        last_name: existing?.last_name || inst.name,
        user_id: existing?.user_id,
      },
    });
    setSavingCred(null);
    if (error || (data as any)?.error) return toast.error((data as any)?.error || error!.message);
    setCred(inst.id, { password: "" });
    qc.invalidateQueries({ queryKey: ["sa-institution-admins"] });
    toast.success((data as any)?.created ? "Compte administrateur créé" : "Identifiants mis à jour");
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // Les policies du bucket "avatars" exigent que le 1er dossier soit l'uid de l'uploader
  const uploadInstitutionImage = async (instId: string, file: File, kind: "logo" | "cover") => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) throw new Error("Session expirée, reconnectez-vous");
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${uid}/institutions/${instId}/${kind}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type || undefined });
    if (upErr) throw upErr;
    return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  };


  const createMutation = useMutation({
    mutationFn: async () => {
      const prof = PROFILES.find((p) => p.id === form.profile) || PROFILES[0];
      const { data: inst, error } = await supabase.from("institutions" as any).insert({
        name: form.name, slogan: form.slogan || null, description: form.description || null,
        address: form.address || null, email: form.email || null, phone: form.phone || null,
        primary_color: form.primary_color, secondary_color: form.secondary_color, accent_color: form.accent_color,
        domain: form.domain || null, institution_type: prof.institution_type, academic_year: form.academic_year,
        cycle: prof.cycle, enabled_cycles: prof.enabled_cycles, is_multi_campus: form.is_multi_campus,
      } as any).select().single();
      if (error) throw error;
      if (logoFile && inst) {
        try {
          const url = await uploadInstitutionImage((inst as any).id, logoFile, "logo");
          await supabase.from("institutions" as any).update({ logo_url: url } as any).eq("id", (inst as any).id);
        } catch (err: any) {
          toast.error(`Logo non envoyé : ${err.message}`);
        }
      }

    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-institutions"] });
      toast.success("Établissement créé !");
      setOpen(false); setForm(emptyForm); setLogoFile(null); setLogoPreview(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const prof = PROFILES.find((p) => p.id === (editInst.profile || detectProfile(editInst))) || PROFILES[0];
      const { error } = await (supabase as any).from("institutions").update({
        name: editInst.name, slogan: editInst.slogan || null, description: editInst.description || null,
        address: editInst.address || null, email: editInst.email || null, phone: editInst.phone || null,
        primary_color: editInst.primary_color, secondary_color: editInst.secondary_color, accent_color: editInst.accent_color,
        domain: editInst.domain || null, institution_type: prof.institution_type, academic_year: editInst.academic_year,
        cycle: prof.cycle, enabled_cycles: prof.enabled_cycles, is_multi_campus: editInst.is_multi_campus || false,
      }).eq("id", editInst.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-institutions"] });
      toast.success("Établissement modifié !");
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("delete-institution", { body: { institution_id: id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sa-institutions"] });
      setInstitutionToDelete(null);
      toast.success("Établissement supprimé définitivement");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleLogoUpdate = async (instId: string) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]; if (!file) return;
      try {
        const url = await uploadInstitutionImage(instId, file, "logo");
        const { error } = await supabase.from("institutions" as any).update({ logo_url: `${url}?v=${Date.now()}` } as any).eq("id", instId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["sa-institutions"] });
        toast.success("Logo mis à jour !");
      } catch (err: any) {
        toast.error(`Erreur upload : ${err.message}`);
      }
    };
    input.click();
  };

  const handleCoverUpdate = async (instId: string) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0]; if (!file) return;
      try {
        const url = await uploadInstitutionImage(instId, file, "cover");
        const { error } = await supabase.from("institutions" as any).update({ cover_image_url: `${url}?v=${Date.now()}` } as any).eq("id", instId);
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ["sa-institutions"] });
        toast.success("Image de fond de la page de connexion mise à jour !");
      } catch (err: any) {
        toast.error(`Erreur upload : ${err.message}`);
      }
    };
    input.click();
  };


  const genKey = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
  };

  const generateAccessKey = async (instId: string) => {
    const key = genKey();
    const { error } = await supabase.from("institutions" as any).update({ access_key: key } as any).eq("id", instId);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["sa-institutions"] });
    try { await navigator.clipboard.writeText(key); } catch { /* ignore */ }
    toast.success(`Clé d'accès générée : ${key} (copiée)`);
  };

  const copyKey = async (key: string) => {
    try { await navigator.clipboard.writeText(key); toast.success("Clé copiée !"); }
    catch { toast.error("Impossible de copier"); }
  };

  const removeCover = async (instId: string) => {
    await supabase.from("institutions" as any).update({ cover_image_url: null } as any).eq("id", instId);
    qc.invalidateQueries({ queryKey: ["sa-institutions"] });
    toast.success("Image de fond retirée (image par défaut appliquée)");
  };


  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const setE = (k: string, v: any) => setEditInst({ ...editInst, [k]: v });

  const renderFormFields = (f: any, setter: (k: string, v: any) => void, isEdit = false) => (
    <div className="space-y-4">
      {!isEdit && (
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Logo</label>
          <div className="flex items-center gap-4">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo" className="w-20 h-20 rounded-xl object-cover border border-border" />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-secondary flex items-center justify-center border border-dashed border-border">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <label className="cursor-pointer">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-sm font-medium">
                <Upload className="w-4 h-4" /> {logoPreview ? "Changer" : "Importer"}
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
            </label>
          </div>
        </div>
      )}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Profil de l'établissement *</label>
        <Select
          value={f.profile || detectProfile(f)}
          onValueChange={(v) => setter("profile", v)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROFILES.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          Détermine automatiquement les interfaces disponibles pour l'admin (UE/crédits, matières/coefficients, trimestres, séries…).
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Année académique</label>
          <Input value={f.academic_year} onChange={(e) => setter("academic_year", e.target.value)} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Multi-campus</label>
          <div className="h-10 flex items-center gap-2 px-3 rounded-md border border-input bg-background">
            <Switch checked={!!f.is_multi_campus} onCheckedChange={(v) => setter("is_multi_campus", v)} />
            <span className="text-sm">{f.is_multi_campus ? "Activé (plusieurs sites)" : "Un seul site"}</span>
          </div>
        </div>
      </div>
      <Input placeholder="Nom *" value={f.name} onChange={(e) => setter("name", e.target.value)} />
      <Input placeholder="Slogan" value={f.slogan || ""} onChange={(e) => setter("slogan", e.target.value)} />
      <Textarea placeholder="Description" value={f.description || ""} onChange={(e) => setter("description", e.target.value)} rows={2} />
      <div className="grid grid-cols-2 gap-3">
        <Input type="email" placeholder="Email" value={f.email || ""} onChange={(e) => setter("email", e.target.value)} />
        <PhoneInput value={f.phone} onChange={phone=>setter("phone",phone)}/>
      </div>
      <Input placeholder="Adresse" value={f.address || ""} onChange={(e) => setter("address", e.target.value)} />
      <Input placeholder="Domaine" value={f.domain || ""} onChange={(e) => setter("domain", e.target.value)} />
      <div className="grid grid-cols-3 gap-3">
        {[["primary_color", "Principale"], ["secondary_color", "Secondaire"], ["accent_color", "Accent"]].map(([key, label]) => (
          <div key={key} className="space-y-1">
            <label className="text-xs text-muted-foreground">{label}</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={f[key] || "#000"} onChange={(e) => setter(key, e.target.value)} className="w-10 h-10 rounded cursor-pointer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Établissements</h1>
          <p className="text-muted-foreground mt-1">Gérez toutes les institutions inscrites</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setLogoFile(null); setLogoPreview(null); } }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white gap-2">
              <Plus className="w-4 h-4" /> Nouvel établissement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Créer un établissement</DialogTitle></DialogHeader>
            {renderFormFields(form, set)}
            <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white mt-2">
              {createMutation.isPending ? "Création..." : "Créer"}
            </Button>
          </DialogContent>
        </Dialog>
      </motion.div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Modifier l'établissement</DialogTitle></DialogHeader>
          {editInst && renderFormFields(editInst, setE, true)}
          <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white mt-2">
            {updateMutation.isPending ? "Sauvegarde..." : "Sauvegarder"}
          </Button>
        </DialogContent>
      </Dialog>

      <motion.div variants={item} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {institutions.map((inst: any) => (
          <Card key={inst.id} className="border-border/50 overflow-hidden hover:shadow-lg transition-shadow">
            <div className="h-2" style={{ background: `linear-gradient(135deg, ${inst.primary_color}, ${inst.secondary_color})` }} />
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => handleLogoUpdate(inst.id)} className="relative group" title="Changer le logo">
                    {inst.logo_url ? (
                      <img src={inst.logo_url} alt={`Logo ${inst.name}`} className="w-12 h-12 rounded-xl object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: inst.primary_color }}>
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="absolute inset-0 rounded-xl bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Upload className="w-4 h-4 text-white" />
                    </div>
                  </button>
                  <div>
                    <h3 className="font-semibold text-foreground">{inst.name}</h3>
                    <p className="text-xs text-muted-foreground">{inst.institution_type === "highschool" ? "🏫 Lycée" : "🎓 Université"}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  {inst.is_multi_campus && (
                    <Button variant="ghost" size="icon" title="Gérer les campus" onClick={() => setCampusInst(inst)}>
                      <MapPin className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => { setEditInst({ ...inst, profile: detectProfile(inst) }); setEditOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setInstitutionToDelete(inst)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 mb-2 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary font-medium">
                  {PROFILES.find((p) => p.id === detectProfile(inst))?.label || `Cycle ${(inst.cycle || "lmd").toUpperCase()}`}
                </span>
                {inst.is_multi_campus && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                    Multi-campus
                  </span>
                )}
              </div>
              {inst.slogan && <p className="text-sm italic text-muted-foreground mb-2">{inst.slogan}</p>}
              <div className="space-y-1 text-xs text-muted-foreground">
                {inst.email && <p>📧 {inst.email}</p>}
                {inst.phone && <p>📞 {inst.phone}</p>}
                {inst.address && <p>📍 {inst.address}</p>}
                {inst.domain && <p className="flex items-center gap-1"><Globe2 className="w-3 h-3" /> {inst.domain}</p>}
                {(inst.slug || inst.custom_domain) && (
                  <p className="flex items-center gap-1 text-primary">
                    <Globe2 className="w-3 h-3" />
                    <a
                      href={inst.slug ? `${window.location.origin}/e/${encodeURIComponent(inst.slug)}` : `${window.location.origin}/login`}
                      target="_blank" rel="noreferrer" className="hover:underline"
                    >
                      {inst.slug ? `/e/${inst.slug}` : '/login'}
                    </a>

                  </p>
                )}
              </div>

              <div className="mt-3 rounded-lg border border-border/60 p-2">
                <p className="text-[11px] font-medium text-muted-foreground mb-2">Page de connexion personnalisée</p>
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Nom affiché sur la page de connexion"
                    value={loginTitles[inst.id] ?? inst.login_title ?? ""}
                    onChange={(e) => setLoginTitles((m) => ({ ...m, [inst.id]: e.target.value }))}
                  />
                  <Button size="sm" className="h-8 text-xs" onClick={() => saveLoginTitle(inst.id)}>
                    Enregistrer
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">Laissez vide pour utiliser le nom de l'établissement.</p>

                <div className="grid gap-2 mb-3">
                  <Input
                    className="h-8 text-xs"
                    placeholder="Slogan / phrase d'accroche affichée sous le nom"
                    value={styleDrafts[inst.id]?.login_subtitle ?? inst.login_subtitle ?? ""}
                    onChange={(e) => setStyleDraft(inst.id, { login_subtitle: e.target.value })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-[10px] text-muted-foreground">
                      Style de page
                      <select
                        className="mt-1 w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                        value={styleDrafts[inst.id]?.login_layout ?? inst.login_layout ?? "split"}
                        onChange={(e) => setStyleDraft(inst.id, { login_layout: e.target.value })}
                      >
                        <option value="split">Deux colonnes (visuel + formulaire)</option>
                        <option value="centered">Centré plein écran</option>
                      </select>
                    </label>
                    <label className="text-[10px] text-muted-foreground">
                      Voile sur l'image : {styleDrafts[inst.id]?.login_overlay ?? inst.login_overlay ?? 55}%
                      <input
                        type="range" min={0} max={95} step={5}
                        className="mt-3 w-full accent-primary"
                        value={styleDrafts[inst.id]?.login_overlay ?? inst.login_overlay ?? 55}
                        onChange={(e) => setStyleDraft(inst.id, { login_overlay: Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {([
                      ["primary_color", "Principale"],
                      ["secondary_color", "Secondaire"],
                      ["accent_color", "Accent"],
                      ["login_button_color", "Bouton"],
                    ] as const).map(([field, label]) => (
                      <label key={field} className="text-[10px] text-muted-foreground">
                        {label}
                        <input
                          type="color"
                          className="mt-1 h-8 w-full rounded-md border border-input bg-background p-0.5"
                          value={styleDrafts[inst.id]?.[field] ?? inst[field] ?? "#2563EB"}
                          onChange={(e) => setStyleDraft(inst.id, { [field]: e.target.value } as any)}
                        />
                      </label>
                    ))}
                  </div>
                  <Button size="sm" className="h-8 text-xs w-full" onClick={() => saveLoginStyle(inst.id, inst)}>
                    Appliquer le style de la page de connexion
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-20 h-12 rounded-md overflow-hidden bg-secondary flex items-center justify-center shrink-0">
                    {inst.cover_image_url ? (
                      <img src={inst.cover_image_url} alt={`Fond de connexion ${inst.name}`} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => handleCoverUpdate(inst.id)}>
                      <Upload className="w-3 h-3 mr-1" /> {inst.cover_image_url ? "Changer le fond" : "Ajouter un fond"}
                    </Button>
                    {inst.cover_image_url && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => removeCover(inst.id)}>
                        Utiliser le fond par défaut
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-lg border border-border/60 p-2">
                <p className="text-[11px] font-medium text-muted-foreground mb-2">
                  Identifiants de connexion administrateur
                </p>
                <div className="grid gap-2">
                  <Input
                    className="h-8 text-xs"
                    type="email"
                    placeholder="Email de connexion"
                    value={credDrafts[inst.id]?.email ?? adminByInst.get(inst.id)?.email ?? ""}
                    onChange={(e) => setCred(inst.id, { email: e.target.value })}
                  />
                  <Input
                    className="h-8 text-xs"
                    type="text"
                    placeholder={adminByInst.get(inst.id) ? "Nouveau mot de passe (laisser vide pour garder)" : "Mot de passe (min. 6 caractères)"}
                    value={credDrafts[inst.id]?.password ?? ""}
                    onChange={(e) => setCred(inst.id, { password: e.target.value })}
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs w-full"
                    disabled={savingCred === inst.id}
                    onClick={() => saveCredentials(inst)}
                  >
                    {savingCred === inst.id
                      ? "Enregistrement..."
                      : adminByInst.get(inst.id)
                        ? "Mettre à jour les identifiants"
                        : "Créer le compte administrateur"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    {adminByInst.get(inst.id)
                      ? "Compte existant — modifiable à tout moment."
                      : "Aucun compte administrateur pour cet établissement."}
                  </p>
                </div>
              </div>


              <div className="mt-3 rounded-lg border border-border/60 p-2">
                <p className="text-[11px] font-medium text-muted-foreground mb-2">Clé d'accès</p>
                {inst.access_key ? (
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs font-mono px-2 py-1 rounded bg-secondary tracking-widest truncate">{inst.access_key}</code>
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => copyKey(inst.access_key)}>Copier</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => generateAccessKey(inst.id)}>Régénérer</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex-1">Aucune clé générée</span>
                    <Button size="sm" className="h-7 text-xs" onClick={() => generateAccessKey(inst.id)}>Générer la clé</Button>
                  </div>
                )}
              </div>


              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{inst.academic_year}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${inst.is_active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {inst.is_active ? "Actif" : "Inactif"}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <AlertDialog open={!!institutionToDelete} onOpenChange={(open) => !open && setInstitutionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer définitivement cet établissement ?</AlertDialogTitle>
            <AlertDialogDescription>
              {institutionToDelete ? `L'établissement ${institutionToDelete.name} sera supprimé définitivement. Cette action est irréversible.` : "Cette action est irréversible."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => institutionToDelete && deleteMutation.mutate(institutionToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Suppression..." : "Oui, supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CampusManagerDialog institution={campusInst} open={!!campusInst} onOpenChange={(v) => !v && setCampusInst(null)} />
    </motion.div>
  );
};

export default SuperAdminInstitutionsPage;
