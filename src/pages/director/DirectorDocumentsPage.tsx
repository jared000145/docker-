import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { CheckCircle2, XCircle, FileCheck2, Search, Eye, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { generateClassBulletinsPdf } from "@/lib/bulletinPdf";
import { useInstitution } from "@/hooks/useInstitution";

const TYPES = [
  { value: "releve",       label: "Relevés" },
  { value: "bulletin",     label: "Bulletins" },
  { value: "attestation",  label: "Attestations" },
  { value: "pv",           label: "Procès-verbaux" },
] as const;

const STATUSES = [
  { value: "pending",     label: "En attente",  color: "bg-amber-500/15 text-amber-700 border-amber-300/40" },
  { value: "validated",   label: "Validé",      color: "bg-emerald-500/15 text-emerald-700 border-emerald-300/40" },
  { value: "rejected",    label: "Rejeté",      color: "bg-destructive/15 text-destructive border-destructive/30" },
  { value: "to_correct",  label: "À corriger",  color: "bg-blue-500/15 text-blue-700 border-blue-300/40" },
] as const;

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function DirectorDocumentsPage() {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const { institution } = useInstitution();
  const instId = profile?.institution_id;
  const [tab, setTab] = useState<typeof TYPES[number]["value"]>("releve");
  const [status, setStatus] = useState<string>("pending");
  const [search, setSearch] = useState("");
  const [rejecting, setRejecting] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [preview, setPreview] = useState<any>(null);

  const { data: signature } = useQuery({
    queryKey: ["dir-active-signature", instId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("director_signatures")
        .select("*")
        .eq("institution_id", instId!)
        .eq("is_active", true)
        .eq("user_id", user!.id)
        .eq("role_scope", "directeur")
        .maybeSingle();
      return data;
    },
    enabled: !!instId,
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["dir-docs", instId, tab, status],
    queryFn: async () => {
      let q = (supabase as any)
        .from("document_validations")
        .select("*")
        .eq("institution_id", instId!)
        .eq("document_type", tab)
        .order("created_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      return data || [];
    },
    enabled: !!instId,
  });

  // Realtime : nouveaux documents et changements de statut apparaissent en direct
  useEffect(() => {
    if (!instId) return;
    const channel = supabase
      .channel(`dir-docs-${instId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "document_validations", filter: `institution_id=eq.${instId}` },
        () => qc.invalidateQueries({ queryKey: ["dir-docs", instId] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [instId, qc]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return docs;
    return docs.filter((d: any) => (d.title || "").toLowerCase().includes(s));
  }, [docs, search]);

  const generateFromPayload = async (doc: any) => {
    const p = doc.payload || {};
    if (["class_releves","class_bulletins_trimestre"].includes(p.kind)) {
      await generateClassBulletinsPdf({
        institution,
        academicYear: p.academicYear,
        results: p.results || [],
        params: p.params || {},
        refreshFromDatabase: false,
        document: doc, withSignatures: true,
      });
    }
  };

  const validateMutation = useMutation({
    mutationFn: async (doc: any) => {
      if (!signature?.id) throw new Error("Votre signature active est requise.");
      const pedagoOK = doc.pedagogique_status === "validated";
      const cycleOK = doc.cycle_status === "validated";
      if (!pedagoOK || !cycleOK) {
        throw new Error(
          `Double validation requise — Pédagogique: ${pedagoOK ? "OK" : "en attente"}, Cycle: ${cycleOK ? "OK" : "en attente"}.`,
        );
      }
      const { error } = await (supabase as any)
        .from("document_validations")
        .update({
          status: "validated",
          signature_id: signature?.id || null,
          validated_by: user!.id,
          validated_at: new Date().toISOString(),
          rejection_reason: null,
        })
        .eq("id", doc.id);
      if (error) throw error;
      // Generate & download the PDF only after successful DB update
      await generateFromPayload({...doc,status:"validated",signature_id:signature!.id});
    },
    onSuccess: () => {
      toast.success("Document validé, signé et téléchargé");
      qc.invalidateQueries({ queryKey: ["dir-docs", instId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const redownloadMutation = useMutation({
    mutationFn: async (doc: any) => {
      await generateFromPayload(doc);
    },
    onSuccess: () => toast.success("Téléchargement relancé"),
    onError: (e: any) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectReason.trim()) throw new Error("Motif obligatoire");
      const { error } = await (supabase as any)
        .from("document_validations")
        .update({
          status: "to_correct",
          rejection_reason: rejectReason.trim(),
          validated_by: user!.id,
          validated_at: new Date().toISOString(),
        })
        .eq("id", rejecting.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document renvoyé pour correction");
      setRejecting(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["dir-docs", instId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("document_validations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Document supprimé");
      qc.invalidateQueries({ queryKey: ["dir-docs", instId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
          <FileCheck2 className="w-7 h-7 text-accent" /> Documents à valider
        </h1>
        <p className="text-muted-foreground mt-1">Vérifiez, signez ou renvoyez pour correction les documents officiels.</p>
        {!signature && (
          <Badge variant="outline" className="mt-2 border-amber-300/50 text-amber-700 bg-amber-50">
            Aucune signature active : ajoutez-en une dans « Signature & cachet ».
          </Badge>
        )}
      </motion.div>

      <motion.div variants={item}>
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList className="flex flex-wrap">
            {TYPES.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {TYPES.map((t) => (
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
                    {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
                        <TableHead>Pédagogique</TableHead>
                        <TableHead>Cycle</TableHead>
                        <TableHead>Statut global</TableHead>
                        <TableHead>Créé le</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>}
                      {!isLoading && filtered.length === 0 && (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucun document.</TableCell></TableRow>
                      )}
                      {filtered.map((d: any) => {
                        const sObj = STATUSES.find((s) => s.value === d.status);
                        const pObj = STATUSES.find((s) => s.value === (d.pedagogique_status || "pending"));
                        const cObj = STATUSES.find((s) => s.value === (d.cycle_status || "pending"));
                        const bothValidated = d.pedagogique_status === "validated" && d.cycle_status === "validated";
                        return (
                          <TableRow key={d.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium">{d.title || "Document"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{d.academic_year || "—"}</TableCell>
                            <TableCell><Badge variant="outline" className={pObj?.color}>{pObj?.label}</Badge></TableCell>
                            <TableCell><Badge variant="outline" className={cObj?.color}>{cObj?.label}</Badge></TableCell>
                            <TableCell>
                              <Badge variant="outline" className={sObj?.color}>{sObj?.label}</Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(d.created_at).toLocaleDateString("fr-FR")}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1 flex-wrap">
                                <Button variant="ghost" size="sm" onClick={() => setPreview(d)}>
                                  <Eye className="w-4 h-4 mr-1" /> Aperçu
                                </Button>
                                {d.status !== "validated" && (
                                  <>
                                    <ConfirmDialog
                                      trigger={
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="text-emerald-700 hover:text-emerald-800"
                                          disabled={!bothValidated}
                                          title={!bothValidated ? "Double validation requise (Pédagogique + Cycle)" : ""}
                                        >
                                          <CheckCircle2 className="w-4 h-4 mr-1" /> Valider & télécharger
                                        </Button>
                                      }
                                      title="Valider et émettre le document ?"
                                      description="Le document a été doublement validé (Pédagogique + Cycle). Vous allez apposer la signature institutionnelle et déclencher le téléchargement."
                                      destructive={false}
                                      confirmText="Valider et télécharger"
                                      onConfirm={() => validateMutation.mutate(d)}
                                    />
                                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { setRejecting(d); setRejectReason(""); }}>
                                      <XCircle className="w-4 h-4 mr-1" /> Renvoyer
                                    </Button>
                                  </>
                                )}
                                {d.status === "validated" && (
                                  <>
                                    <Button variant="ghost" size="sm" onClick={() => redownloadMutation.mutate(d)}>
                                      <Download className="w-4 h-4 mr-1" /> Télécharger
                                    </Button>
                                    <ConfirmDialog
                                      trigger={
                                        <Button variant="ghost" size="sm" className="text-destructive">
                                          <XCircle className="w-4 h-4 mr-1" /> Annuler
                                        </Button>
                                      }
                                      title="Annuler la validation ?"
                                      /* eslint-disable-next-line */
                                      description="Êtes-vous sûr de vouloir annuler la validation de ce document ? Il devra être de nouveau validé."
                                      onConfirm={() => { setRejecting(d); setRejectReason("Annulation par le directeur"); }}
                                    />
                                  </>
                                )}
                                <ConfirmDialog
                                  trigger={
                                    <Button variant="ghost" size="icon">
                                      <Trash2 className="w-4 h-4 text-destructive" />
                                    </Button>
                                  }
                                  title="Supprimer ce document ?"
                                  description="Êtes-vous sûr de vouloir effectuer cette action ? Cette opération est définitive."
                                  onConfirm={() => deleteMutation.mutate(d.id)}
                                />
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

      {/* Reject dialog */}
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

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{preview?.title || "Aperçu du document"}</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">Type :</span> {TYPES.find((t) => t.value === preview.document_type)?.label}</p>
              <p><span className="text-muted-foreground">Année :</span> {preview.academic_year || "—"}</p>
              <p><span className="text-muted-foreground">Statut :</span> {STATUSES.find((s) => s.value === preview.status)?.label}</p>
              {preview.rejection_reason && <p><span className="text-muted-foreground">Motif :</span> {preview.rejection_reason}</p>}
              {preview.pdf_url && (
                <a href={preview.pdf_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                  Ouvrir le PDF
                </a>
              )}
              <pre className="text-xs bg-muted/50 p-3 rounded-md overflow-x-auto">{JSON.stringify(preview.payload || {}, null, 2)}</pre>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
