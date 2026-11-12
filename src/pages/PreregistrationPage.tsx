import {PhoneInput} from '@/components/ui/phone-input';
import { invokeServer, ServerCallError } from '@/lib/serverCall';
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Upload, CheckCircle2, ArrowLeft, Loader2, FileCheck, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

const PROFILES = [
  { id: "univ_lmd",   label: "🎓 Université — LMD (UE, crédits, semestres)", institution_type: "university", cycle: "lmd", enabled_cycles: ["universite"] },
  { id: "univ_bts",   label: "📘 Université — BTS (matières, coefficients)", institution_type: "university", cycle: "bts", enabled_cycles: ["universite"] },
  { id: "lycee",      label: "🏫 Lycée (2nde, 1ère, Terminale — séries)",     institution_type: "highschool", cycle: "lmd", enabled_cycles: ["lycee"] },
  { id: "college",    label: "🏫 Collège (6e, 5e, 4e, 3e)",                   institution_type: "highschool", cycle: "lmd", enabled_cycles: ["college"] },
  { id: "coll_lycee", label: "🏫 Collège + Lycée",                             institution_type: "highschool", cycle: "lmd", enabled_cycles: ["college", "lycee"] },
];

const schema = z.object({
  institution_name: z.string().trim().min(2).max(200),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  official_email: z.string().trim().email().max(255),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  director_name: z.string().trim().min(2).max(200),
});

type FileField = "director_id" | "rccm" | "nif" | "agrement" | "logo";
const FILE_FIELDS: { key: FileField; label: string; required: boolean; accept: string }[] = [
  { key: "director_id", label: "Pièce d'identité du directeur (CNI/Passeport)", required: true, accept: "image/*,application/pdf" },
  { key: "rccm", label: "RCCM (Registre du Commerce)", required: true, accept: "image/*,application/pdf" },
  { key: "nif", label: "NIF (Numéro d'Identification Fiscale)", required: true, accept: "image/*,application/pdf" },
  { key: "agrement", label: "Agrément / Autorisation d'ouverture", required: true, accept: "image/*,application/pdf" },
  { key: "logo", label: "Logo officiel de l'établissement", required: true, accept: "image/png,image/jpeg,image/jpg" },
];

