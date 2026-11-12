import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useInstitution } from "@/hooks/useInstitution";
import { generateClassBulletinsPdf } from "@/lib/bulletinPdf";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CheckCircle2, XCircle, FileCheck2, Search, Eye, Loader2, Download, Lock } from "lucide-react";
import { toast } from "sonner";
import type { ValidatorRoleConfig } from "@/lib/validatorRoles";

const ALL_TYPES = [
  { value: "releve",       label: "Relevés",          pedagogiqueOnly: false },
  { value: "bulletin",     label: "Bulletins",        pedagogiqueOnly: false },
  { value: "attestation",  label: "Attestations",     pedagogiqueOnly: true  },
  { value: "pv",           label: "Procès-verbaux",   pedagogiqueOnly: false },
] as const;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending:    { label: "En attente",  color: "bg-amber-500/15 text-amber-700 border-amber-300/40" },
  validated:  { label: "Validé",      color: "bg-emerald-500/15 text-emerald-700 border-emerald-300/40" },
  rejected:   { label: "Rejeté",      color: "bg-destructive/15 text-destructive border-destructive/30" },
  to_correct: { label: "À corriger",  color: "bg-blue-500/15 text-blue-700 border-blue-300/40" },
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function ValidatorDocumentsPage({ role }: { role: ValidatorRoleConfig }) {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const { institution } = useInstitution();
  const instId = profile?.institution_id;
  const [tab, setTab] = useState<typeof ALL_TYPES[number]["value"]>("releve");
  const [status, setStatus] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const colStatus = `${role.col}_status`;
  const colSignedBy = `${role.col}_signed_by`;
  const colSignedAt = `${role.col}_signed_at`;
  const colSigId = `${role.col}_signature_id`;
  const colReject = `${role.col}_rejection_reason`;

  const { data: signature } = useQuery({
    queryKey: ["validator-active-sig", instId, role.scope],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("director_signatures")
        .select("*")
        .eq("institution_id", instId!)
        .eq("role_scope", role.scope)
        .eq("is_active", true)
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!instId,
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["validator-docs", instId, role.key, tab, status],
    queryFn: async () => {
      let q = (supabase as any)
        .from("document_validations")
        .select("*")
        .eq("institution_id", instId!)
        .eq("document_type", tab)
        .order("created_at", { ascending: false });
      if (status !== "all") q = q.eq(colStatus, status);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  // Realtime: new submissions / status updates appear immediately
  useEffect(() => {
    if (!instId) return;
    const ch = supabase
      .channel(`validator-docs-${role.key}-${instId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "document_validations", filter: `institution_id=eq.${instId}` },
        () => qc.invalidateQueries({ queryKey: ["validator-docs", instId, role.key] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [instId, role.key, qc]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter((d: any) => (d.title || "").toLowerCase().includes(s));
  }, [docs, search]);

  const validateMutation = useMutation({
    mutationFn: async (doc: any) => {
      if (!signature?.id) throw new Error("Aucune signature active. Configurez votre signature & cachet d'abord.");
      const { error } = await (supabase as any)
        .from("document_validations")
        .update({
          [colStatus]: "validated",
          [colSignedBy]: user!.id,
          [colSignedAt]: new Date().toISOString(),
          [colSigId]: signature.id,
          [colReject]: null,
        })
        .eq("id", doc.id);
      if (error) throw error;
      return doc;
    },
    onSuccess: () => {
      toast.success("Validation enregistrée. Le téléchargement signé sera disponible une fois la double validation atteinte.");
      qc.invalidateQueries({ queryKey: ["validator-docs", instId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Téléchargement explicite — uniquement disponible après la (double) validation.
  const downloadSignedMutation = useMutation({
    mutationFn: async (doc: any) => {
      const isAttestation = doc.document_type === "attestation";
      const bothValidated = isAttestation
        ? doc.pedagogique_status === "validated"
        : doc.pedagogique_status === "validated" && doc.cycle_status === "validated";
      if (!bothValidated || doc.status !== "validated") {
        throw new Error("Téléchargement bloqué : double validation (Pédagogique + Cycle) requise.");
      }
      if (!institution) throw new Error("Établissement introuvable");
      const payload = doc.payload || {};
      await generateClassBulletinsPdf({
        institution,
        academicYear: payload.academicYear || doc.academic_year,
        results: payload.results || [],
        params: payload.params || {},
        withSignatures: true,
        refreshFromDatabase: false, document: doc,
      });
    },
    onSuccess: () => toast.success("Bulletins signés téléchargés"),
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectReason.trim()) throw new Error("Motif obligatoire");
      const { error } = await (supabase as any)
        .from("document_validations")
        .update({
          [colStatus]: "rejected",
          [colReject]: rejectReason.trim(),
          [colSignedBy]: user!.id,
          [colSignedAt]: new Date().toISOString(),
        })
        .eq("id", rejecting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document renvoyé pour correction");
      setRejecting(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["validator-docs", instId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
          <FileCheck2 className="w-7 h-7 text-accent" /> Documents à valider — {role.label}
        </h1>
        <p className="text-muted-foreground mt-1">
          Vérifiez les documents officiels et apposez votre signature numérique.
          La double validation (Pédagogique + Cycle) est requise avant émission finale.
        </p>
        {!signature && (
          <Badge variant="outline" className="mt-2 border-amber-300/50 text-amber-700 bg-amber-50">
            Aucune signature active : ajoutez-en une dans « Signature & cachet ».
          </Badge>
        )}
      </motion.div>

      <motion.div variants={item}>
        {(() => { return null; })()}
        {/* Filter out attestation tab for cycle role — only pédagogique handles it */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="flex flex-wrap">
            {ALL_TYPES.filter((t) => !(t.pedagogiqueOnly && role.col !== "pedagogique")).map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {ALL_TYPES.filter((t) => !(t.pedagogiqueOnly && role.col !== "pedagogique")).map((t) => (
            <TabsContent key={t.value} value={t.value} className="mt-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un document..." className="pl-9 bg-card" />
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-full sm:w-[180px] bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Card className="border-border/60">
                <CardContent className="p-0 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead>Titre</TableHead>
                        <TableHead>Année</TableHead>
                        <TableHead>Mon statut</TableHead>
                        <TableHead>Autre validation</TableHead>
                        <TableHead>Créé le</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>}
                      {!isLoading && filtered.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucun document.</TableCell></TableRow>
                      )}
                      {filtered.map((d: any) => {
                        const myStatus = d[colStatus] || "pending";
                        const otherCol = role.col === "pedagogique" ? "cycle_status" : "pedagogique_status";
                        const otherStatus = d[otherCol] || "pending";
                        const otherLabel = role.col === "pedagogique" ? "Cycle" : "Pédagogique";
                        const myStyle = STATUS_LABEL[myStatus];
                        const otherStyle = STATUS_LABEL[otherStatus];
                        return (
                          <TableRow key={d.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{d.title || "Document"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{d.academic_year || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={myStyle?.color}>{myStyle?.label}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={otherStyle?.color}>
                                {otherLabel} : {otherStyle?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(d.created_at).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 flex-wrap">
                                <Button variant="ghost" size="sm" onClick={() => setPreview(d)}>
                                  <Eye className="w-4 h-4 mr-1" /> Aperçu
                                </Button>
                                {myStatus !== "validated" && (
                                  <ConfirmDialog
                                    trigger={
                                      <Button variant="ghost" size="sm" className="text-emerald-700 hover:text-emerald-800" disabled={!signature}>
                                        <CheckCircle2 className="w-4 h-4 mr-1" /> Valider & signer
                                      </Button>
                                    }
                                    title="Valider ce document ?"
                                    description="Votre signature numérique sera apposée. Le téléchargement définitif (avec cachet) sera disponible après la double validation (Pédagogique + Cycle)."
                                    destructive={false}
                                    confirmText="Valider et signer"
                                    onConfirm={() => validateMutation.mutate(d)}
                                  />
                                )}
                                {(() => {
                                  const isAttestation = d.document_type === "attestation";
                                  const bothValidated = isAttestation
                                    ? d.pedagogique_status === "validated"
                                    : d.pedagogique_status === "validated" && d.cycle_status === "validated";
                                  return (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      disabled={!bothValidated || downloadSignedMutation.isPending}
                                      title={bothValidated ? "Télécharger la version signée" : "Téléchargement bloqué — double validation requise"}
                                      onClick={() => downloadSignedMutation.mutate(d)}
                                    >
                                      {bothValidated
                                        ? (<><Download className="w-4 h-4 mr-1" /> Télécharger (signé)</>)
                                        : (<><Lock className="w-4 h-4 mr-1" /> Téléchargement bloqué</>)}
                                    </Button>
                                  );
                                })()}
                                {myStatus !== "rejected" && (
                                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setRejecting(d); setRejectReason(""); }}>
                                    <XCircle className="w-4 h-4 mr-1" /> Rejeter
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </motion.div>

      <Dialog open={!!rejecting} onOpenChange={(o) => !o && setRejecting(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Renvoyer pour correction</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label className="text-xs">Motif (obligatoire)</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} rows={4} placeholder="Expliquez ce qui doit être corrigé..." />
            <Button className="w-full" disabled={rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
              {rejectMutation.isPending ? "Envoi..." : "Confirmer le renvoi"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!preview}
        onOpenChange={(o) => {
          if (!o) {
            if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
            setPreviewPdfUrl(null);
            setPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{preview?.title || "Aperçu du document"}</DialogTitle>
          </DialogHeader>
          {preview && (() => {
            const payload = preview.payload || {};
            const results: any[] = payload.results || [];
            const isReleve = payload.kind === "class_releves" || preview.document_type === "releve" || preview.document_type === "bulletin";
            return (
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 overflow-hidden">
                <div className="space-y-3 overflow-y-auto pr-2 text-sm">
                  <div className="space-y-1">
                    <p><span className="text-muted-foreground">Type :</span> {ALL_TYPES.find((t) => t.value === preview.document_type)?.label}</p>
                    <p><span className="text-muted-foreground">Année :</span> {preview.academic_year || "—"}</p>
                    <p><span className="text-muted-foreground">Pédagogique :</span> {STATUS_LABEL[preview.pedagogique_status]?.label}</p>
                    <p><span className="text-muted-foreground">Cycle :</span> {STATUS_LABEL[preview.cycle_status]?.label}</p>
                    {preview[colReject] && <p className="text-destructive"><span className="text-muted-foreground">Motif :</span> {preview[colReject]}</p>}
                  </div>
                  {isReleve && results.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium">Étudiants ({results.length})</p>
                      <div className="max-h-[55vh] overflow-y-auto border rounded-md divide-y">
                        {results.map((s: any, i: number) => (
                          <div key={i} className="px-3 py-2 text-xs flex justify-between gap-2">
                            <span className="truncate">{s.first_name} {s.last_name} <span className="text-muted-foreground">— {s.filiere_name || ""} {s.level || ""}</span></span>
                            <Badge variant="outline" className="shrink-0">
                              {(() => {
                                const v = s.general_average ?? s.annual_average ?? s.average ?? s.moyenne_generale ?? s.moyenne;
                                return v != null ? Number(v).toFixed(2) : "—";
                              })()}/20
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isReleve && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={previewLoading || !institution}
                      onClick={async () => {
                        try {
                          setPreviewLoading(true);
                          if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
                          const url = await generateClassBulletinsPdf({
                            institution,
                            academicYear: payload.academicYear || preview.academic_year,
                            results,
                            params: payload.params || {},
                            mode: "blob", document: preview,
                            withSignatures: false, // aperçu non validé : aucune signature/cachet
                            refreshFromDatabase: false,
                          });
                          setPreviewPdfUrl(url as string);
                        } catch (e: any) {
                          toast.error("Erreur d'aperçu : " + (e.message || e));
                        } finally {
                          setPreviewLoading(false);
                        }
                      }}
                    >
                      {previewLoading ? (<><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Génération...</>) : "Générer l'aperçu PDF"}
                    </Button>
                  )}
                </div>
                <div className="bg-muted/30 rounded-md overflow-hidden border">
                  {previewPdfUrl ? (
                    <iframe src={previewPdfUrl} className="w-full h-full" title="Aperçu PDF" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-6 text-center">
                      {isReleve
                        ? "Cliquez sur « Générer l'aperçu PDF » pour visualiser les relevés tels qu'ils seront imprimés."
                        : "Aucun aperçu PDF disponible pour ce type de document."}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
