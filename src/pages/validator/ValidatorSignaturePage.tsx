import {PrivateMediaImage} from "@/components/PrivateMediaImage";
import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PenSquare, Upload, CheckCircle2, Trash2, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { removeWhiteBackground, invalidateDirectorSignatureCache } from "@/lib/directorSignature";
import type { ValidatorRoleConfig } from "@/lib/validatorRoles";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };

export default function ValidatorSignaturePage({ role }: { role: ValidatorRoleConfig }) {
  const qc = useQueryClient();
  const { user, profile } = useAuth();
  const instId = profile?.institution_id;
  const [name, setName] = useState(`${profile?.first_name || ""} ${profile?.last_name || ""}`.trim());
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | null>(null);
  const sigRef = useRef<HTMLInputElement>(null);
  const stampRef = useRef<HTMLInputElement>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);

  const { data: signatures = [] } = useQuery({
    queryKey: ["validator-sigs", instId, role.scope],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("director_signatures")
        .select("*")
        .eq("institution_id", instId!)
        .eq("user_id", user!.id)
        .eq("role_scope", role.scope)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!instId,
  });

  const upload = async (file: File, kind: "signature" | "stamp") => {
    const cleaned = await removeWhiteBackground(file);
    const path = `${user!.id}/${role.scope}-${kind}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("signatures").upload(path, cleaned, { upsert: true, contentType: "image/png" });
    if (error) throw error;
    const { data } = supabase.storage.from("signatures").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleUpload = async (file: File | undefined, kind: "signature" | "stamp") => {
    if (!file) return;
    try {
      const url = await upload(file, kind);
      if (kind === "signature") setSignatureUrl(url);
      else setStampUrl(url);
      toast.success(`${kind === "signature" ? "Signature" : "Cachet"} chargé`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nom requis");
      if (!signatureUrl) throw new Error("Signature requise");
      await (supabase as any)
        .from("director_signatures")
        .update({ is_active: false })
        .eq("institution_id", instId!)
        .eq("role_scope", role.scope)
        .eq("is_active", true);
      const { error } = await (supabase as any).from("director_signatures").insert({
        institution_id: instId,
        user_id: user!.id,
        director_name: name.trim(),
        signature_url: signatureUrl,
        stamp_url: stampUrl,
        role_scope: role.scope,
        is_active: true,
        activated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateDirectorSignatureCache();
      toast.success("Nouvelle signature activée");
      setSignatureUrl(null);
      setStampUrl(null);
      qc.invalidateQueries({ queryKey: ["validator-sigs", instId, role.scope] });
      qc.invalidateQueries({ queryKey: ["validator-active-sig", instId, role.scope] });
    },
    onError: (e: any) => {
      const msg = e?.message || String(e);
      if (msg.includes("uniq_active_signature") || msg.includes("duplicate key")) {
        toast.error("Une signature active existe déjà pour ce rôle. Veuillez la désactiver ou la supprimer avant d'en ajouter une nouvelle.");
      } else {
        toast.error(msg);
      }
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any)
        .from("director_signatures")
        .update({ is_active: false })
        .eq("institution_id", instId!)
        .eq("role_scope", role.scope)
        .eq("is_active", true);
      const { error } = await (supabase as any)
        .from("director_signatures")
        .update({ is_active: true, activated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateDirectorSignatureCache();
      toast.success("Signature activée");
      qc.invalidateQueries({ queryKey: ["validator-sigs", instId, role.scope] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("director_signatures").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateDirectorSignatureCache();
      toast.success("Signature supprimée");
      qc.invalidateQueries({ queryKey: ["validator-sigs", instId, role.scope] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground flex items-center gap-2">
          <PenSquare className="w-7 h-7 text-accent" /> Signature & cachet — {role.label}
        </h1>
        <p className="text-muted-foreground mt-1">L'arrière-plan blanc est automatiquement supprimé.</p>
      </motion.div>

      <motion.div variants={item}>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Nouvelle signature</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Nom du {role.label.toLowerCase()}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Pr. Jean Dupont" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Signature</Label>
                <input ref={sigRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => handleUpload(e.target.files?.[0], "signature")} />
                <div className="border border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center min-h-32 bg-muted/30">
                  {signatureUrl ? <PrivateMediaImage signature src={signatureUrl} alt="Aperçu de la signature numérique" className="max-h-24 object-contain" />
                    : <div className="text-muted-foreground flex flex-col items-center text-xs"><ImageIcon className="w-8 h-8 mb-1" />Aucune signature</div>}
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => sigRef.current?.click()}>
                  <Upload className="w-3 h-3 mr-1" /> Charger
                </Button>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Cachet</Label>
                <input ref={stampRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => handleUpload(e.target.files?.[0], "stamp")} />
                <div className="border border-dashed border-border rounded-lg p-4 flex flex-col items-center justify-center min-h-32 bg-muted/30">
                  {stampUrl ? <PrivateMediaImage signature src={stampUrl} alt="Aperçu du cachet de l'établissement" className="max-h-24 object-contain" />
                    : <div className="text-muted-foreground flex flex-col items-center text-xs"><ImageIcon className="w-8 h-8 mb-1" />Aucun cachet</div>}
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => stampRef.current?.click()}>
                  <Upload className="w-3 h-3 mr-1" /> Charger
                </Button>
              </div>
            </div>
            <Button
              className="w-full"
              disabled={createMutation.isPending || !signatureUrl}
              onClick={() => {
                const existingActive = signatures.find((s: any) => s.is_active);
                if (existingActive) {
                  setConfirmReplace(true);
                } else {
                  createMutation.mutate();
                }
              }}
            >
              {createMutation.isPending ? "Enregistrement..." : "Enregistrer et activer"}
            </Button>

            <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    Une signature active existe déjà
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Une signature {role.label.toLowerCase()} est déjà active pour cet établissement
                    {signatures.find((s: any) => s.is_active)?.director_name
                      ? ` (${signatures.find((s: any) => s.is_active)?.director_name})`
                      : ""}.
                    {" "}En continuant, l'ancienne sera archivée et remplacée par la nouvelle.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => { setConfirmReplace(false); createMutation.mutate(); }}>
                    Remplacer la signature
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div variants={item}>
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-lg">Historique</CardTitle></CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Nom</TableHead>
                  <TableHead>Signature</TableHead>
                  <TableHead>Cachet</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Activée le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signatures.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Aucune signature enregistrée.</TableCell></TableRow>}
                {signatures.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.director_name}</TableCell>
                    <TableCell>{s.signature_url ? <PrivateMediaImage signature src={s.signature_url} alt={`Signature de ${s.director_name}`} className="h-10 object-contain" /> : "—"}</TableCell>
                    <TableCell>{s.stamp_url ? <PrivateMediaImage signature src={s.stamp_url} alt={`Cachet associé à ${s.director_name}`} className="h-10 object-contain" /> : "—"}</TableCell>
                    <TableCell>
                      {s.is_active
                        ? <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300/40">Active</Badge>
                        : <Badge variant="outline">Archivée</Badge>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.activated_at ? new Date(s.activated_at).toLocaleDateString("fr-FR") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {!s.is_active && (
                          <Button variant="ghost" size="sm" onClick={() => activateMutation.mutate(s.id)}>
                            <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-600" /> Activer
                          </Button>
                        )}
                        <ConfirmDialog
                          trigger={<Button variant="ghost" size="icon"><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                          title="Supprimer cette signature ?"
                          description="Cette opération est définitive."
                          onConfirm={() => deleteMutation.mutate(s.id)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
