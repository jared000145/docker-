import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Image as ImageIcon, Video, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const MAX_VIDEO_DURATION = 30; // seconds
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

interface StoryCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const StoryCreator = ({ open, onOpenChange }: StoryCreatorProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [description, setDescription] = useState("");

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setMediaType("image");
    setDescription("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    if (f.size > MAX_FILE_SIZE) {
      toast.error("Fichier trop volumineux (max 50MB)");
      return;
    }

    const isVideo = f.type.startsWith("video/");
    const isImage = f.type.startsWith("image/");

    if (!isVideo && !isImage) {
      toast.error("Format non supporté");
      return;
    }

    if (isVideo) {
      // Validate duration
      const url = URL.createObjectURL(f);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.src = url;
      await new Promise<void>((resolve) => {
        video.onloadedmetadata = () => {
          if (video.duration > MAX_VIDEO_DURATION) {
            toast.error(`Vidéo trop longue (max ${MAX_VIDEO_DURATION}s)`);
            URL.revokeObjectURL(url);
            resolve();
            return;
          }
          setMediaType("video");
          setFile(f);
          setPreviewUrl(url);
          resolve();
        };
        video.onerror = () => {
          toast.error("Impossible de lire la vidéo");
          URL.revokeObjectURL(url);
          resolve();
        };
      });
    } else {
      setMediaType("image");
      setFile(f);
      setPreviewUrl(URL.createObjectURL(f));
    }
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("Aucun fichier");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("stories").upload(path, file, {
        contentType: file.type,
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("stories").getPublicUrl(path);
      const { error: insErr } = await (supabase as any).from("stories").insert({
        user_id: user.id,
        media_url: urlData.publicUrl,
        media_type: mediaType,
        description: description.trim() || null,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Story publiée !");
      handleClose();
    },
    onError: (e: any) => toast.error(e.message || "Erreur de publication"),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border/40">
          <Button variant="ghost" size="sm" onClick={handleClose}>Annuler</Button>
          <span className="font-semibold text-sm">Nouvelle story</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => publishMutation.mutate()}
            disabled={!file || publishMutation.isPending}
            className="text-accent font-semibold"
          >
            {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Partager"}
          </Button>
        </div>

        <div className="p-4">
          {!previewUrl ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="aspect-[9/16] max-h-[60vh] rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors"
            >
              <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center">
                <Camera className="w-8 h-8 text-accent-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Sélectionner un média</p>
              <p className="text-xs text-muted-foreground text-center px-6">
                Image ou vidéo (max {MAX_VIDEO_DURATION}s)
              </p>
              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                <div className="flex items-center gap-1.5 text-xs">
                  <ImageIcon className="w-4 h-4" /> Image
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Video className="w-4 h-4" /> Vidéo
                </div>
              </div>
            </div>
          ) : (
            <div className="relative aspect-[9/16] max-h-[60vh] rounded-2xl overflow-hidden bg-black">
              {mediaType === "image" ? (
                <img src={previewUrl} alt="Aperçu de la story à publier" decoding="async" className="w-full h-full object-contain" />
              ) : (
                <video src={previewUrl} controls autoPlay loop muted className="w-full h-full object-contain" />
              )}
              <button
                onClick={reset}
                className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center backdrop-blur-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFile}
          />

          {previewUrl && (
            <div className="mt-3 space-y-3">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ajouter une description..."
                maxLength={180}
                className="min-h-20 resize-none bg-secondary/40 placeholder:text-muted-foreground/60"
              />
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => fileRef.current?.click()}
              >
                Changer de média
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
