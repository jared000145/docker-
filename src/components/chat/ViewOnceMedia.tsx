import { useEffect, useState } from "react";
import { Eye, EyeOff, ImageIcon, Mic } from "lucide-react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import RectorPlusLogo from "@/components/branding/RectorPlusLogo";
import { resolveChatMediaUrl } from "@/lib/chatMedia";
import { cn } from "@/lib/utils";

export default function ViewOnceMedia({ message, isMine }: { message: any; isMine: boolean }) {
  const { profile, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [masked, setMasked] = useState(false);
  const consumed = Boolean(message.viewed_at);
  const isAudio = Boolean(message.audio_url);

  const viewerName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "Utilisateur";

  // Les événements de capture ne sont pas exposés par les navigateurs mobiles.
  // Masquer lors des interruptions détectables, sans prétendre bloquer l'OS.
  useEffect(() => {
    if (!open) { setMasked(false); return; }
    const hide = () => setMasked(true);
    const warn = () => {
      hide();
      toast.error("Capture non autorisée");
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key;
      const captureCombo =
        k === "PrintScreen" ||
        (e.metaKey && e.shiftKey && ["3", "4", "5", "6"].includes(k)) ||
        ((e.ctrlKey || e.metaKey) && (k === "p" || k === "P")) ||
        (e.shiftKey && (e.ctrlKey || e.metaKey) && (k === "s" || k === "S"));
      if (captureCombo) {
        e.preventDefault();
        e.stopPropagation();
        warn();
      }
    };
    const onVisibility = () => { if (document.visibilityState !== "visible") hide(); };
    const onResize = () => hide();
    const focusWatch = window.setInterval(() => {
      if (!document.hasFocus() || document.visibilityState !== "visible") hide();
    }, 300);
    window.addEventListener("keyup", onKey, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("blur", hide, true);
    window.addEventListener("pagehide", hide);
    window.addEventListener("resize", onResize);
    document.addEventListener("visibilitychange", onVisibility);
    document.addEventListener("contextmenu", hide, true);
    return () => {
      window.clearInterval(focusWatch);
      window.removeEventListener("keyup", onKey, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("blur", hide, true);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      document.removeEventListener("contextmenu", hide, true);
    };
  }, [open]);


  const reveal = async () => {
    if (isMine || consumed || loading) return;
    setLoading(true);
    const mediaUrl = await resolveChatMediaUrl(message.audio_url || message.image_url);
    if (!mediaUrl) { setLoading(false); return; }
    // Ouvrir avant de confirmer la vue : la mise à jour temps réel de viewed_at
    // ne doit pas remplacer la fenêtre ouverte par l'état « déjà ouvert ».
    setUrl(mediaUrl);
    setOpen(true);
    const { error } = await supabase.from("messages").update({ viewed_at: new Date().toISOString() } as any).eq("id", message.id);
    if (error) {
      setOpen(false);
      setUrl(null);
    }
    setLoading(false);
  };

  if (isMine) {
    return <div className="mt-1 flex items-center gap-2 text-sm font-medium"><Eye className="h-4 w-4" />{consumed ? "Ouvert" : `Vue unique ${isAudio ? "vocale" : "photo"}`}</div>;
  }
  if (consumed && !open) {
    return <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><EyeOff className="h-4 w-4" />Média déjà ouvert</div>;
  }
  const MediaIcon = isAudio ? Mic : ImageIcon;
  return (
    <>
      <Button type="button" variant="ghost" onClick={reveal} disabled={loading} className="mt-1 h-auto min-h-11 w-full justify-start gap-3 rounded-lg px-2 text-foreground">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 border-primary"><MediaIcon className="h-4 w-4 text-primary" /></span>
        <span className="font-semibold">{loading ? "Ouverture…" : "Ouvrir une fois"}</span>
      </Button>
      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setUrl(null); }}>
        <DialogContent
          className={cn("select-none border-border bg-card p-3", isAudio ? "max-w-md" : "max-w-3xl")}
          onContextMenu={(e) => e.preventDefault()}
          style={{ WebkitTouchCallout: "none" }}
        >
          <DialogTitle className="sr-only">Média à vue unique</DialogTitle>
          <div className="relative">
            {url && !masked && (isAudio
              ? <audio
                  src={url}
                  controls
                  autoPlay
                  controlsList="nodownload noplaybackrate"
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full"
                />
              : <img
                  src={url}
                  alt="Média à vue unique"
                  decoding="async"
                  width={1200}
                  height={900}
                  draggable={false}
                  onDragStart={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  className="pointer-events-none max-h-[80vh] w-full rounded-md object-contain"
                />)}
            {/* Filigrane dissuasif sur le média encore visible. */}
            {url && !masked && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md" aria-hidden="true">
                <div className="absolute inset-[-50%] grid rotate-[-25deg] grid-cols-3 content-around gap-8 opacity-[0.14]">
                  {Array.from({ length: 24 }).map((_, i) => (
                    <span key={i} className="whitespace-nowrap text-center text-xs font-semibold text-foreground">
                      {viewerName}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Les captures ne sont pas autorisées pour les médias à vue unique.
          </p>
        </DialogContent>
      </Dialog>
      {open && masked && createPortal(
        <div role="alert" className="fixed inset-0 z-[100] flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-capture text-capture-foreground px-6 text-center">
          <RectorPlusLogo className="h-24" imageClassName="h-24" />
          <p className="max-w-sm text-lg font-semibold">RectorPlus n’autorise pas les captures d’écran.</p>
          <Button type="button" variant="outline" onClick={() => { setOpen(false); setUrl(null); }} className="mt-3">
            Fermer
          </Button>
        </div>, document.body
      )}
    </>
  );
}