const slugify = (v: string) =>
  v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export default function PreregistrationPage() {

  const navigate = useNavigate();
  const [form, setForm] = useState({ institution_name: "", address: "", official_email: "", phone: "", director_name: "", profile: "univ_lmd", desired_slug: "", domain_mode: "subdomain", custom_domain: "" });
  const [files, setFiles] = useState<Record<FileField, File | null>>({ director_id: null, rccm: null, nif: null, agrement: null, logo: null });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [service, setService] = useState<{document_review:boolean;email:boolean}|null>(null);
  const [consent, setConsent] = useState(false);
  const [stage, setStage] = useState('');
  const [issues, setIssues] = useState<Record<string,{status:string;note:string}>>({});
  const [receipt, setReceipt] = useState<{id:string;email:{status:string}}|null>(null);
  useEffect(()=>{void invokeServer<{document_review:boolean;email:boolean}>('onboarding-status',{}).then(setService).catch(()=>setService({document_review:false,email:false}));},[]);

  const setField = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const setFile = (k: FileField) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && f.size > 10 * 1024 * 1024) { toast.error("Fichier trop volumineux (max 10 Mo)"); return; }
    setFiles((s) => ({ ...s, [k]: f }));
    setIssues(s=>{const next={...s};delete next[k];return next;});
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if(!service?.document_review){toast.error('Le contrôle documentaire doit être activé avant le dépôt.');return;}
    if(!consent){toast.error('Votre accord est requis pour l’analyse des pièces.');return;}
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error('Vérifiez les champs et l’email.'); return; }
    const desiredSlug = slugify(form.desired_slug || form.institution_name);
    if (desiredSlug.length < 3) { toast.error('Identifiant requis : 3 caractères minimum.'); return; }
    for (const field of FILE_FIELDS) if (field.required && !files[field.key]) { toast.error('Document requis : '+field.label); return; }
    setLoading(true);
    setIssues({});setStage('Préparation du dépôt sécurisé…');
    try {
      const documents = Object.fromEntries(FILE_FIELDS.map(field => [field.key, { type:files[field.key]!.type, size:files[field.key]!.size }]));
      const intake = await invokeServer<{id:string;token:string;uploads:Record<FileField,{path:string;token:string}>}>('begin-preregistration', { ...parsed.data, profile:form.profile, desired_slug:desiredSlug, documents, document_processing_consent:consent });
      for (const field of FILE_FIELDS) {
        setStage('Transfert : '+field.label);
        const upload = intake.uploads[field.key];
        const { error } = await supabase.storage.from('preregistrations').uploadToSignedUrl(upload.path,upload.token,files[field.key]!,{contentType:files[field.key]!.type});
        if (error) throw error;
      }
      setStage('Analyse du type et de la lisibilité des documents…');
      const result=await invokeServer<{id:string;email:{status:string}}>('submit-preregistration',{id:intake.id,token:intake.token});
      setReceipt(result);
      setDone(true); toast.success('Dossier reçu et placé en attente de validation.');
    } catch(error) { if(error instanceof ServerCallError&&error.details?.documents)setIssues(error.details.documents as Record<string,{status:string;note:string}>);toast.error(error instanceof Error ? error.message : 'Envoi impossible.'); }
    finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="max-w-lg">
            <CardContent className="p-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-success" />
              </div>
              <h2 className="text-2xl font-bold">Dossier reçu !</h2>
              <p className="text-muted-foreground">
                Merci. Votre dossier de préinscription est en cours d'examen par notre équipe.
                Vous recevrez une réponse sur <strong>{form.official_email}</strong> après son examen.
              </p>
              <p className="rounded-lg bg-muted p-3 text-sm">{receipt?.email.status==='sent'?'Un accusé de réception a été transmis au service email. Un second message vous annoncera la décision.':'Votre accusé de réception est en attente d’envoi. L’envoi email n’est pas encore confirmé ; conservez votre référence.'}</p>
              <p className="text-xs break-all">Référence : {receipt?.id}</p>
              <p className="text-sm font-medium text-primary">Votre essai gratuit de 14 jours commencera après validation, sans prélèvement automatique.</p>
              <Button onClick={() => navigate("/")} className="mt-4">Retour à l'accueil</Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-4 h-4" /> Accueil
        </Link>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Préinscription établissement</CardTitle>
                  <CardDescription>Remplissez ce dossier pour rejoindre Rectorplus. Votre dossier sera examiné par la super administration.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 rounded-xl border border-primary/25 bg-primary/5 p-4"><h2 className="font-semibold text-primary">14 jours d’essai gratuit après validation</h2><p className="mt-1 text-sm text-muted-foreground">Votre dossier est examiné avant l’ouverture de l’établissement. Aucun paiement au dépôt ni prélèvement automatique. Un abonnement sera nécessaire pour continuer après l’essai.</p></div>
              {!service?.document_review&&<div role="status" className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{service===null?'Vérification de la disponibilité du dépôt…':'Le dépôt est temporairement fermé pendant l’activation du contrôle documentaire. Aucun fichier ne sera envoyé ni déclaré vérifié.'}</div>}
              <ol className="mb-6 grid grid-cols-3 gap-2 text-xs text-muted-foreground"><li>1. Déposer les pièces</li><li>2. Précontrôle et examen humain</li><li>3. Décision par email</li></ol>
              <form onSubmit={submit} className="space-y-6">
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">1. Identité de l'établissement</h3>
                  <div className="grid gap-3">
                    <div>
                      <Label>Type d'établissement *</Label>
                      <Select value={form.profile} onValueChange={(v) => setForm((f) => ({ ...f, profile: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROFILES.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground mt-1">Détermine les interfaces disponibles après validation.</p>
                    </div>
                    <div>
                      <Label>Nom de l'établissement *</Label>
                      <Input value={form.institution_name} onChange={setField("institution_name")} required maxLength={200} />
                    </div>
                    <div>
                      <Label>Adresse</Label>
                      <Textarea value={form.address} onChange={setField("address")} maxLength={500} rows={2} />
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Email officiel *</Label>
                        <Input type="email" value={form.official_email} onChange={setField("official_email")} required maxLength={255} />
                      </div>
                      <div>
                        <Label>Téléphone</Label>
                        <PhoneInput value={form.phone} onChange={phone=>setForm(prev=>({...prev,phone}))}/>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">2. Adresse de connexion</h3>
                  <div><Label>Identifiant de l’établissement *</Label><Input value={form.desired_slug} onChange={event=>setForm(current=>({...current,desired_slug:slugify(event.target.value)}))} placeholder="mon-ecole" minLength={3} maxLength={40} required /><p className="text-xs text-muted-foreground mt-2">Votre adresse après validation : {window.location.origin}/e/{form.desired_slug || 'mon-ecole'}. Aucun domaine supplémentaire n’est nécessaire.</p></div>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">3. Responsable</h3>
                  <div>
                    <Label>Nom du directeur / promoteur *</Label>
                    <Input value={form.director_name} onChange={setField("director_name")} required maxLength={200} />
                  </div>
                </section>


                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground/90 uppercase tracking-wide">4. Documents (PDF ou image, max 10 Mo)</h3>
                  <div className="grid gap-3">
                    {FILE_FIELDS.map((f) => (
                      <div key={f.key} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{f.label} {f.required && <span className="text-destructive">*</span>}</p>
                          {files[f.key] && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                              <FileCheck className="w-3 h-3" /> {files[f.key]!.name} — sélectionné, non vérifié
                            </p>
                          )}
                          {issues[f.key]&&<p className={`mt-2 text-xs ${issues[f.key].status==='needs_correction'?'text-destructive':'text-muted-foreground'}`}>{issues[f.key].note}</p>}
                        </div>
                        <label className="cursor-pointer">
                          <input type="file" accept={f.accept} onChange={setFile(f.key)} className="hidden" />
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input bg-background text-xs hover:bg-accent">
                            <Upload className="w-3.5 h-3.5" /> Choisir
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="bg-muted/40 border rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <Mail className="w-4 h-4 mt-0.5 shrink-0" />
                  Deux messages sont prévus : un accusé de réception après le dépôt accepté, puis une décision après examen. Vous pourrez répondre aux emails pour contacter notre équipe. {service&&!service.email&&'Le service d’envoi reste à activer ; les notifications seront conservées en attente.'}
                </div>

                <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} required className="mt-1 h-4 w-4 shrink-0" /><span>J’accepte que les documents soient transmis au prestataire OpenAI pour vérifier leur type et leur lisibilité, puis examinés par RectorPlus. Le précontrôle ne certifie pas leur authenticité. <Link to="/confidentialite" className="text-primary underline">Confidentialité</Link></span></label>

                <Button type="submit" disabled={loading||!service?.document_review||!consent} className="w-full min-h-11 h-auto py-3">
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {stage}</> : "Vérifier et envoyer mon dossier"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
