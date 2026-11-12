import { useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PenLine, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeWhiteBackground } from "@/lib/directorSignature";

export const SignatureUploader = () => {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const sigUrl = (profile as any)?.signature_url as string | null | undefined;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!["image/png", "image/jpeg", "image/jpg"].includes(file.type)) {
      toast.error("Format non supporté (PNG ou JPG uniquement)");
      return;
    }
    if (file.size > 800 * 1024) {
      toast.error("Image trop volumineuse (max 800 KB)");
      return;
    }
    setUploading(true);
    try {
      // Nettoie automatiquement l'arrière-plan blanc
      const cleanedFile = await removeWhiteBackground(file);
      
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = () => reject(new Error("Lecture du fichier impossible"));
        r.readAsDataURL(cleanedFile);
      });
      
      const { error: profErr } = await supabase.from("profiles").update({ signature_url: dataUrl } as any).eq("user_id", user.id);
      if (profErr) throw profErr;
      qc.invalidateQueries();
      toast.success("Signature enregistrée");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ signature_url: null } as any).eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Signature supprimée"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card className="glass-card-elevated border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-heading flex items-center gap-2">
          <PenLine className="w-5 h-5 text-accent" /> Signature numérique
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Importez une image de votre signature manuscrite (PNG ou JPG, max 1 MB). L'arrière-plan blanc sera automatiquement supprimé. Elle sera utilisée pour approuver vos notes et apparaîtra automatiquement sur les documents officiels.
        </p>
        <div className="rounded-lg border border-border/60 bg-secondary/20 p-4 flex items-center justify-center min-h-[120px]">
          {sigUrl ? (
            <img src={sigUrl} alt="Signature" className="max-h-24 object-contain" />
          ) : (
            <p className="text-xs text-muted-foreground italic">Aucune signature enregistrée</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg" onChange={handleUpload} className="hidden" />
          <Button onClick={() => fileRef.current?.click()} disabled={uploading} className="gap-2">
            <Upload className="w-4 h-4" /> {uploading ? "Traitement..." : sigUrl ? "Remplacer" : "Importer"}
          </Button>
          {sigUrl && (
            <Button variant="outline" onClick={() => removeMutation.mutate()} disabled={removeMutation.isPending} className="gap-2 text-destructive hover:text-destructive">
              <Trash2 className="w-4 h-4" /> Supprimer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
