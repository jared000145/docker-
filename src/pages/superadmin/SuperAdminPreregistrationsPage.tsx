import { invokeServer } from '@/lib/serverCall';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import { useState } from "react";
import { motion } from "framer-motion";
import { Building2, Search, Eye, CheckCircle2, XCircle, Clock, FileText, Loader2, Mail, Phone, MapPin, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Prereg = any;

export default function SuperAdminPreregistrationsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Prereg | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<{ email: string; invitationSent: boolean; institution: string; accessKey: string; loginUrl: string; customDomainUrl?: string | null } | null>(null);

  useRealtimeSubscription('institution_preregistrations', [['preregistrations']]);
  const {data: emailRows=[]}=useQuery({queryKey:['preregistration-emails',selected?.id],enabled:!!selected?.id,queryFn:async()=>{const {data,error}=await (supabase as any).from('preregistration_emails').select('id,kind,status,attempts,sent_at').eq('request_id',selected!.id).order('created_at');if(error)throw error;return data||[];}});
  const retryMail=useMutation({mutationFn:()=>invokeServer<{status:string}>('send-preregistration-email',{request_id:selected!.id}),onSuccess:result=>{toast.info(result.status==='sent'?'Messages transmis au service email.':'Envoi en attente : vérifiez la configuration ou patientez avant la prochaine tentative.');void qc.invalidateQueries({queryKey:['preregistration-emails',selected?.id]});},onError:(error:Error)=>toast.error(error.message)});

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["preregistrations"],
    queryFn: async () => {
      const q = supabase.from("institution_preregistrations").select("*").order("created_at", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = (rows as Prereg[]).filter((r) => {
    if(statusFilter!=='all' && r.status!==statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return r.institution_name?.toLowerCase().includes(s) || r.official_email?.toLowerCase().includes(s) || r.director_name?.toLowerCase().includes(s);
  });

  const stats = {
    pending: (rows as any[]).filter((r) => r.status === "pending").length,
    approved: (rows as any[]).filter((r) => r.status === "approved").length,
    rejected: (rows as any[]).filter((r) => r.status === "rejected").length,
  };

  const openDetails = async (row: Prereg) => {
    setSelected(row);
    setSignedUrls({});
    const paths = { director_id_url: row.director_id_url, rccm_url: row.rccm_url, nif_url: row.nif_url, agrement_url: row.agrement_url, logo_url: row.logo_url };
    const entries: [string, string][] = [];
    for (const [key, path] of Object.entries(paths)) {
      if (!path) continue;
      const { data } = await supabase.storage.from("preregistrations").createSignedUrl(path as string, 3600);
      if (data?.signedUrl) entries.push([key, data.signedUrl]);
    }
    setSignedUrls(Object.fromEntries(entries));
  };

  const approve = useMutation({
    mutationFn: async (row: Prereg) => {
      setBusy(row.id);
      return invokeServer<{email:string;institution:string;accessKey:string;loginUrl:string;invitationSent:boolean;customDomainUrl:null}>('approve-preregistration',{request_id:row.id});
    },
    onSuccess: (creds) => {
      toast.success("Établissement créé et admin provisionné");
      setCredentials(creds);
      qc.invalidateQueries({ queryKey: ["preregistrations"] });
      qc.invalidateQueries({ queryKey: ["sa-institutions"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setBusy(null),
  });

  const reject = useMutation({
    mutationFn: async (row: Prereg) => {
      if (!rejectReason.trim()) throw new Error("Motif de rejet requis");
      setBusy(row.id);
      return invokeServer('reject-preregistration',{request_id:row.id,reason:rejectReason});
    },
    onSuccess: () => {
      toast.success("Dossier rejeté");
      qc.invalidateQueries({ queryKey: ["preregistrations"] });
      setSelected(null); setRejectReason("");
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setBusy(null),
  });

  const StatusBadge = ({ s }: { s: string }) => {
    if (s === "pending") return <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> En attente</Badge>;
    if (s === "approved") return <Badge className="bg-success text-success-foreground gap-1"><CheckCircle2 className="w-3 h-3" /> Approuvé</Badge>;
    return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Rejeté</Badge>;
  };

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="w-8 h-8 text-accent" /> Préinscriptions
        </h1>
        <p className="text-muted-foreground mt-1">Dossiers d'établissements en attente de validation</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "En attente", count: stats.pending, icon: Clock, color: "text-warning" },
          { label: "Approuvés", count: stats.approved, icon: CheckCircle2, color: "text-success" },
          { label: "Rejetés", count: stats.rejected, icon: XCircle, color: "text-destructive" },
        ].map((s) => (
          <Card key={s.label}><CardContent className="p-4 flex items-center gap-3">
            <s.icon className={`w-8 h-8 ${s.color}`} />
            <div><p className="text-2xl font-bold">{s.count}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Nom, email, directeur…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="approved">Approuvés</SelectItem>
            <SelectItem value="rejected">Rejetés</SelectItem>
            <SelectItem value="all">Tous</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-2 opacity-30" />
              Aucun dossier
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((r: any) => (
                <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-muted/30 transition">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{r.institution_name}</h3>
                      <StatusBadge s={r.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1"><User className="w-3 h-3" />{r.director_name}</span>
                      <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" />{r.official_email}</span>
                      {r.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" />{r.phone}</span>}
                      <span>{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openDetails(r)}>
                    <Eye className="w-4 h-4 mr-1.5" /> Voir le dossier
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Dossier de préinscription</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <Info icon={Building2} label="Établissement" value={selected.institution_name} />
                <Info icon={User} label="Directeur" value={selected.director_name} />
                <Info icon={Mail} label="Email" value={selected.official_email} />
                <Info icon={Phone} label="Téléphone" value={selected.phone || "—"} />
                {selected.address && <div className="sm:col-span-2"><Info icon={MapPin} label="Adresse" value={selected.address} /></div>}
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2">Documents fournis</h4>
                <div className="mb-3 rounded-lg border bg-muted/30 p-3 text-xs"><p className="font-semibold">{selected.document_review?.status==='ready'?'Précontrôle documentaire terminé — examen humain requis':'Précontrôle documentaire absent — validation bloquée'}</p><p className="mt-1 text-muted-foreground">Le contrôle automatique porte sur le type et la lisibilité. Il ne certifie pas l’authenticité des pièces ni l’identité du déposant.</p>{Object.entries(selected.document_review?.documents||{}).map(([key,value])=><p className="mt-1" key={key}>{({director_id:'Identité du responsable',rccm:'RCCM',nif:'NIF',agrement:'Agrément',logo:'Logo'} as Record<string,string>)[key]||'Document'} : {(value as {note:string}).note}</p>)}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { k: "logo_url", label: "Logo officiel" },
                    { k: "director_id_url", label: "Pièce d'identité" },
                    { k: "rccm_url", label: "RCCM" },
                    { k: "nif_url", label: "NIF" },
                    { k: "agrement_url", label: "Agrément" },
                  ].map((f) => (
                    <a key={f.k} href={signedUrls[f.k]} target="_blank" rel="noreferrer"
                      className={`border rounded-lg p-3 flex items-center gap-2 text-sm ${signedUrls[f.k] ? "hover:bg-accent cursor-pointer" : "opacity-40 pointer-events-none"}`}>
                      <FileText className="w-4 h-4 text-accent shrink-0" />
                      <span className="flex-1 truncate">{f.label}</span>
                      {signedUrls[f.k] && <Eye className="w-4 h-4" />}
                    </a>
                  ))}
                </div>
              </div>

              <div className="text-sm">
                <p className="text-xs text-muted-foreground">Type demandé</p>
                <p className="font-medium">
                  {(() => {
                    const ec: string[] = selected.enabled_cycles || [];
                    if (ec.includes("college") && ec.includes("lycee")) return "🏫 Collège + Lycée";
                    if (ec.includes("lycee")) return "🏫 Lycée";
                    if (ec.includes("college")) return "🏫 Collège";
                    if (selected.cycle === "bts") return "📘 Université — BTS";
                    return "🎓 Université — LMD";
                  })()}
                </p>
              </div>

              {selected.status === "pending" && (
                <div className="space-y-3 border-t pt-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Motif (obligatoire pour rejet)</label>
                    <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={2} placeholder="Ex: Documents illisibles, RCCM manquant…" />
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={() => approve.mutate(selected)} disabled={!!busy||selected.document_review?.status!=='ready'}>
                      {busy === selected.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Approuver & créer l'établissement
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => reject.mutate(selected)} disabled={!!busy}>
                      <XCircle className="w-4 h-4 mr-2" /> Rejeter
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    L’établissement et le compte responsable seront créés après votre validation, avec un essai gratuit de 14 jours. Le responsable choisira son mot de passe par email.
                  </p>
                </div>
              )}
              <section className="rounded-lg border p-4 space-y-3"><h4 className="text-sm font-semibold">Emails du dossier</h4><p className="text-xs text-muted-foreground">« Transmis » signifie accepté par le service d’envoi, sans garantie de réception. Les réponses arrivent dans la boîte définie par RectorPlus.</p>{emailRows.map((mail:any)=><p className="text-xs" key={mail.id}>{mail.kind==='received'?'Accusé de réception':mail.kind==='approved'?'Confirmation de validation':'Décision de refus'} — {mail.status==='sent'?'Transmis au service email':mail.status==='failed'?'Échec d’envoi':mail.status==='sending'?'Envoi en cours':'En attente'}</p>)}<Button size="sm" variant="outline" disabled={retryMail.isPending} onClick={()=>retryMail.mutate()}>Réessayer les emails en attente</Button><a className="block text-sm text-primary underline" href={`mailto:${encodeURIComponent(selected.official_email)}?subject=${encodeURIComponent('RectorPlus — Dossier '+selected.id)}`}>Répondre à l’établissement depuis ma messagerie</a></section>

              {selected.status === "approved" && selected.created_institution_id && (
                <div className="border-t pt-4 text-sm text-success">
                  ✓ Établissement et administrateur principal créés automatiquement.
                </div>
              )}

              {selected.status === "rejected" && selected.rejection_reason && (
                <div className="border-t pt-4 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Motif de rejet</p>
                  <p className="text-destructive">{selected.rejection_reason}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!credentials} onOpenChange={(o) => !o && setCredentials(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Identifiants administrateur</DialogTitle></DialogHeader>
          {credentials && (
            <div className="space-y-4">
              <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-sm">
                ✓ Établissement <strong>{credentials.institution}</strong> créé. Le compte administrateur principal est prêt.
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <div className="font-mono text-sm bg-muted p-2 rounded select-all">{credentials.email}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Activation du compte</p>
                  <div className="font-mono text-sm bg-muted p-2 rounded select-all">{credentials.invitationSent ? 'Lien envoyé par email pour choisir le mot de passe.' : 'Email non envoyé : configurez SMTP puis utilisez « Mot de passe oublié ». Le compte est créé.'}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Clé d'accès de l'établissement</p>
                  <div className="font-mono text-sm bg-accent/10 border border-accent/30 p-2 rounded select-all tracking-widest">{credentials.accessKey}</div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Adresse de connexion</p>
                  <div className="font-mono text-xs bg-muted p-2 rounded select-all break-all">{credentials.loginUrl}</div>
                </div>


              </div>
              <Button
                className="w-full"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Adresse: ${credentials.loginUrl}\nClé d'accès: ${credentials.accessKey}\nEmail: ${credentials.email}\nActivation : choisir le mot de passe avec le lien reçu par email.`
                  );
                  toast.success("Identifiants copiés");
                }}
              >
                Copier les identifiants
              </Button>

              <p className="text-xs text-muted-foreground">Communiquez ces identifiants au directeur. Le directeur choisit son mot de passe depuis le lien reçu par email. Aucun mot de passe n’est partagé.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Info({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5" />
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium truncate">{value}</p></div>
    </div>
  );
}
