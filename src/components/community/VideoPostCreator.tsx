import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Video, X, Loader2, Film } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_VIDEO_DURATION = 180; // 3 min

interface VideoPostCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Generate a thumbnail (JPEG dataURL) from a video file.
 */
async function generateVideoThumbnail(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    video.onloadeddata = () => {
      // Seek to 1s or 10% of duration
      video.currentTime = Math.min(1, (video.duration || 1) * 0.1);
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        resolve(null);
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        resolve(blob);
      }, "image/jpeg", 0.8);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
  });
}

export const VideoPostCreator = ({ open, onOpenChange }: VideoPostCreatorProps) => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "thumb" | "video" | "save">("idle");

  const reset = () => {
    setFile(null);
    setPreviewUrl(null);
    setCaption("");
    setProgress(0);
    setPhase("idle");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("video/")) {
      toast.error("Veuillez sélectionner une vidéo");
      return;
    }
    if (f.size > MAX_VIDEO_SIZE) {
      toast.error("Vidéo trop volumineuse (max 100MB)");
      return;
    }
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
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("Aucune vidéo");
      const ts = Date.now();

      // 1. Generate + upload thumbnail
      setPhase("thumb");
      setProgress(10);
      const thumbBlob = await generateVideoThumbnail(file);
      let thumbUrl: string | null = null;
      if (thumbBlob) {
        const thumbPath = `${user.id}/community/reels/${ts}_thumb.jpg`;
        const { error: tErr } = await supabase.storage
          .from("media")
          .upload(thumbPath, thumbBlob, { contentType: "image/jpeg", upsert: false });
        if (!tErr) {
          thumbUrl = supabase.storage.from("media").getPublicUrl(thumbPath).data.publicUrl;
        }
      }
      setProgress(25);

      // 2. Upload video (Supabase JS doesn't expose progress events; simulate steps)
      setPhase("video");
      const ext = file.name.split(".").pop() || "mp4";
      const videoPath = `${user.id}/community/reels/${ts}.${ext}`;
      // Simulate progress while uploading
      const progressTimer = setInterval(() => {
        setProgress((p) => (p < 85 ? p + 3 : p));
      }, 400);
      const { error: vErr } = await supabase.storage
        .from("media")
        .upload(videoPath, file, { contentType: file.type, upsert: false });
      clearInterval(progressTimer);
      if (vErr) throw vErr;
      setProgress(90);
      const videoUrl = supabase.storage.from("media").getPublicUrl(videoPath).data.publicUrl;

      // 3. Save post
      setPhase("save");
      const { error: insErr } = await supabase.from("community_posts").insert({
        author_id: user.id,
        content: caption,
        video_url: videoUrl,
        image_url: thumbUrl, // reuse image_url to store thumbnail
        post_type: "reel",
      });
      if (insErr) throw insErr;
      setProgress(100);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["community-posts"] });
      toast.success("Reel publié !");
      handleClose();
    },
    onError: (e: any) => {
      toast.error(e.message || "Erreur de publication");
      setPhase("idle");
      setProgress(0);
    },
  });

  const isUploading = publishMutation.isPending;

  const phaseLabel = {
    idle: "",
    thumb: "Génération de l'aperçu...",
    video: "Upload de la vidéo...",
    save: "Finalisation...",
  }[phase];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isUploading && handleClose()}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden bg-[hsl(225,40%,8%)] border-white/10 text-white">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isUploading}
            className="text-white/60 hover:text-white hover:bg-white/5"
          >
            Annuler
          </Button>
          <span className="font-semibold text-sm flex items-center gap-1.5">
            <Film className="w-4 h-4 text-accent" /> Nouveau Reel
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => publishMutation.mutate()}
            disabled={!file || isUploading}
            className="text-accent font-semibold hover:bg-white/5"
          >
            {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Publier"}
          </Button>
        </div>

        <div className="p-4 space-y-3">
          {!previewUrl ? (
            <div
              onClick={() => fileRef.current?.click()}
              className="aspect-[9/16] max-h-[55vh] rounded-2xl border-2 border-dashed border-white/15 flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
            >
              <div className="w-16 h-16 rounded-full gradient-gold flex items-center justify-center">
                <Video className="w-8 h-8 text-accent-foreground" />
              </div>
              <p className="text-sm font-medium text-white">Sélectionner une vidéo</p>
              <p className="text-xs text-white/50 text-center px-6">
                MP4 recommandé · max {MAX_VIDEO_DURATION}s · 100MB
              </p>
            </div>
          ) : (
            <div className="relative aspect-[9/16] max-h-[55vh] rounded-2xl overflow-hidden bg-black">
              <video
                src={previewUrl}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-contain"
              />
              {!isUploading && (
                <button
                  onClick={reset}
                  className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center backdrop-blur-sm"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/*"
            className="hidden"
            onChange={handleFile}
          />

          {previewUrl && !isUploading && (
            <Textarea
              placeholder="Ajouter une légende ou des #hashtags..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={2}
              maxLength={500}
              className="resize-none bg-white/[0.04] border-white/10 text-sm text-white placeholder:text-white/30"
            />
          )}

          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-white/70">
                <span>{phaseLabel}</span>
                <span className="font-semibold text-accent">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-white/10" />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
